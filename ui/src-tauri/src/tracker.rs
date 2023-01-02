use std::path::PathBuf;
use std::time::Duration;
use std::fs::File;

use anyhow::{anyhow, Result};
use chrono::{Datelike, NaiveDate, NaiveDateTime, Utc};
use tokio::sync::Mutex;
use tokio::time::Instant;

use crate::activity::{self, Activity};

type ActivityWriter = activity::Writer<File>;

fn month_name(month: u32) -> &'static str {
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    match MONTHS.get(month as usize - 1) {
        Some(month) => *month,
        None => "NO_MONTH",
    }
}

fn log_file(base_dir: PathBuf, date: NaiveDate) -> PathBuf {
    let date = format!(
        "{:02}-{}-{}.csv",
        date.day(),
        month_name(date.month()),
        date.year()
    );
    base_dir.join(date)
}

pub struct Tracker {
    base_dir: PathBuf,
    writer: Mutex<ActivityWriter>,
}

impl Tracker {
    pub fn new() -> Result<Self> {
        let base_dir = dirs::home_dir().ok_or_else(|| anyhow!("HOME is not set"))?;
        let base_dir = base_dir.join("trackme");
        #[cfg(debug_assertions)]
        let base_dir = base_dir.join("debug");
        if !base_dir.exists() {
            std::fs::create_dir_all(&base_dir)?;
        }

        let filename = log_file(base_dir.clone(), Utc::now().date_naive());
        let writer = ActivityWriter::open(filename)?;
        let writer = Mutex::new(writer);
        Ok(Tracker { base_dir, writer })
    }

    pub async fn run(&self) -> Result<()> {
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

    async fn rotate_to(&self, date: NaiveDate) -> Result<()> {
        let filename = log_file(self.base_dir.clone(), date);
        let mut new_writer = ActivityWriter::open(filename)?;
        {
            let mut writer = self.writer.lock().await;
            std::mem::swap(&mut *writer, &mut new_writer);
        }
        Ok(())
    }

    async fn track(&self, activity: Activity, time: NaiveDateTime) -> Result<()> {
        // TODO: idle
        // TODO: blacklist
        self.writer.lock().await.write(activity, time)?;
        Ok(())
    }
}
