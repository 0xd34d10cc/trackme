use std::time::Duration;

use chrono::{NaiveDateTime, Utc};
use tokio::sync::Mutex;
use tokio::time::Instant;

use crate::activity::{Activity, Entry as ActivityEntry};
use crate::config::Config;
use crate::storage::Storage;

pub struct Tracker<S: Storage> {
    current: Mutex<Option<ActivityEntry>>,
    config: Config,
    storage: S,
}

impl<S: Storage> Tracker<S> {
    pub fn new(storage: S, config: Config) -> anyhow::Result<Self> {
        Ok(Tracker {
            current: Mutex::new(None),
            config,
            storage,
        })
    }

    pub async fn run(&self) -> anyhow::Result<()> {
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

    async fn track(&self, activity: Activity, time: NaiveDateTime) -> anyhow::Result<()> {
        // TODO: handle idle

        if let Some(tag) = self.config.tagger.tag(&activity) {
            if self.config.blacklist.contains(tag) {
                // do not track blacklisted activities
                return Ok(());
            }
        }

        self.write(activity, time).await
    }

    async fn write(&self, activity: Activity, time: NaiveDateTime) -> anyhow::Result<()> {
        let mut current = self.current.lock().await;
        match current.as_mut() {
            Some(current) => {
                current.end = time;
                if current.activity == activity {
                    return Ok(());
                }

                let prev = std::mem::replace(current, ActivityEntry::new(activity, time));
                self.storage.store(prev).await?;
            }
            None => {
                *current = Some(ActivityEntry::new(activity, time));
            }
        }

        Ok(())
    }
}
