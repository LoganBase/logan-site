-- Market Hub — Database Schema
-- Compatible with SQLite (local seed) and Cloudflare D1 (production)

CREATE TABLE IF NOT EXISTS daily_prices (
  symbol    TEXT    NOT NULL,
  date      TEXT    NOT NULL,   -- YYYY-MM-DD
  open      REAL,
  high      REAL,
  low       REAL,
  close     REAL,
  volume    INTEGER,
  PRIMARY KEY (symbol, date)
);

CREATE TABLE IF NOT EXISTS indicators (
  symbol      TEXT    NOT NULL,
  date        TEXT    NOT NULL,
  sma50       REAL,
  sma200      REAL,
  rsi14       REAL,
  roc10       REAL,             -- 10-day rate of change (%)
  vs200_pct   REAL,             -- % distance from 200d SMA
  percentile  REAL,             -- historical percentile rank of vs200_pct
  PRIMARY KEY (symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_prices_symbol_date ON daily_prices (symbol, date DESC);
CREATE INDEX IF NOT EXISTS idx_indicators_symbol_date ON indicators (symbol, date DESC);

CREATE TABLE IF NOT EXISTS shiller_data (
  date     TEXT PRIMARY KEY,
  price    REAL,
  earnings REAL,
  dividend REAL,
  cape     REAL
);

CREATE INDEX IF NOT EXISTS idx_shiller_date ON shiller_data (date DESC);

CREATE TABLE IF NOT EXISTS buffett_data (
  date       TEXT PRIMARY KEY,   -- YYYY-MM-DD (quarter start)
  market_cap REAL,               -- billions USD (nonfinancial equities, FRED Z.1)
  gdp        REAL,               -- billions USD (SAAR)
  ratio      REAL                -- market_cap / gdp * 100 (%)
);

CREATE INDEX IF NOT EXISTS idx_buffett_date ON buffett_data (date DESC);

CREATE TABLE IF NOT EXISTS forward_pe_data (
  date TEXT PRIMARY KEY,   -- YYYY-MM-DD (monthly)
  pe   REAL                -- S&P 500 forward P/E estimate
);

CREATE INDEX IF NOT EXISTS idx_forward_pe_date ON forward_pe_data (date DESC);

CREATE TABLE IF NOT EXISTS japan_pe_data (
  date TEXT PRIMARY KEY,   -- YYYY-MM-DD (monthly)
  pe   REAL                -- Nikkei 225 TTM P/E ratio
);

CREATE INDEX IF NOT EXISTS idx_japan_pe_date ON japan_pe_data (date DESC);
