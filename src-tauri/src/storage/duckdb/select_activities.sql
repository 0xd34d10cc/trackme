-- Half-open overlap against [from_ms, to_ms): a row belongs to the window when
-- it starts before the window ends and ends after the window begins. This
-- captures rows that cross a day boundary (e.g. an overnight idle block written
-- as a single 23:00 -> 08:00 row); callers clip them to the window before
-- summing durations or rendering.
-- ?1 = to_ms, ?2 = from_ms
select begin_ms, end_ms, pid, exe, title
from activities
where begin_ms < ?
  and end_ms > ?
order by begin_ms;
