use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use chrono::NaiveDateTime;
use duckdb::{params, Connection};

use crate::activity::{Activity, Entry as ActivityEntry};

pub struct Storage {
    // std::sync::Mutex rather than tokio's: duckdb::Connection is Send but !Sync
    // (it holds a RefCell internally), and Mutex<T> is Sync only when T: Send.
    // The Arc is what lets a clone be moved into the blocking call below.
    connection: Arc<Mutex<Connection>>,
}

impl Storage {
    pub fn open(location: PathBuf) -> anyhow::Result<Self> {
        const SETTINGS: &str = include_str!("settings.sql");
        const CREATE_TABLE: &str = include_str!("create_table.sql");

        let connection = Connection::open(location)?;
        // execute_batch, not execute: both files hold multiple statements,
        // which execute() rejects
        connection.execute_batch(SETTINGS)?;
        connection.execute_batch(CREATE_TABLE)?;
        Ok(Storage {
            connection: Arc::new(Mutex::new(connection)),
        })
    }
}

#[async_trait]
impl super::Storage for Storage {
    async fn store(&self, entry: ActivityEntry) -> anyhow::Result<()> {
        const INSERT_ACTIVITY: &str = include_str!("insert_activity.sql");

        let connection = self.connection.clone();
        tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<()> {
            let connection = connection.lock().unwrap();
            connection.execute(
                INSERT_ACTIVITY,
                params![
                    entry.begin.timestamp_millis(),
                    entry.end.timestamp_millis(),
                    entry.activity.pid,
                    entry.activity.exe,
                    entry.activity.title,
                ],
            )?;
            Ok(())
        })
        .await?
    }

    async fn select(
        &self,
        from: NaiveDateTime,
        to: NaiveDateTime,
    ) -> anyhow::Result<Vec<ActivityEntry>> {
        const SELECT_ACTIVITIES: &str = include_str!("select_activities.sql");

        let connection = self.connection.clone();
        tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<Vec<ActivityEntry>> {
            let connection = connection.lock().unwrap();
            let mut statement = connection.prepare_cached(SELECT_ACTIVITIES)?;
            let query = statement.query_map(
                params![from.timestamp_millis(), to.timestamp_millis()],
                |row| {
                    let begin: i64 = row.get(0)?;
                    let end: i64 = row.get(1)?;
                    Ok(ActivityEntry {
                        begin: NaiveDateTime::from_timestamp_millis(begin).unwrap(),
                        end: NaiveDateTime::from_timestamp_millis(end).unwrap(),
                        activity: Activity {
                            pid: row.get(2)?,
                            exe: row.get(3)?,
                            title: row.get(4)?,
                        },
                    })
                },
            )?;

            let mut entries = Vec::new();
            for entry in query {
                entries.push(entry?);
            }

            Ok(entries)
        })
        .await?
    }

    async fn active_dates(&self) -> anyhow::Result<Vec<chrono::NaiveDate>> {
        const SELECT_ACTIVE_DATES: &str = include_str!("select_active_dates.sql");

        let connection = self.connection.clone();
        tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<Vec<chrono::NaiveDate>> {
            let connection = connection.lock().unwrap();
            let mut statement = connection.prepare_cached(SELECT_ACTIVE_DATES)?;
            let query = statement.query_map(params![], |row| {
                let begin: i64 = row.get(0)?;
                let time = NaiveDateTime::from_timestamp_millis(begin).unwrap();
                debug_assert!(time.time() == chrono::NaiveTime::default());
                Ok(time.date())
            })?;

            let mut dates = Vec::new();
            for date in query {
                dates.push(date?);
            }

            Ok(dates)
        })
        .await?
    }

    async fn duration_by_exe(
        &self,
        from: NaiveDateTime,
        to: NaiveDateTime,
    ) -> anyhow::Result<Vec<(String, std::time::Duration)>> {
        const SELECT_DURATION_BY_EXE: &str = include_str!("duration_by_exe.sql");

        let connection = self.connection.clone();
        tauri::async_runtime::spawn_blocking(
            move || -> anyhow::Result<Vec<(String, std::time::Duration)>> {
                let connection = connection.lock().unwrap();
                let mut statement = connection.prepare_cached(SELECT_DURATION_BY_EXE)?;
                let query = statement.query_map(
                    params![from.timestamp_millis(), to.timestamp_millis()],
                    |row| {
                        let exe: String = row.get(0)?;
                        let duration: i64 = row.get(1)?;
                        Ok((exe, std::time::Duration::from_millis(duration as u64)))
                    },
                )?;

                let mut durations = Vec::new();
                for duration in query {
                    durations.push(duration?);
                }

                Ok(durations)
            },
        )
        .await?
    }
}
