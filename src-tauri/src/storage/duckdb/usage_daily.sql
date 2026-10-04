-- Per (UTC day, exe) recorded duration over the half-open window [$from_ms, $to_ms).
--
-- Rows are clipped to the window; the day bucket is the day of begin_ms, which
-- assumes no row spans a UTC midnight. The tracker can currently write an
-- overnight idle block as one 23:00 -> 08:00 row; such a row is attributed
-- wholly to its start day until the data is split at midnight upstream, after
-- which this query becomes correct without changing.
--
-- Idle is not special here: it is the row with exe = 'idle'.
--
-- Named placeholders on purpose: select_activities.sql is a positional overlap
-- predicate whose params are (to, from) -- the reverse of this file's reading
-- order. Naming them removes the footgun instead of copying it.
--
-- sum() over BIGINT yields HUGEINT in DuckDB, which duckdb-rs cannot decode
-- into i64; the cast back to BIGINT is required. count(*) is already BIGINT.
with clipped as (
    select exe,
           begin_ms - (begin_ms % 86400000) as day_ms,
           least(end_ms, $to_ms) - greatest(begin_ms, $from_ms) as dur
    from activities
    where begin_ms < $to_ms
      and end_ms > $from_ms
)
select day_ms,
       exe,
       cast(sum(dur) as bigint) as duration_ms,
       count(*) as interval_count
from clipped
group by day_ms, exe
order by day_ms, exe;
