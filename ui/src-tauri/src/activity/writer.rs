use std::path::PathBuf;
use std::fs::{self, File};
use std::io::Write;

use serde::{Serialize, Serializer};
use chrono::NaiveDateTime;
use anyhow::Result;

use super::Activity;

fn serialize_datetime<S>(datetime: &NaiveDateTime, s: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let formatted = format!("{}", datetime.format("%Y-%m-%d %H:%M:%S.%f"));
    s.serialize_str(&formatted)
}

#[derive(Serialize)]
struct ActivityEntry {
    #[serde(serialize_with = "serialize_datetime")]
    begin: NaiveDateTime,
    #[serde(serialize_with = "serialize_datetime")]
    end: NaiveDateTime,
    activity: Activity,
}

impl ActivityEntry {
    fn new(activity: Activity, time: NaiveDateTime) -> Self {
        ActivityEntry {
            activity,
            begin: time,
            end: time,
        }
    }
}

pub struct Writer<W: Write> {
    current: Option<ActivityEntry>,
    writer: csv::Writer<W>,
}

impl Writer<File> {
    pub fn open(filename: PathBuf) -> Result<Self> {
        let file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(filename)?;
        let writer = csv::WriterBuilder::new()
            .has_headers(false)
            .from_writer(file);
        Ok(Self {
            current: None,
            writer,
        })
    }

}

impl<W: Write> Writer<W> {
    pub fn write(&mut self, activity: Activity, time: NaiveDateTime) -> Result<()> {
        match self.current.as_mut() {
            Some(current) => {
                current.end = time;
                if current.activity == activity {
                    return Ok(());
                }

                let prev = std::mem::replace(current, ActivityEntry::new(activity, time));
                self.write_entry(&prev)?;
            }
            None => {
                self.current = Some(ActivityEntry::new(activity, time));
            }
        }

        Ok(())
    }

    fn write_entry(&mut self, entry: &ActivityEntry) -> Result<()> {
        self.writer.serialize(entry)?;
        self.writer.flush()?;
        Ok(())
    }

    pub fn flush(&mut self) -> Result<()> {
        if let Some(activity) = self.current.take() {
            self.write_entry(&activity)?;
        }

        Ok(())
    }
}

impl<W: Write> Drop for Writer<W> {
    fn drop(&mut self) {
        let _ = self.flush();
    }
}
