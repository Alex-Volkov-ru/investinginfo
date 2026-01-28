-- Добавление поля is_staff для разграничения прав доступа
-- is_staff = true означает административные права

ALTER TABLE pf.users
  ADD COLUMN IF NOT EXISTS is_staff BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN pf.users.is_staff IS 
  'Флаг администратора. true = пользователь имеет административные права доступа';

CREATE INDEX IF NOT EXISTS idx_users_is_staff ON pf.users(is_staff);
