use std::{ops::Deref, time::Duration};
use std::sync::Arc;

use async_trait::async_trait;
use chrono::{NaiveDateTime, NaiveDate};

use crate::activity::Entry as ActivityEntry;

pub mod sqlite;

#[async_trait]
pub trait Storage: Sync + Send + 'static {
    async fn store(&self, activity: ActivityEntry) -> anyhow::Result<()>;
    async fn select(&self, from: NaiveDateTime, to: NaiveDateTime) -> anyhow::Result<Vec<ActivityEntry>>;
    async fn active_dates(&self) -> anyhow::Result<Vec<NaiveDate>>;
    async fn duration_by_exe(&self, from: NaiveDateTime, to: NaiveDateTime) -> anyhow::Result<Vec<(String, Duration)>>;
}

#[async_trait]
impl Storage for Box<dyn Storage> {
    async fn store(&self, activity: ActivityEntry) -> anyhow::Result<()> {
        self.deref().store(activity).await
    }

    async fn select(&self, from: NaiveDateTime, to: NaiveDateTime) -> anyhow::Result<Vec<ActivityEntry>> {
        self.deref().select(from, to).await
    }

    async fn active_dates(&self) -> anyhow::Result<Vec<NaiveDate>> {
        self.deref().active_dates().await
    }

    async fn duration_by_exe(&self, from: NaiveDateTime, to: NaiveDateTime) -> anyhow::Result<Vec<(String, Duration)>> {
        self.deref().duration_by_exe(from, to).await
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

    async fn active_dates(&self) -> anyhow::Result<Vec<NaiveDate>> {
        self.deref().active_dates().await
    }

    async fn duration_by_exe(&self, from: NaiveDateTime, to: NaiveDateTime) -> anyhow::Result<Vec<(String, Duration)>> {
        self.deref().duration_by_exe(from, to).await
    }
}