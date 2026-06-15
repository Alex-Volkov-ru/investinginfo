ALTER TABLE pf.whiteboards
  ADD COLUMN IF NOT EXISTS zones JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pf.whiteboards.zones IS 'Зоны доски: {id, title, color, x, y, width, height, priority}';
