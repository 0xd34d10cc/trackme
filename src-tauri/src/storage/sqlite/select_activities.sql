select begin, end, pid, exe, title
from activities
where ? <= begin and begin < ?;