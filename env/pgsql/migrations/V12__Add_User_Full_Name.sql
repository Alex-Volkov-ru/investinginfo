ALTER TABLE pf.users
    ADD COLUMN IF NOT EXISTS full_name TEXT;

UPDATE pf.users
SET full_name = COALESCE(
    NULLIF(BTRIM(full_name), ''),
    NULLIF(BTRIM(tg_username), ''),
    NULLIF(SPLIT_PART(email::text, '@', 1), ''),
    'Пользователь'
);

ALTER TABLE pf.users
    ALTER COLUMN full_name SET NOT NULL;
