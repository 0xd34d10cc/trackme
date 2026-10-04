-- one row per UTC day that contains an activity, expressed as that day's
-- epoch-ms midnight
select distinct begin_ms - (begin_ms % 86400000) as day
from activities
order by day;
