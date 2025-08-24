-- Транзакция + локально ставим search_path на нужную схему
BEGIN;
SET LOCAL search_path TO pf;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = current_schema()
          AND tablename <> 'flyway_schema_history'
    LOOP
        EXECUTE format('TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE;',
                       current_schema(), r.tablename);
        RAISE NOTICE 'Очищена таблица: %.%', current_schema(), r.tablename;
    END LOOP;
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'flyway_schema_history'
    ) THEN
        EXECUTE 'DELETE FROM flyway_schema_history WHERE version <> ''1'';';
        RAISE NOTICE 'Очищена таблица flyway_schema_history (кроме версии 1)';
    ELSE
        RAISE NOTICE 'Таблица flyway_schema_history не найдена в схеме %', current_schema();
    END IF;
END $$;

COMMIT;
