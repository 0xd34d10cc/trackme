select value from generate_series(
    (select min(begin) - (min(begin) % 86400000) from activities),
    (select max(begin) from activities),
    86400000
)
where exists(
    select * from activities
    where begin between value and value+86400000 limit 1
);