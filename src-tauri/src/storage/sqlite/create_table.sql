create table if not exists
    activities (
        begin integer,
        end integer,
        pid integer,
        exe text,
        title text
    );
create index if not exists begin_index on activities (begin asc);