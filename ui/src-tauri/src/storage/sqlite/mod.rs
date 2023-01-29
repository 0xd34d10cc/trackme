use std::path::PathBuf;

use async_trait::async_trait;
use rusqlite::Connection;
use tokio::sync::Mutex;

use crate::activity::Entry as ActivityEntry;

const CREATE_TABLE: &str = include_str!("create_table.sql");
const INSERT_ACTIVITY: &str = include_str!("insert_activity.sql");

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
                entry.begin.timestamp(),
                entry.end.timestamp(),
                entry.activity.pid,
                entry.activity.exe,
                entry.activity.title,
            ),
        )?;
        Ok(())
    }
}
