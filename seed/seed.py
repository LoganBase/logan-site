"""
Market Hub — Historical Data Seeder
Run once to bulk-download 5 years of split-adjusted daily OHLCV data
via yfinance and persist to SQLite. From there, upload to Cloudflare D1.

Usage:
  pip install -r requirements.txt
  python seed.py

Upload to D1 (after seeding):
  npx wrangler d1 execute market-hub-db --local --file=./export.sql
  npx wrangler d1 execute market-hub-db --remote --file=./export.sql
"""

import yfinance as yf
import sqlite3
import os
import sys
import pandas as pd
from datetime import datetime, timedelta

# ── CONFIG ────────────────────────────────────────────────────────────────────
DB_PATH   = os.path.join(os.path.dirname(__file__), 'market_hub.db')
SEED_YEARS = 5
START     = (datetime.now() - timedelta(days=365 * SEED_YEARS)).strftime('%Y-%m-%d')
END       = datetime.now().strftime('%Y-%m-%d')

SYMBOLS = [
    # Regime
    'SPY',
    # Leadership
    'QQQ', 'RSP', 'QQEW', 'IVW', 'IVE',
    # Breadth proxy
    'RSPD',
    # Yields
    '^TYX', '^TNX', 'TLT', 'UUP',
    # Global Flows
    '^GSPTSE', 'SPDW', 'EWT', 'EWY', 'AIA', 'EZU', 'VEU', 'EEM',
    '^N225', 'EWW', 'EWZ', 'ILF',
    # Sectors
    'XLI', 'XLK', 'XLF', 'XLE', 'XLU', 'XLRE', 'XLP',
    'XME', 'GDX', 'COPX', 'KBE',
    # Commodities
    'USCI', 'HG=F', 'GLD', 'IXC', 'XES', 'DBA', 'SLX',
    # Equities
    'GEV', 'CAT', 'GRID', 'SU', 'TVE.TO', 'RIO', 'CCO.TO',
    'AEM', 'LRCX', 'SITM', 'SOXX', 'ZEB.TO',
]

# ── DATABASE ──────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(conn):
    schema = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema) as f:
        conn.executescript(f.read())
    conn.commit()

# ── INDICATORS ────────────────────────────────────────────────────────────────
def calc_sma(closes, period):
    if len(closes) < period:
        return None
    return sum(closes[-period:]) / period

def calc_rsi_series(closes, period=14):
    """Wilder's smoothed RSI — returns a list aligned with closes."""
    n = len(closes)
    results = [None] * n
    if n < period + 1:
        return results

    gains = [max(closes[i] - closes[i-1], 0) for i in range(1, n)]
    losses = [max(closes[i-1] - closes[i], 0) for i in range(1, n)]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    rs = avg_gain / avg_loss if avg_loss else float('inf')
    results[period] = 100 - 100 / (1 + rs)

    for i in range(period + 1, n):
        avg_gain = (avg_gain * (period - 1) + gains[i - 1]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i - 1]) / period
        rs = avg_gain / avg_loss if avg_loss else float('inf')
        results[i] = 100 - 100 / (1 + rs)

    return results

def compute_indicators(conn, symbol):
    rows = conn.execute(
        'SELECT date, close FROM daily_prices WHERE symbol=? AND close IS NOT NULL ORDER BY date',
        (symbol,)
    ).fetchall()
    if len(rows) < 15:
        return

    dates  = [r['date']  for r in rows]
    closes = [r['close'] for r in rows]
    n      = len(closes)
    rsi_series = calc_rsi_series(closes)

    # Percentile rank of vs200_pct values (for context)
    vs200_all = []
    for i in range(n):
        if i >= 199:
            sma200 = sum(closes[i-199:i+1]) / 200
            vs200_all.append(((closes[i] - sma200) / sma200) * 100)
        else:
            vs200_all.append(None)

    indicator_rows = []
    for i in range(n):
        if i < 14:
            continue
        price  = closes[i]
        sma50  = sum(closes[max(0, i-49):i+1]) / min(i+1, 50)  if i >= 49  else None
        sma200 = sum(closes[i-199:i+1]) / 200                   if i >= 199 else None
        vs200  = ((price - sma200) / sma200 * 100)              if sma200   else None
        rsi14  = rsi_series[i]
        roc10  = ((price / closes[i-10]) - 1) * 100             if i >= 10  else None

        # Percentile rank: % of historical vs200 values <= current
        if vs200 is not None:
            valid_hist = [v for v in vs200_all[:i+1] if v is not None]
            pct = sum(1 for v in valid_hist if v <= vs200) / len(valid_hist) * 100 if valid_hist else None
        else:
            pct = None

        indicator_rows.append((symbol, dates[i], sma50, sma200, rsi14, roc10, vs200, pct))

    conn.executemany('''
        INSERT OR REPLACE INTO indicators
          (symbol, date, sma50, sma200, rsi14, roc10, vs200_pct, percentile)
        VALUES (?,?,?,?,?,?,?,?)
    ''', indicator_rows)
    conn.commit()
    print(f'    indicators computed for {len(indicator_rows)} rows')

# ── SEEDER ────────────────────────────────────────────────────────────────────
def seed_symbol(conn, symbol):
    print(f'  {symbol} ...', end=' ', flush=True)
    try:
        df = yf.download(symbol, start=START, end=END,
                         auto_adjust=True, progress=False)
        if df.empty:
            print('no data')
            return 0

        rows = []
        for date, row in df.iterrows():
            rows.append((
                symbol,
                date.strftime('%Y-%m-%d'),
                float(row['Open'])   if pd.notna(row['Open'])   else None,
                float(row['High'])   if pd.notna(row['High'])   else None,
                float(row['Low'])    if pd.notna(row['Low'])    else None,
                float(row['Close'])  if pd.notna(row['Close'])  else None,
                int(row['Volume'])   if pd.notna(row['Volume']) else None,
            ))

        conn.executemany('''
            INSERT OR REPLACE INTO daily_prices (symbol,date,open,high,low,close,volume)
            VALUES (?,?,?,?,?,?,?)
        ''', rows)
        conn.commit()
        print(f'{len(rows)} rows')
        compute_indicators(conn, symbol)
        return len(rows)
    except Exception as e:
        print(f'ERROR: {e}')
        return 0

def export_sql(conn):
    """Write an INSERT script for D1 upload."""
    out = os.path.join(os.path.dirname(__file__), 'export.sql')
    with open(out, 'w') as f:
        for table in ('daily_prices', 'indicators'):
            rows = conn.execute(f'SELECT * FROM {table}').fetchall()
            if not rows:
                continue
            cols = rows[0].keys()
            f.write(f'-- {table}\n')
            for r in rows:
                vals = ', '.join(
                    f"'{v}'" if isinstance(v, str) else ('NULL' if v is None else str(v))
                    for v in r
                )
                f.write(f'INSERT OR REPLACE INTO {table} ({",".join(cols)}) VALUES ({vals});\n')
    print(f'\nExport written to {out}')

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    print(f'Market Hub Seeder  |  {START} → {END}  |  {len(SYMBOLS)} symbols')
    print(f'Database: {DB_PATH}\n')

    conn = get_db()
    init_db(conn)

    total = 0
    for sym in SYMBOLS:
        total += seed_symbol(conn, sym)

    print(f'\nDone. {total} price rows inserted.')
    export_sql(conn)
    conn.close()

    print('\nNext steps:')
    print('  1. npx wrangler d1 create market-hub-db')
    print('  2. npx wrangler d1 execute market-hub-db --remote --file=seed/schema.sql')
    print('  3. npx wrangler d1 execute market-hub-db --remote --file=seed/export.sql')

if __name__ == '__main__':
    main()
