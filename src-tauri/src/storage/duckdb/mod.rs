use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use chrono::{DateTime, NaiveDateTime};
use duckdb::{named_params, params, Connection};

use crate::activity::{Activity, Entry as ActivityEntry};
use crate::analytics::DailyUsage;

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

/// Per (day, exe) totals over `[from_ms, to_ms)`.
///
/// A free function rather than a method so the test module below can run it
/// against an in-memory connection without a Tauri runtime.
fn query_usage_daily(
    connection: &Connection,
    from_ms: i64,
    to_ms: i64,
) -> anyhow::Result<Vec<DailyUsage>> {
    const USAGE_DAILY: &str = include_str!("usage_daily.sql");

    let mut statement = connection.prepare_cached(USAGE_DAILY)?;
    let query = statement.query_map(
        // Named, unlike select_activities.sql's (to, from) positional pair —
        // see the note in usage_daily.sql.
        named_params! { "from_ms": from_ms, "to_ms": to_ms },
        |row| {
            Ok(DailyUsage {
                day_ms: row.get(0)?,
                exe: row.get(1)?,
                duration_ms: row.get(2)?,
                interval_count: row.get(3)?,
            })
        },
    )?;

    let mut rows = Vec::new();
    for row in query {
        rows.push(row?);
    }
    Ok(rows)
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
                    entry.begin.and_utc().timestamp_millis(),
                    entry.end.and_utc().timestamp_millis(),
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
                // to first, from second: select_activities.sql is an overlap
                // predicate (begin_ms < to_ms and end_ms > from_ms)
                params![
                    to.and_utc().timestamp_millis(),
                    from.and_utc().timestamp_millis()
                ],
                |row| {
                    let begin: i64 = row.get(0)?;
                    let end: i64 = row.get(1)?;
                    Ok(ActivityEntry {
                        begin: DateTime::from_timestamp_millis(begin).unwrap().naive_utc(),
                        end: DateTime::from_timestamp_millis(end).unwrap().naive_utc(),
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
                let time = DateTime::from_timestamp_millis(begin).unwrap().naive_utc();
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

    async fn usage_daily(
        &self,
        from: NaiveDateTime,
        to: NaiveDateTime,
    ) -> anyhow::Result<Vec<DailyUsage>> {
        let connection = self.connection.clone();
        tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<Vec<DailyUsage>> {
            let connection = connection.lock().unwrap();
            query_usage_daily(
                &connection,
                from.and_utc().timestamp_millis(),
                to.and_utc().timestamp_millis(),
            )
        })
        .await?
    }
}

#[cfg(test)]
mod tests {
    use super::query_usage_daily;
    use crate::analytics::DailyUsage;
    use duckdb::{params, Connection};

    const HOUR: i64 = 3_600_000;
    const DAY: i64 = 86_400_000;
    /// An arbitrary UTC midnight.
    const DAY0: i64 = 20_000 * DAY;

    fn seeded(rows: &[(i64, i64, &str)]) -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(include_str!("create_table.sql"))
            .unwrap();
        for (begin, end, exe) in rows {
            connection
                .execute(
                    "insert into activities values (?, ?, 0, ?, 't')",
                    params![begin, end, exe],
                )
                .unwrap();
        }
        connection
    }

    fn row(day_ms: i64, exe: &str, duration_ms: i64, interval_count: i64) -> DailyUsage {
        DailyUsage {
            day_ms,
            exe: exe.to_owned(),
            duration_ms,
            interval_count,
        }
    }

    #[test]
    fn clips_the_start_of_the_window() {
        // 08:00 -> 14:00, but the window opens at 12:00.
        let connection = seeded(&[(DAY0 + 8 * HOUR, DAY0 + 14 * HOUR, "a.exe")]);
        assert_eq!(
            query_usage_daily(&connection, DAY0 + 12 * HOUR, DAY0 + DAY).unwrap(),
            vec![row(DAY0, "a.exe", 2 * HOUR, 1)],
        );
    }

    #[test]
    fn clips_the_end_of_the_window() {
        let connection = seeded(&[(DAY0 + 8 * HOUR, DAY0 + 14 * HOUR, "a.exe")]);
        assert_eq!(
            query_usage_daily(&connection, DAY0, DAY0 + 10 * HOUR).unwrap(),
            vec![row(DAY0, "a.exe", 2 * HOUR, 1)],
        );
    }

    #[test]
    fn ignores_rows_outside_the_window() {
        let connection = seeded(&[(DAY0 + 8 * HOUR, DAY0 + 9 * HOUR, "a.exe")]);
        assert!(query_usage_daily(&connection, DAY0 + DAY, DAY0 + 2 * DAY)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn sums_and_counts_rows_per_exe() {
        let connection = seeded(&[
            (DAY0 + HOUR, DAY0 + 2 * HOUR, "b.exe"),
            (DAY0 + 2 * HOUR, DAY0 + 5 * HOUR, "a.exe"),
            (DAY0 + 5 * HOUR, DAY0 + 6 * HOUR, "a.exe"),
        ]);
        assert_eq!(
            query_usage_daily(&connection, DAY0, DAY0 + DAY).unwrap(),
            vec![
                row(DAY0, "a.exe", 4 * HOUR, 2),
                row(DAY0, "b.exe", HOUR, 1),
            ],
        );
    }

    #[test]
    fn buckets_each_day_separately() {
        let connection = seeded(&[
            (DAY0 + HOUR, DAY0 + 2 * HOUR, "a.exe"),
            (DAY0 + DAY + HOUR, DAY0 + DAY + 3 * HOUR, "a.exe"),
        ]);
        assert_eq!(
            query_usage_daily(&connection, DAY0, DAY0 + 2 * DAY).unwrap(),
            vec![
                row(DAY0, "a.exe", HOUR, 1),
                row(DAY0 + DAY, "a.exe", 2 * HOUR, 1),
            ],
        );
    }

    #[test]
    fn treats_idle_as_an_ordinary_exe() {
        let connection = seeded(&[(DAY0 + HOUR, DAY0 + 3 * HOUR, "idle")]);
        assert_eq!(
            query_usage_daily(&connection, DAY0, DAY0 + DAY).unwrap(),
            vec![row(DAY0, "idle", 2 * HOUR, 1)],
        );
    }
}
