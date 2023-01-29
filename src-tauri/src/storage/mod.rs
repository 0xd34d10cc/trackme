use std::ops::Deref;
use std::sync::Arc;

use async_trait::async_trait;
use chrono::NaiveDateTime;

use crate::activity::Entry as ActivityEntry;

pub mod csv;
pub mod sqlite;

#[async_trait]
pub trait Storage: Sync + Send + 'static {
    async fn store(&self, activity: ActivityEntry) -> anyhow::Result<()>;
    async fn select(&self, from: NaiveDateTime, to: NaiveDateTime) -> anyhow::Result<Vec<ActivityEntry>>;
}

#[async_trait]
impl Storage for Box<dyn Storage> {
    async fn store(&self, activity: ActivityEntry) -> anyhow::Result<()> {
        self.deref().store(activity).await
    }

    async fn select(&self, from: NaiveDateTime, to: NaiveDateTime) -> anyhow::Result<Vec<ActivityEntry>> {
        self.deref().select(from, to).await
    }
}

#[async_trait]
impl Storage for Arc<dyn Storage> {
    async fn store(&self, activity: ActivityEntry) -> anyhow::Result<()> {
        self.deref().store(activity).await
    }

    async fn select(&self, from: NaiveDateTime, to: NaiveDateTime) -> anyhow::Result<Vec<ActivityEntry>> {
        self.deref().select(from, to).await
    }
}