use crate::activity::Activity;

use chrono::NaiveDateTime;
use serde::{ser::SerializeTuple, Serialize, Serializer};

#[derive(Debug)]
pub struct Entry {
    pub begin: NaiveDateTime,
    pub end: NaiveDateTime,
    pub activity: Activity,
}

impl Entry {
    pub fn new(activity: Activity, time: NaiveDateTime) -> Self {
        Entry {
            activity,
            begin: time,
            end: time,
        }
    }
}

impl Serialize for Entry {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut tuple = serializer.serialize_tuple(5)?;
        tuple.serialize_element(&self.begin.timestamp_millis())?;
        tuple.serialize_element(&self.end.timestamp_millis())?;
        tuple.serialize_element(&self.activity.pid)?;
        tuple.serialize_element(&self.activity.exe)?;
        tuple.serialize_element(&self.activity.title)?;
        tuple.end()
    }
}
