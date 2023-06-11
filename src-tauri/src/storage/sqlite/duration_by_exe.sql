select exe, sum(end - begin) as duration
from activities
where ? <= begin and begin < ?
group by exe;