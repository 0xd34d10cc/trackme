use crate::activity::Activity;
use chrono::NaiveDateTime;

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
