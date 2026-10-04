-- DuckDB defaults to ~80% of RAM and every core; a background tray app must not.
set memory_limit = '256MB';
set threads = 2;
-- Keep appended rows physically in time order. Zone maps (min/max per row group)
-- are what prune the `begin_ms` range scans, so reordering would defeat them.
set preserve_insertion_order = true;
-- The tracker writes on activity change (~2 rows/minute), so checkpoints are rare
-- either way; naming the threshold keeps the intent explicit.
set wal_autocheckpoint = '16MB';
