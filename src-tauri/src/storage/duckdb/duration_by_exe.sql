-- the cast is required: DuckDB's sum(bigint) returns HUGEINT (int128), which
-- does not decode into an i64
select exe, cast(sum(end_ms - begin_ms) as bigint) as duration
from activities
where ? <= begin_ms and begin_ms < ?
group by exe;
