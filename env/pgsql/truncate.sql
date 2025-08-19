DO $$
DECLARE
    table_rec record;
BEGIN
    FOR table_rec IN 
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'esia'
        AND tablename != 'flyway_schema_history'
    LOOP
        EXECUTE 'TRUNCATE TABLE ' || table_rec.tablename || ' CASCADE;';
        RAISE NOTICE 'Очищена таблица: %', table_rec.tablename;
    END LOOP;
    
    DELETE FROM flyway_schema_history WHERE version != '1';
    RAISE NOTICE 'Очищена таблица flyway_schema_history, кроме версии 1';
END $$;