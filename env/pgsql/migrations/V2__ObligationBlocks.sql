-- V2__ObligationBlocks.sql
-- Блоки обязательств (кредиты) и их платежи

CREATE TABLE IF NOT EXISTS pf.obligation_blocks (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,

    title        TEXT NOT NULL,

    total        NUMERIC(20,2) NOT NULL DEFAULT 0,        -- сумма долга общая
    monthly      NUMERIC(20,2) NOT NULL DEFAULT 0,        -- ежемесячный платёж (план)
    rate         NUMERIC(9,4)  NOT NULL DEFAULT 0,        -- годовая ставка, %
    due_day      INT           NOT NULL DEFAULT 15 CHECK (due_day BETWEEN 1 AND 31),
    next_payment DATE,                                     -- следующая дата платежа
    close_date   DATE,                                     -- плановая дата закрытия
    status       TEXT NOT NULL DEFAULT 'Активный' CHECK (status IN ('Активный','Просрочен','Закрыт')),
    notes        TEXT,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_obl_user      ON pf.obligation_blocks(user_id);
CREATE INDEX IF NOT EXISTS ix_obl_status    ON pf.obligation_blocks(status);
CREATE INDEX IF NOT EXISTS ix_obl_next_date ON pf.obligation_blocks(next_payment);

CREATE TABLE IF NOT EXISTS pf.obligation_payments (
    id              BIGSERIAL PRIMARY KEY,
    obligation_id   BIGINT NOT NULL REFERENCES pf.obligation_blocks(id) ON DELETE CASCADE,

    n               INT    NOT NULL,                       -- № строки
    ok              BOOLEAN NOT NULL DEFAULT false,        -- закрыт ли платёж
    date            DATE,
    amount          NUMERIC(20,2) NOT NULL DEFAULT 0,
    note            TEXT,

    UNIQUE (obligation_id, n)
);

CREATE INDEX IF NOT EXISTS ix_oblp_obl   ON pf.obligation_payments(obligation_id);
CREATE INDEX IF NOT EXISTS ix_oblp_date  ON pf.obligation_payments(date);
