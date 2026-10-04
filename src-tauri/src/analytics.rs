use serde::Serialize;

/// One (UTC day, exe) aggregate, produced by `usage_daily.sql`.
///
/// `duration_ms` is recorded time — active for a real application, idle time
/// for the synthetic `exe = "idle"` row. Idle is a normal row here, exactly as
/// it is everywhere else in the app, so callers filter it out of "active"
/// totals the same way the daily view does.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyUsage {
    /// UTC midnight of the day, epoch ms.
    pub day_ms: i64,
    /// Raw executable path; the literal "idle" for idle blocks.
    pub exe: String,
    /// Recorded duration, clipped to the query window.
    pub duration_ms: i64,
    /// Number of activity rows on this day for this exe.
    pub interval_count: i64,
}
