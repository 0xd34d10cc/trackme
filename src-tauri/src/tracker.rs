use std::sync::Arc;
use std::time::Duration;

use arc_swap::ArcSwap;
use chrono::{NaiveDateTime, Utc};
use tauri::{AppHandle, Manager};
use tokio::time::Instant;

use crate::activity::{Activity, Entry as ActivityEntry};
use crate::config::Config;
use crate::storage::Storage;

pub struct Tracker {
    current: Option<ActivityEntry>,

    handle: AppHandle,
    storage: Arc<dyn Storage>,
}

impl Tracker {
    pub fn new(
        storage: Arc<dyn Storage>,
        handle: AppHandle,
    ) -> anyhow::Result<Self> {
        Ok(Tracker {
            current: None,
            handle,
            storage,
        })
    }

    pub async fn run(&mut self) -> anyhow::Result<()> {
        let mut now = Utc::now().naive_utc();
        let mut next_tick = Instant::now();
        loop {
            if let Some(activity) = Activity::current() {
                self.track(activity, now).await?;
            }

            next_tick += Duration::from_secs(1);
            tokio::time::sleep_until(next_tick).await;
            now = Utc::now().naive_utc();
        }
    }

    async fn track(&mut self, mut activity: Activity, time: NaiveDateTime) -> anyhow::Result<()> {
        let config = self.handle.state::<ArcSwap<Config>>().load();
        if let Some(tag) = config.tagger.tag(&activity) {
            if config.blacklist.contains(tag) {
                // do not track blacklisted activities
                self.flush().await?;
                return Ok(());
            }
        }

        // TODO: make it configurable
        const MAX_IDLE_TIME: Duration = Duration::from_secs(300);
        if crate::idle::time() > MAX_IDLE_TIME {
            activity = Activity::idle();
        }

        self.write(activity, time).await
    }

    async fn write(&mut self, activity: Activity, time: NaiveDateTime) -> anyhow::Result<()> {
        if let Some(current) = self.current.as_mut() {
            current.end = time;
            if current.activity == activity {
                return Ok(());
            }

            let prev = std::mem::replace(current, ActivityEntry::new(activity, time));
            self.storage.store(prev).await?;
        } else {
            self.current = Some(ActivityEntry::new(activity, time));
        }

        Ok(())
    }

    async fn flush(&mut self) -> anyhow::Result<()> {
        if let Some(activity) = self.current.take() {
            self.storage.store(activity).await?;
        }

        Ok(())
    }
}
