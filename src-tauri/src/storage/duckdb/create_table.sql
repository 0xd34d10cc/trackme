create table if not exists
    activities (
        begin_ms bigint,
        end_ms bigint,
        pid bigint,
        exe varchar,
        title varchar
    );
