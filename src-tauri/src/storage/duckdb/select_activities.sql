select begin_ms, end_ms, pid, exe, title
from activities
where ? <= begin_ms and begin_ms < ?;
