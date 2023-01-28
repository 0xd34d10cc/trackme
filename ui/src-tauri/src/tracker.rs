use std::path::PathBuf;
use std::time::Duration;
use std::fs::File;

use chrono::{NaiveDate, NaiveDateTime, Utc};
use tokio::sync::Mutex;
use tokio::time::Instant;

use crate::config::Config;
use crate::activity::{self, Activity};

type ActivityWriter = activity::Writer<File>;

fn log_filename(base_dir: PathBuf, date: NaiveDate) -> PathBuf {
    let date = date.format("%d-%b-%Y");
    base_dir.join(format!("{}.csv", date))
}

pub struct Tracker {
    config: Config,
    base_dir: PathBuf,
    writer: Mutex<ActivityWriter>,
}

impl Tracker {
    pub fn new(base_dir: PathBuf, config: Config) -> anyhow::Result<Self> {
        let filename = log_filename(base_dir.clone(), Utc::now().date_naive());
        let writer = ActivityWriter::open(filename)?;
        let writer = Mutex::new(writer);
        Ok(Tracker { base_dir, config, writer })
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        let mut now = Utc::now().naive_utc();
        let mut day = now.date();
        let mut next_tick = Instant::now();
        loop {
            if let Some(activity) = Activity::current() {
                self.track(activity, now).await?;
            }

            next_tick += Duration::from_secs(1);
            tokio::time::sleep_until(next_tick).await;

            now = Utc::now().naive_utc();
            let new_day = now.date();
            if day != new_day {
                self.rotate_to(new_day).await?;
                day = new_day;
            }
        }
    }

    async fn rotate_to(&self, date: NaiveDate) -> anyhow::Result<()> {
        let filename = log_filename(self.base_dir.clone(), date);
        let mut new_writer = ActivityWriter::open(filename)?;
        {
            let mut writer = self.writer.lock().await;
            std::mem::swap(&mut *writer, &mut new_writer);
        }
        Ok(())
    }

    async fn track(&self, activity: Activity, time: NaiveDateTime) -> anyhow::Result<()> {
        // TODO: handle idle

        if let Some(tag) = self.config.tagger.tag(&activity) {
            if self.config.blacklist.contains(tag) {
                // do not track blacklisted activities
                return Ok(());
            }
        }

        self.writer.lock().await.write(activity, time)?;
        Ok(())
    }
}
