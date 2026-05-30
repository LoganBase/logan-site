"""
Market Hub — Historical Data Seeder
Direct upload to Cloudflare D1 via REST API. No intermediate SQL file.

Setup:
  1. Create a seed/.env file (copy seed/.env.example and fill in values)
  2. pip install -r requirements.txt
  3. python seed.py

The seeder will:
  - Download up to 20 years of daily OHLCV data per symbol via yfinance
  - Compute indicators: SMA50, SMA200, RSI14, ROC10, vs200_pct, percentile rank
  - Upload directly to D1 in batches of 200 rows
  - Print live progress per symbol
"""

import os, sys, time
import pandas as pd
import requests
import yfinance as yf
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# ── CONFIG ────────────────────────────────────────────────────────────────────
SEED_YEARS = 20
START      = (datetime.now() - timedelta(days=365 * SEED_YEARS)).strftime('%Y-%m-%d')
END        = datetime.now().strftime('%Y-%m-%d')
BATCH_SIZE = 200   # rows per D1 API call

CF_ACCOUNT_ID = os.environ.get('CF_ACCOUNT_ID', '').strip()
CF_API_TOKEN  = os.environ.get('CF_API_TOKEN',  '').strip()
CF_D1_DB_ID   = os.environ.get('CF_D1_DB_ID',   '').strip()

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

# ── D1 REST API ───────────────────────────────────────────────────────────────
def d1_url():
    return (
        f'https://api.cloudflare.com/client/v4/accounts/'
        f'{CF_ACCOUNT_ID}/d1/database/{CF_D1_DB_ID}/query'
    )

def d1_headers():
    return {
        'Authorization': f'Bearer {CF_API_TOKEN}',
        'Content-Type':  'application/json',
    }

def d1_exec(sql, params=None):
    body = {'sql': sql}
    if params:
        body['params'] = params
    res  = requests.post(d1_url(), headers=d1_headers(), json=body, timeout=30)
    data = res.json()
    if not data.get('success'):
        raise RuntimeError(f"D1 error: {data.get('errors', data)}")
    return data

def d1_batch(queries):
    """Send a list of {sql, params} dicts as a single D1 transaction."""
    res  = requests.post(d1_url(), headers=d1_headers(), json=queries, timeout=60)
    data = res.json()
    if not data.get('success'):
        raise RuntimeError(f"D1 batch error: {data.get('errors', data)}")
    return data

# ── SCHEMA ────────────────────────────────────────────────────────────────────
def init_schema():
    print('Creating schema on D1...')
    for sql in [
        '''CREATE TABLE IF NOT EXISTS daily_prices (
            symbol TEXT NOT NULL, date TEXT NOT NULL,
            open REAL, high REAL, low REAL, close REAL, volume INTEGER,
            PRIMARY KEY (symbol, date)
        )''',
        '''CREATE TABLE IF NOT EXISTS indicators (
            symbol TEXT NOT NULL, date TEXT NOT NULL,
            sma50 REAL, sma200 REAL, rsi14 REAL, roc10 REAL,
            vs200_pct REAL, percentile REAL,
            PRIMARY KEY (symbol, date)
        )''',
        'CREATE INDEX IF NOT EXISTS idx_prices_sym_date ON daily_prices (symbol, date DESC)',
        'CREATE INDEX IF NOT EXISTS idx_ind_sym_date    ON indicators   (symbol, date DESC)',
    ]:
        d1_exec(sql)
    print('Schema ready.\n')

# ── INDICATORS ────────────────────────────────────────────────────────────────
def calc_rsi(closes, period=14):
    n      = len(closes)
    result = [None] * n
    if n < period + 1:
        return result
    gains  = [max(closes[i] - closes[i-1], 0) for i in range(1, n)]
    losses = [max(closes[i-1] - closes[i], 0) for i in range(1, n)]
    ag = sum(gains[:period])  / period
    al = sum(losses[:period]) / period
    result[period] = 100 - 100 / (1 + (ag / al if al else float('inf')))
    for i in range(period + 1, n):
        ag = (ag * (period - 1) + gains[i-1])  / period
        al = (al * (period - 1) + losses[i-1]) / period
        result[i] = 100 - 100 / (1 + (ag / al if al else float('inf')))
    return result

def compute_indicators(symbol, dates, closes):
    n          = len(closes)
    rsi_series = calc_rsi(closes)

    vs200_all = []
    for i in range(n):
        if i >= 199:
            s200 = sum(closes[i-199:i+1]) / 200
            vs200_all.append(((closes[i] - s200) / s200) * 100)
        else:
            vs200_all.append(None)

    rows = []
    for i in range(14, n):
        price  = closes[i]
        sma50  = sum(closes[max(0, i-49):i+1]) / min(i+1, 50) if i >= 49  else None
        sma200 = sum(closes[i-199:i+1]) / 200                  if i >= 199 else None
        vs200  = ((price - sma200) / sma200 * 100)             if sma200   else None
        rsi14  = rsi_series[i]
        roc10  = ((price / closes[i-10]) - 1) * 100            if i >= 10  else None
        pct    = None
        if vs200 is not None:
            valid = [v for v in vs200_all[:i+1] if v is not None]
            pct   = sum(1 for v in valid if v <= vs200) / len(valid) * 100 if valid else None
        rows.append((symbol, dates[i], sma50, sma200, rsi14, roc10, vs200, pct))
    return rows

# ── UPLOAD HELPERS ────────────────────────────────────────────────────────────
def upload_in_batches(query_fn, all_rows, label):
    total    = len(all_rows)
    uploaded = 0
    for i in range(0, total, BATCH_SIZE):
        chunk = all_rows[i:i + BATCH_SIZE]
        d1_batch([query_fn(r) for r in chunk])
        uploaded += len(chunk)
        print(f'      {label}: {uploaded:,}/{total:,}', end='\r', flush=True)
        time.sleep(0.15)
    print()

def price_query(row):
    return {
        'sql':    'INSERT OR REPLACE INTO daily_prices '
                  '(symbol,date,open,high,low,close,volume) VALUES (?,?,?,?,?,?,?)',
        'params': list(row),
    }

def indicator_query(row):
    return {
        'sql':    'INSERT OR REPLACE INTO indicators '
                  '(symbol,date,sma50,sma200,rsi14,roc10,vs200_pct,percentile) '
                  'VALUES (?,?,?,?,?,?,?,?)',
        'params': list(row),
    }

# ── PER-SYMBOL SEED ───────────────────────────────────────────────────────────
def seed_symbol(symbol):
    print(f'  {symbol}', end=' ... ', flush=True)
    try:
        df = yf.download(symbol, start=START, end=END, auto_adjust=True, progress=False)
        if df.empty:
            print('no data')
            return 0

        dates  = [d.strftime('%Y-%m-%d') for d in df.index]
        opens  = [float(df['Open'].iloc[i])  if pd.notna(df['Open'].iloc[i])  else None for i in range(len(df))]
        highs  = [float(df['High'].iloc[i])  if pd.notna(df['High'].iloc[i])  else None for i in range(len(df))]
        lows   = [float(df['Low'].iloc[i])   if pd.notna(df['Low'].iloc[i])   else None for i in range(len(df))]
        closes = [float(df['Close'].iloc[i]) if pd.notna(df['Close'].iloc[i]) else None for i in range(len(df))]
        vols   = [int(df['Volume'].iloc[i])  if pd.notna(df['Volume'].iloc[i]) else None for i in range(len(df))]

        price_rows = list(zip([symbol]*len(dates), dates, opens, highs, lows, closes, vols))
        print(f'{len(price_rows):,} rows')

        upload_in_batches(price_query, price_rows, 'prices')

        clean_pairs = [(d, c) for d, c in zip(dates, closes) if c is not None]
        if len(clean_pairs) >= 15:
            c_dates  = [p[0] for p in clean_pairs]
            c_closes = [p[1] for p in clean_pairs]
            ind_rows = compute_indicators(symbol, c_dates, c_closes)
            upload_in_batches(indicator_query, ind_rows, 'indicators')

        return len(price_rows)

    except Exception as e:
        print(f'ERROR: {e}')
        return 0

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    missing = [k for k, v in {
        'CF_ACCOUNT_ID': CF_ACCOUNT_ID,
        'CF_API_TOKEN':  CF_API_TOKEN,
        'CF_D1_DB_ID':   CF_D1_DB_ID,
    }.items() if not v]
    if missing:
        print(f'ERROR: Missing environment variables: {", ".join(missing)}')
        print('Create seed/.env — see seed/.env.example')
        sys.exit(1)

    print('─' * 60)
    print(f'  Market Hub Seeder — Direct D1 Upload')
    print(f'  Period : {START}  →  {END}')
    print(f'  Symbols: {len(SYMBOLS)}')
    print(f'  Batch  : {BATCH_SIZE} rows/call')
    print('─' * 60 + '\n')

    init_schema()

    total = 0
    for i, sym in enumerate(SYMBOLS, 1):
        print(f'[{i:02d}/{len(SYMBOLS)}] ', end='')
        total += seed_symbol(sym)

    print(f'\n{"─" * 60}')
    print(f'  Done. {total:,} price rows uploaded to D1.')
    print('─' * 60)

if __name__ == '__main__':
    main()
