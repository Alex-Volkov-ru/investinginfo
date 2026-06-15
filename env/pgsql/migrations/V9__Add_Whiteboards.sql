-- Бюджетные доски: свободное планирование расходов
CREATE TABLE IF NOT EXISTS pf.whiteboards (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Новая доска',
  budget      NUMERIC(20, 2) NOT NULL DEFAULT 0,
  items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  canvas_data TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whiteboards_user_idx ON pf.whiteboards(user_id);
CREATE INDEX IF NOT EXISTS whiteboards_user_updated_idx ON pf.whiteboards(user_id, updated_at DESC);

COMMENT ON TABLE pf.whiteboards IS 'Интерактивные бюджетные доски пользователя';
COMMENT ON COLUMN pf.whiteboards.items IS 'Массив карточек: {id, title, amount, x, y}';
COMMENT ON COLUMN pf.whiteboards.canvas_data IS 'Рисунок (base64 PNG) или null';
