-- Дата начала начисления процентов (обычно дата выдачи кредита)
ALTER TABLE pf.obligation_blocks
  ADD COLUMN IF NOT EXISTS start_date DATE;

CREATE INDEX IF NOT EXISTS ix_obl_start_date
  ON pf.obligation_blocks(start_date);
