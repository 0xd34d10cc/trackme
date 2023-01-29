use std::ops::Deref;

use async_trait::async_trait;

use crate::activity::Entry as ActivityEntry;

pub mod csv;
pub mod sqlite;

#[async_trait]
pub trait Storage: Sync + Send {
    async fn store(&self, activity: ActivityEntry) -> anyhow::Result<()>;
}

#[async_trait]
impl Storage for Box<dyn Storage> {
    async fn store(&self, activity: ActivityEntry) -> anyhow::Result<()> {
        self.deref().store(activity).await
    }
}