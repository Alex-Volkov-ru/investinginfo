-- Расширения (почта без учета регистра удобно)
CREATE EXTENSION IF NOT EXISTS citext;

-- ===== USERS/AUTH =====
CREATE TABLE pf.users (
  id            BIGSERIAL PRIMARY KEY,
  email         CITEXT NOT NULL UNIQUE,
  password_hash TEXT   NOT NULL,
  phone         TEXT,
  tg_username   TEXT,
  tg_chat_id    BIGINT,
  tinkoff_token_enc TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE pf.api_tokens (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
  token_hash   TEXT   NOT NULL,
  label        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX api_tokens_user_idx ON pf.api_tokens(user_id);

-- ===== INSTRUMENTS (каталог бумаг) =====
CREATE TABLE pf.instruments (
  figi      TEXT PRIMARY KEY,
  ticker    TEXT,
  class     TEXT CHECK (class IN ('share','bond','etf','other')),
  name      TEXT,
  currency  CHAR(3),
  isin      TEXT,
  nominal   NUMERIC(18,4)    -- для облигаций
);
CREATE INDEX instruments_ticker_idx ON pf.instruments(upper(ticker));

-- ===== PORTFOLIOS (кошельки пользователя) =====
CREATE TABLE pf.portfolios (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
  title      TEXT   NOT NULL,
  type       TEXT   DEFAULT 'broker',   -- broker/bank/crypto/...
  currency   CHAR(3) DEFAULT 'RUB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portfolios_user_idx ON pf.portfolios(user_id);

-- ===== POSITIONS (агрегированная позиция) =====
CREATE TABLE pf.positions (
  id            BIGSERIAL PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES pf.portfolios(id) ON DELETE CASCADE,
  figi          TEXT   NOT NULL REFERENCES pf.instruments(figi) ON UPDATE CASCADE,
  quantity      NUMERIC(20,6) NOT NULL DEFAULT 0,
  avg_price     NUMERIC(20,6) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, figi)
);
CREATE INDEX positions_portfolio_idx ON pf.positions(portfolio_id);
CREATE INDEX positions_figi_idx      ON pf.positions(figi);

-- ===== TRADES (история сделок) =====
CREATE TABLE pf.trades (
  id            BIGSERIAL PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES pf.portfolios(id) ON DELETE CASCADE,
  figi          TEXT   NOT NULL REFERENCES pf.instruments(figi),
  side          SMALLINT NOT NULL CHECK (side IN (-1,1)),   -- -1 SELL, 1 BUY
  quantity      NUMERIC(20,6) NOT NULL CHECK (quantity > 0),
  price         NUMERIC(20,6) NOT NULL CHECK (price >= 0),
  fee           NUMERIC(20,6) NOT NULL DEFAULT 0,
  trade_at      TIMESTAMPTZ   NOT NULL,
  source        TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX trades_portfolio_idx ON pf.trades(portfolio_id);
CREATE INDEX trades_figi_idx      ON pf.trades(figi);
CREATE INDEX trades_dt_idx        ON pf.trades(trade_at);

-- ===== CASH MOVEMENTS (пополнения/вывод/дивы/купоны) =====
CREATE TABLE pf.cash_movements (
  id            BIGSERIAL PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES pf.portfolios(id) ON DELETE CASCADE,
  type          TEXT   NOT NULL CHECK (type IN ('deposit','withdraw','coupon','dividend','interest','fee')),
  amount        NUMERIC(20,2) NOT NULL,
  currency      CHAR(3) DEFAULT 'RUB',
  occurred_at   TIMESTAMPTZ NOT NULL,
  note          TEXT
);
CREATE INDEX cash_movements_portfolio_idx ON pf.cash_movements(portfolio_id);
CREATE INDEX cash_movements_dt_idx        ON pf.cash_movements(occurred_at);

-- ===== WATCHLIST (по желанию) =====
CREATE TABLE pf.watchlist (
  id        BIGSERIAL PRIMARY KEY,
  user_id   BIGINT NOT NULL REFERENCES pf.users(id) ON DELETE CASCADE,
  figi      TEXT   NOT NULL REFERENCES pf.instruments(figi),
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, figi)
);

-- ===== Утилитарная VIEW: базовая стоимость позиций =====
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
