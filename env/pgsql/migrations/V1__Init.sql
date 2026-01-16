CREATE SCHEMA IF NOT EXISTS pf;
-- регистронезависимые email
CREATE EXTENSION IF NOT EXISTS citext;

-- 1) USERS / AUTH
CREATE TABLE IF NOT EXISTS pf.users (
  id                BIGSERIAL PRIMARY KEY,
  email             CITEXT NOT NULL UNIQUE,
  password_hash     TEXT   NOT NULL,
  phone             TEXT,
  tg_username       TEXT,
  tg_chat_id        BIGINT,
  tinkoff_token_enc TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pf.api_tokens (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
  token_hash    TEXT   NOT NULL,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS api_tokens_user_idx ON pf.api_tokens(user_id);

-- 2) INSTRUMENTS
CREATE TABLE IF NOT EXISTS pf.instruments (
  figi      TEXT PRIMARY KEY,
  ticker    TEXT,
  class     TEXT CHECK (class IN ('share','bond','etf','other')),
  name      TEXT,
  currency  CHAR(3),
  isin      TEXT,
  nominal   NUMERIC(18,4)
);
CREATE INDEX IF NOT EXISTS instruments_ticker_idx ON pf.instruments(upper(ticker));

-- 3) PORTFOLIOS
CREATE TABLE IF NOT EXISTS pf.portfolios (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
  title      TEXT   NOT NULL,
  type       TEXT   DEFAULT 'broker',
  currency   CHAR(3) DEFAULT 'RUB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portfolios_user_idx ON pf.portfolios(user_id);

-- 4) POSITIONS
CREATE TABLE IF NOT EXISTS pf.positions (
  id            BIGSERIAL PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES pf.portfolios(id) ON DELETE CASCADE,
  figi          TEXT   NOT NULL REFERENCES pf.instruments(figi) ON UPDATE CASCADE,
  quantity      NUMERIC(20,6) NOT NULL DEFAULT 0,
  avg_price     NUMERIC(20,6) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, figi)
);
CREATE INDEX IF NOT EXISTS positions_portfolio_idx ON pf.positions(portfolio_id);
CREATE INDEX IF NOT EXISTS positions_figi_idx      ON pf.positions(figi);

-- 5) TRADES
CREATE TABLE IF NOT EXISTS pf.trades (
  id            BIGSERIAL PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES pf.portfolios(id) ON DELETE CASCADE,
  figi          TEXT   NOT NULL REFERENCES pf.instruments(figi),
  side          SMALLINT NOT NULL CHECK (side IN (-1,1)),
  quantity      NUMERIC(20,6) NOT NULL CHECK (quantity > 0),
  price         NUMERIC(20,6) NOT NULL CHECK (price >= 0),
  fee           NUMERIC(20,6) NOT NULL DEFAULT 0,
  trade_at      TIMESTAMPTZ   NOT NULL,
  source        TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trades_portfolio_idx ON pf.trades(portfolio_id);
CREATE INDEX IF NOT EXISTS trades_figi_idx      ON pf.trades(figi);
CREATE INDEX IF NOT EXISTS trades_dt_idx        ON pf.trades(trade_at);

-- 6) CASH MOVEMENTS
CREATE TABLE IF NOT EXISTS pf.cash_movements (
  id            BIGSERIAL PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES pf.portfolios(id) ON DELETE CASCADE,
  type          TEXT   NOT NULL CHECK (type IN ('deposit','withdraw','coupon','dividend','interest','fee')),
  amount        NUMERIC(20,2) NOT NULL,
  currency      CHAR(3) DEFAULT 'RUB',
  occurred_at   TIMESTAMPTZ NOT NULL,
  note          TEXT
);
CREATE INDEX IF NOT EXISTS cash_movements_portfolio_idx ON pf.cash_movements(portfolio_id);
CREATE INDEX IF NOT EXISTS cash_movements_dt_idx        ON pf.cash_movements(occurred_at);

-- 7) WATCHLIST
CREATE TABLE IF NOT EXISTS pf.watchlist (
  id        BIGSERIAL PRIMARY KEY,
  user_id   BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
  figi      TEXT   NOT NULL REFERENCES pf.instruments(figi),
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, figi)
);

-- 8) VIEW: краткая сводка позиций
CREATE OR REPLACE VIEW pf.v_positions_brief AS
SELECT
  p.id               AS position_id,
  p.portfolio_id,
  f.title            AS portfolio_title,
  p.figi,
  i.ticker,
  i.name,
  i.class,
  i.currency,
  p.quantity,
  p.avg_price,
  (p.quantity * p.avg_price) AS cost_base
FROM pf.positions p
JOIN pf.portfolios f ON f.id = p.portfolio_id
JOIN pf.instruments i ON i.figi = p.figi;

-- ========= БЮДЖЕТИРОВАНИЕ =========

-- 9) BUDGET_ACCOUNTS
CREATE TABLE IF NOT EXISTS pf.budget_accounts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
  title       TEXT   NOT NULL,
  currency    CHAR(3) NOT NULL DEFAULT 'RUB',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS budget_accounts_user_idx ON pf.budget_accounts(user_id);

-- 10) BUDGET_CATEGORIES
CREATE TABLE IF NOT EXISTS pf.budget_categories (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
  kind        TEXT   NOT NULL CHECK (kind IN ('income','expense')),
  name        TEXT   NOT NULL,
  parent_id   BIGINT REFERENCES pf.budget_categories(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, name)
);
CREATE INDEX IF NOT EXISTS budget_categories_user_idx   ON pf.budget_categories(user_id);
CREATE INDEX IF NOT EXISTS budget_categories_kind_idx   ON pf.budget_categories(kind);
CREATE INDEX IF NOT EXISTS budget_categories_parent_idx ON pf.budget_categories(parent_id);

-- 11) BUDGET_TRANSACTIONS
CREATE TABLE IF NOT EXISTS pf.budget_transactions (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
  account_id        BIGINT NOT NULL REFERENCES pf.budget_accounts(id) ON DELETE CASCADE,
  category_id       BIGINT REFERENCES pf.budget_categories(id) ON DELETE SET NULL,
  type              TEXT   NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount            NUMERIC(20,2) NOT NULL CHECK (amount >= 0),
  currency          CHAR(3) NOT NULL DEFAULT 'RUB',
  occurred_at       TIMESTAMPTZ NOT NULL,
  description       TEXT,
  contra_account_id BIGINT REFERENCES pf.budget_accounts(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS budget_tx_user_idx     ON pf.budget_transactions(user_id);
CREATE INDEX IF NOT EXISTS budget_tx_account_idx  ON pf.budget_transactions(account_id);
CREATE INDEX IF NOT EXISTS budget_tx_category_idx ON pf.budget_transactions(category_id);
CREATE INDEX IF NOT EXISTS budget_tx_occurred_idx ON pf.budget_transactions(occurred_at);
CREATE INDEX IF NOT EXISTS budget_tx_type_idx     ON pf.budget_transactions(type);

-- 12) VIEW: баланс по счёту (доходы-расходы)
CREATE OR REPLACE VIEW pf.v_budget_balance_by_account AS
SELECT
  a.id          AS account_id,
  a.user_id,
  a.title       AS account_title,
  a.currency,
  COALESCE(SUM(
    CASE WHEN t.type = 'income'  THEN t.amount
         WHEN t.type = 'expense' THEN -t.amount
         ELSE 0
    END
  ), 0.00)      AS balance_delta
FROM pf.budget_accounts a
LEFT JOIN pf.budget_transactions t
  ON t.account_id = a.id
GROUP BY a.id, a.user_id, a.title, a.currency;

-- 13) VIEW: своды по пользователю
CREATE OR REPLACE VIEW pf.v_budget_totals_by_user AS
SELECT
  u.id AS user_id,
  COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount END), 0.00) AS income_total,
  COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END), 0.00) AS expense_total,
  COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount
                    WHEN t.type='expense' THEN -t.amount END), 0.00) AS net_total
FROM pf.users u
LEFT JOIN pf.budget_transactions t ON t.user_id = u.id
GROUP BY u.id;

-- ============================================================
-- Дополнения: накопительные + обязательства + хелперы графиков
-- ============================================================

-- (A) Флаг накопительного счёта
ALTER TABLE pf.budget_accounts
  ADD COLUMN IF NOT EXISTS is_savings boolean NOT NULL DEFAULT false;

-- (B) Обязательные платежи
DROP TABLE IF EXISTS pf.budget_obligations CASCADE;
CREATE TABLE pf.budget_obligations (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
    title        TEXT        NOT NULL,
    due_date     DATE        NOT NULL,
    amount       NUMERIC(20,2) NOT NULL CHECK (amount >= 0),
    currency     CHAR(3)     NOT NULL DEFAULT 'RUB',
    is_done      BOOLEAN     NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_budget_obligations_user_date
    ON pf.budget_obligations (user_id, due_date);
CREATE INDEX IF NOT EXISTS ix_budget_obligations_user_done
    ON pf.budget_obligations (user_id, is_done);

-- (C) Вьюха: сумма переводов на накопительные счета
DROP VIEW IF EXISTS pf.v_budget_savings_transferred CASCADE;
CREATE VIEW pf.v_budget_savings_transferred AS
SELECT
    t.user_id,
    DATE_TRUNC('day', t.occurred_at)::date AS d,
    SUM(t.amount) AS amount
FROM pf.budget_transactions t
JOIN pf.budget_accounts a ON a.id = t.contra_account_id
WHERE t.type = 'transfer'
  AND a.is_savings = true
GROUP BY 1,2;

-- (D) Агрегации для графиков
DROP VIEW IF EXISTS pf.v_budget_income_by_category CASCADE;
CREATE VIEW pf.v_budget_income_by_category AS
SELECT
    t.user_id,
    c.name AS category,
    SUM(t.amount) AS amount
FROM pf.budget_transactions t
JOIN pf.budget_categories c ON c.id = t.category_id
WHERE t.type = 'income'
GROUP BY 1,2;

DROP VIEW IF EXISTS pf.v_budget_expense_by_category CASCADE;
CREATE VIEW pf.v_budget_expense_by_category AS
SELECT
    t.user_id,
    c.name AS category,
    SUM(t.amount) AS amount
FROM pf.budget_transactions t
JOIN pf.budget_categories c ON c.id = t.category_id
WHERE t.type = 'expense'
GROUP BY 1,2;

DROP VIEW IF EXISTS pf.v_budget_expense_by_day CASCADE;
CREATE VIEW pf.v_budget_expense_by_day AS
SELECT
    t.user_id,
    DATE_TRUNC('day', t.occurred_at)::date AS d,
    SUM(t.amount) AS amount
FROM pf.budget_transactions t
WHERE t.type = 'expense'
GROUP BY 1,2;

-- ===== Автосоздание бюджетных счетов пользователю =====
CREATE OR REPLACE FUNCTION pf.ensure_default_budget_accounts()
RETURNS trigger AS $$
BEGIN
  -- Создаем обычный счет
  INSERT INTO pf.budget_accounts(user_id, title, currency, is_savings)
  VALUES (NEW.id, 'Основной счёт', 'RUB', false);
  
  -- Создаем счет сбережений
  INSERT INTO pf.budget_accounts(user_id, title, currency, is_savings)
  VALUES (NEW.id, 'Сбережения', 'RUB', true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_default_budget_accounts ON pf.users;
CREATE TRIGGER trg_users_default_budget_accounts
AFTER INSERT ON pf.users
FOR EACH ROW EXECUTE FUNCTION pf.ensure_default_budget_accounts();

-- Разовая инициализация для уже существующих пользователей
INSERT INTO pf.budget_accounts (user_id, title, currency, is_savings)
SELECT u.id, 'Основной счёт', 'RUB', false
FROM pf.users u
LEFT JOIN pf.budget_accounts a ON a.user_id = u.id AND a.is_savings = false
WHERE a.id IS NULL;

INSERT INTO pf.budget_accounts (user_id, title, currency, is_savings)
SELECT u.id, 'Сбережения', 'RUB', true
FROM pf.users u
LEFT JOIN pf.budget_accounts a ON a.user_id = u.id AND a.is_savings = true
WHERE a.id IS NULL;
