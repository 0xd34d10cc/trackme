use std::path::PathBuf;

use async_trait::async_trait;
use chrono::NaiveDateTime;
use rusqlite::Connection;
use tokio::sync::Mutex;

use crate::activity::{Activity, Entry as ActivityEntry};

const CREATE_TABLE: &str = include_str!("create_table.sql");
const INSERT_ACTIVITY: &str = include_str!("insert_activity.sql");
const SELECT_ACTIVITIES: &str = include_str!("select_activities.sql");

pub struct Storage {
    connection: Mutex<Connection>,
}

impl Storage {
    pub fn open(location: PathBuf) -> anyhow::Result<Self> {
        let connection = Connection::open(location)?;
        connection.execute(CREATE_TABLE, ())?;
        Ok(Storage {
            connection: Mutex::new(connection),
        })
    }
}

#[async_trait]
impl super::Storage for Storage {
    async fn store(&self, entry: ActivityEntry) -> anyhow::Result<()> {
        let connection = self.connection.lock().await;
        connection.execute(
            INSERT_ACTIVITY,
            (
                entry.begin.timestamp_millis(),
                entry.end.timestamp_millis(),
                entry.activity.pid,
                entry.activity.exe,
                entry.activity.title,
            ),
        )?;
        Ok(())
    }

    async fn select(
        &self,
        from: NaiveDateTime,
        to: NaiveDateTime,
    ) -> anyhow::Result<Vec<ActivityEntry>> {
        let connection = self.connection.lock().await;
        let mut statement = connection.prepare_cached(SELECT_ACTIVITIES)?;
        let query = statement.query_map((from.timestamp_millis(), to.timestamp_millis()), |row| {
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
        })?;

        let mut entries = Vec::new();
        for entry in query {
            entries.push(entry?);
        }

        Ok(entries)
    }
}
