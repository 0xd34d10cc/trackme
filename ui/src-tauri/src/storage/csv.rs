use std::fs::{self, File};
use std::path::PathBuf;

use async_trait::async_trait;
use chrono::{NaiveDate, NaiveDateTime};
use tokio::sync::Mutex;
use serde::{Serializer, Serialize};

use crate::activity::{Activity, Entry as ActivityEntry};

fn serialize_datetime<S>(datetime: &NaiveDateTime, s: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let formatted = format!("{}", datetime.format("%Y-%m-%d %H:%M:%S.%f"));
    s.serialize_str(&formatted)
}

#[derive(Serialize)]
struct CsvEntry {
    #[serde(serialize_with = "serialize_datetime")]
    begin: NaiveDateTime,
    #[serde(serialize_with = "serialize_datetime")]
    end: NaiveDateTime,
    activity: Activity,
}

impl From<ActivityEntry> for CsvEntry {
    fn from(entry: ActivityEntry) -> Self {
        Self {
            begin: entry.begin,
            end: entry.end,
            activity: entry.activity
        }
    }
}

struct LogFile {
    date: NaiveDate,
    writer: csv::Writer<File>,
}

impl LogFile {
    pub fn open(dir: PathBuf, date: NaiveDate) -> anyhow::Result<Self> {
        let filename = dir.join(format!("{}.csv", date.format("%d-%b-%Y")));
        let file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(filename)?;
        let writer = csv::WriterBuilder::new()
            .has_headers(false)
            .from_writer(file);

        Ok(LogFile { date, writer })
    }

    // FIXME: not async
    pub fn write(&mut self, entry: ActivityEntry) -> anyhow::Result<()> {
        let entry = CsvEntry::from(entry);
        self.writer.serialize(&entry)?;
        self.writer.flush()?;
        Ok(())
    }
}

pub struct Storage {
    dir: PathBuf,
    current: Mutex<Option<LogFile>>,
}

impl Storage {
    pub fn open(dir: PathBuf) -> anyhow::Result<Self> {
        if !dir.exists() {
            std::fs::create_dir_all(&dir)?;
        }

        Ok(Storage {
            dir,
            current: Mutex::new(None),
        })
    }
}

#[async_trait]
impl super::Storage for Storage {
    async fn store(&self, entry: ActivityEntry) -> anyhow::Result<()> {
        let date = entry.begin.date();
        let mut current = self.current.lock().await;
        if let Some(current) = current.as_mut() {
            if current.date == date {
                current.write(entry)?;
                return Ok(())
            }
        }

        let new_file = LogFile::open(self.dir.clone(), date)?;
        *current = Some(new_file);
        if let Some(current) = current.as_mut() {
            current.write(entry)?;
        }

        Ok(())
    }
}
