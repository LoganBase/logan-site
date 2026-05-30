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
