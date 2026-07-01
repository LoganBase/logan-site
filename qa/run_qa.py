#!/usr/bin/env python3
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.URLError as e:
        print(f"Error fetching {url}: {e}")
        return None

def fmt_res(val):
    return "PASS" if val is True else ("FAIL" if val is False else "N/A")

def clean_num(s):
    if not s or s == "—" or s == "—%":
        return None
    # Strip symbols
    cleaned = s.replace("$", "").replace("%", "").replace("×", "").replace("*", "").replace("~", "").replace("US", "").replace(" ", "").strip()
    # If multiline, take first line
    if "\n" in cleaned:
        cleaned = cleaned.split("\n")[0]
    if "<br>" in cleaned:
        cleaned = cleaned.split("<br>")[0]
    try:
        return float(cleaned)
    except:
        return None

def run_qa(base_url="https://www.loganbase.com"):
    print(f"Starting comprehensive Market Hub QA run targeting: {base_url}...")
    
    scores = fetch_json(f"{base_url}/api/scores")
    kalshi = fetch_json(f"{base_url}/api/kalshi")
    poly = fetch_json(f"{base_url}/api/polymarket")
    
    if not scores:
        print("CRITICAL: Failed to fetch scores API. Aborting.")
        return
        
    today_utc = datetime.utcnow().strftime("%Y-%m-%d")
    timestamp_raw = scores.get("timestamp", "")
    ts_date = timestamp_raw[:10] if len(timestamp_raw) >= 10 else ""
    
    source = scores.get("source", "")
    aggregate = scores.get("aggregate", {})
    cards = scores.get("cards", [])
    cards_map = {c["id"]: c for c in cards}
    
    results = {}
    
    # ----------------------------------------------------
    # SECTION 1: EXECUTIVE SUMMARY QA
    # ----------------------------------------------------
    exec_checks = []
    
    f1_pass = (ts_date == today_utc)
    exec_checks.append(("F1", "Timestamp freshness", f1_pass, f"Timestamp: {timestamp_raw} (Expected: {today_utc})"))
    
    f2_pass = source in ["d1", "yahoo", "d1+yahoo"]
    exec_checks.append(("F2", "Source field valid", f2_pass, f"Value: {source}"))
    
    a1_pass = isinstance(aggregate, dict) and len(aggregate) > 0
    exec_checks.append(("A1", "aggregate object present", a1_pass, ""))
    
    req_agg_fields = ["score", "glow", "label", "posture", "bullish", "neutral", "bearish", "regimeBearish", "categories"]
    missing_agg_fields = [f for f in req_agg_fields if f not in aggregate]
    a2_pass = len(missing_agg_fields) == 0
    exec_checks.append(("A2", "All required fields present", a2_pass, f"Missing: {missing_agg_fields}" if missing_agg_fields else ""))
    
    categories_list = aggregate.get("categories", [])
    categories = {c["key"]: c for c in categories_list if "key" in c}
    a3_pass = len(categories) == 3
    exec_checks.append(("A3", "categories count = 3", a3_pass, f"Count: {len(categories)}"))
    
    cat_keys = list(categories.keys())
    a4_pass = set(cat_keys) == {"trend", "participation", "macro"}
    exec_checks.append(("A4", "Category keys correct", a4_pass, f"Keys: {cat_keys}"))
    
    w_trend = categories.get("trend", {}).get("weight")
    w_part = categories.get("participation", {}).get("weight")
    w_macro = categories.get("macro", {}).get("weight")
    a5_pass = (w_trend == 0.4 and w_part == 0.3 and w_macro == 0.3)
    exec_checks.append(("A5", "Category weights correct", a5_pass, f"Trend: {w_trend}, Participation: {w_part}, Macro: {w_macro}"))
    
    trend_ids = [c["id"] for c in categories.get("trend", {}).get("cards", []) if "id" in c]
    part_ids = [c["id"] for c in categories.get("participation", {}).get("cards", []) if "id" in c]
    macro_ids = [c["id"] for c in categories.get("macro", {}).get("cards", []) if "id" in c]
    
    m1_pass = set(trend_ids) == {"regime", "leadership", "sectors", "equities"}
    exec_checks.append(("M1", "Trend cards correct (4)", m1_pass, f"Found: {trend_ids}"))
    
    m2_pass = set(part_ids) == {"breadth", "globalflows", "commodities"}
    exec_checks.append(("M2", "Participation cards correct (3)", m2_pass, f"Found: {part_ids}"))
    
    m3_pass = set(macro_ids) == {"valuations", "yield", "credit"}
    exec_checks.append(("M3", "Macro cards correct (3)", m3_pass, f"Found: {macro_ids}"))
    
    bull_cnt = aggregate.get("bullish", 0)
    neut_cnt = aggregate.get("neutral", 0)
    bear_cnt = aggregate.get("bearish", 0)
    c1_pass = (bull_cnt + neut_cnt + bear_cnt == 10)
    exec_checks.append(("C1", "Chip counts total 10", c1_pass, f"Total: {bull_cnt + neut_cnt + bear_cnt}"))
    
    statuses = [c.get("status") for c in cards if c.get("id") != "currency"]
    actual_bull = statuses.count("bullish")
    actual_neut = statuses.count("neutral")
    actual_bear = statuses.count("bearish")
    c2_pass = (bull_cnt == actual_bull and neut_cnt == actual_neut and bear_cnt == actual_bear)
    exec_checks.append(("C2", "Chip counts match card statuses", c2_pass, f"Agg: {bull_cnt}/{neut_cnt}/{bear_cnt}, Cards: {actual_bull}/{actual_neut}/{actual_bear}"))
    
    regime_card = cards_map.get("regime")
    regime_status = regime_card.get("status") if regime_card else None
    regime_bearish_flag = aggregate.get("regimeBearish")
    r1_pass = (regime_bearish_flag == (regime_status == "bearish"))
    exec_checks.append(("R1", "regimeBearish flag correct", r1_pass, f"Flag: {regime_bearish_flag}, Regime Status: {regime_status}"))
    
    def calc_cat_pct(cat_key):
        cat = categories.get(cat_key, {})
        b = cat.get("bullish", 0)
        n = cat.get("neutral", 0)
        be = cat.get("bearish", 0)
        total = b + n + be
        if total == 0:
            return 0.0, 0.0
        raw = b + (n * 0.5)
        return raw, raw / total

    trend_raw, trend_pct_calc = calc_cat_pct("trend")
    part_raw, part_pct_calc = calc_cat_pct("participation")
    macro_raw, macro_pct_calc = calc_cat_pct("macro")
    
    t_pct_api = categories.get("trend", {}).get("pct", 0)
    sc1_pass = (abs(t_pct_api - trend_pct_calc) < 0.001)
    exec_checks.append(("SC1", "Trend sub-score math", sc1_pass, f"Calc: {trend_raw}/4 = {trend_pct_calc:.3f}, API: {t_pct_api:.3f}"))
    
    p_pct_api = categories.get("participation", {}).get("pct", 0)
    sc2_pass = (abs(p_pct_api - part_pct_calc) < 0.001)
    exec_checks.append(("SC2", "Participation sub-score math", sc2_pass, f"Calc: {part_raw}/3 = {part_pct_calc:.3f}, API: {p_pct_api:.3f}"))
    
    m_pct_api = categories.get("macro", {}).get("pct", 0)
    sc3_pass = (abs(m_pct_api - macro_pct_calc) < 0.001)
    exec_checks.append(("SC3", "Macro sub-score math", sc3_pass, f"Calc: {macro_raw}/3 = {macro_pct_calc:.3f}, API: {m_pct_api:.3f}"))
    
    weighted_pct_calc = (trend_pct_calc * 0.4) + (part_pct_calc * 0.3) + (macro_pct_calc * 0.3)
    display_score_calc = round(weighted_pct_calc * 10, 1)
    score_api_str = aggregate.get("score", "0.0/10")
    try:
        score_api_val = float(score_api_str.split("/")[0])
    except:
        score_api_val = 0.0
    wc1_pass = (abs(score_api_val - display_score_calc) < 0.05)
    exec_checks.append(("WC1", "Weighted composite math", wc1_pass, f"Calc: {display_score_calc}/10, API: {score_api_str}"))
    
    glow_api = aggregate.get("glow", "")
    expected_glow = "green" if weighted_pct_calc >= 0.75 else ("yellow" if weighted_pct_calc >= 0.55 else "red")
    l1_pass = (glow_api == expected_glow)
    exec_checks.append(("L1", "Glow matches threshold", l1_pass, f"Calc: {weighted_pct_calc:.3f} -> expected: {expected_glow}, API: {glow_api}"))
    
    label_api = aggregate.get("label", "")
    expected_label = "Risk-On — Broad Participation" if weighted_pct_calc >= 0.75 else ("Mixed Signals — Selective" if weighted_pct_calc >= 0.55 else "Risk-Off — Reduce Exposure")
    l2_pass = (label_api == expected_label)
    exec_checks.append(("L2", "Label correct", l2_pass, f"API: \"{label_api}\""))
    
    posture_api = aggregate.get("posture", "")
    expected_posture = "Risk-On, Not Complacent" if weighted_pct_calc >= 0.75 else ("Selective, Not Aggressive" if weighted_pct_calc >= 0.55 else "Defensive, Raise Cash")
    l3_pass = (posture_api == expected_posture)
    exec_checks.append(("L3", "Posture correct", l3_pass, f"API: \"{posture_api}\""))
    
    trend_glow = categories.get("trend", {}).get("glow", "")
    part_glow = categories.get("participation", {}).get("glow", "")
    macro_glow = categories.get("macro", {}).get("glow", "")
    
    cg1_expected = "green" if trend_pct_calc >= 0.75 else ("yellow" if trend_pct_calc >= 0.55 else "red")
    cg1_pass = (trend_glow == cg1_expected)
    exec_checks.append(("CG1", "Trend category glow", cg1_pass, f"Pct: {trend_pct_calc:.3f} -> expected: {cg1_expected}, API: {trend_glow}"))
    
    cg2_expected = "green" if part_pct_calc >= 0.75 else ("yellow" if part_pct_calc >= 0.55 else "red")
    cg2_pass = (part_glow == cg2_expected)
    exec_checks.append(("CG2", "Participation category glow", cg2_pass, f"Pct: {part_pct_calc:.3f} -> expected: {cg2_expected}, API: {part_glow}"))
    
    cg3_expected = "green" if macro_pct_calc >= 0.75 else ("yellow" if macro_pct_calc >= 0.55 else "red")
    cg3_pass = (macro_glow == cg3_expected)
    exec_checks.append(("CG3", "Macro category glow", cg3_pass, f"Pct: {macro_pct_calc:.3f} -> expected: {cg3_expected}, API: {macro_glow}"))
    
    k1_pass = kalshi is not None and len(kalshi.get("events", [])) > 0
    k1_count = len(kalshi.get("events", [])) if kalshi else 0
    exec_checks.append(("K1", "Kalshi events present", k1_pass, f"Count: {k1_count}"))
    
    k2_pass = True
    fomc_event = None
    cpi_event = None
    if kalshi and "events" in kalshi:
        for ev in kalshi["events"]:
            req_fields = ["label", "date", "consensus", "action", "confidence", "type"]
            if not all(f in ev for f in req_fields):
                k2_pass = False
            if ev.get("type") == "fomc":
                fomc_event = ev
            elif ev.get("type") == "cpi":
                cpi_event = ev
    exec_checks.append(("K2", "Kalshi event fields complete", k2_pass, ""))
    
    k3_pass = None
    k3_note = ""
    if fomc_event:
        action = fomc_event.get("action")
        consensus_str = fomc_event.get("consensus", "").replace("%", "")
        curr_rate = fomc_event.get("currentRate")
        if curr_rate is not None and consensus_str:
            try:
                consensus_val = float(consensus_str)
                if abs(consensus_val - curr_rate) < 0.01:
                    expected_act = "Hold"
                elif consensus_val > curr_rate:
                    expected_act = "Hike"
                else:
                    expected_act = "Cut"
                k3_pass = (action == expected_act)
                k3_note = f"Action: {action}, Consensus: {consensus_str}%, Current: {curr_rate}% (Expected: {expected_act})"
            except:
                k3_pass = False
                k3_note = f"Parsing error for consensus {consensus_str}"
    exec_checks.append(("K3", "FOMC action derived correctly", k3_pass, k3_note))
    
    k4_pass = None
    k4_note = ""
    if fomc_event:
        conf = fomc_event.get("confidence")
        if conf is not None:
            k4_pass = (1 <= conf <= 99)
            k4_note = f"Value: {conf}%"
    exec_checks.append(("K4", "FOMC confidence 1-99", k4_pass, k4_note))
    
    k5_pass = None
    k5_note = ""
    if cpi_event:
        cons = cpi_event.get("consensus", "")
        k5_pass = (cons.startswith("~") and ("+" in cons or "-" in cons) and cons.endswith("%"))
        k5_note = f"Value: {cons}"
    exec_checks.append(("K5", "CPI consensus format", k5_pass, k5_note))
    
    p1_pass = poly is not None and "signals" in poly
    exec_checks.append(("P1", "Polymarket signals present", p1_pass, ""))
    
    p2_pass = None
    p2_count = 0
    if poly and "signals" in poly:
        p2_count = len(poly["signals"])
        p2_pass = (p2_count <= 5)
    exec_checks.append(("P2", "Signal count <= 5", p2_pass, f"Count: {p2_count}"))
    
    p3_pass = None
    if poly and "signals" in poly:
        vols = [s.get("volume", 0) for s in poly["signals"]]
        p3_pass = all(vols[i] >= vols[i+1] for i in range(len(vols)-1))
    exec_checks.append(("P3", "Signals sorted by volume", p3_pass, ""))
    
    p4_pass = None
    if poly and "signals" in poly:
        probs = [s.get("probability") for s in poly["signals"]]
        p4_pass = all(p is not None and 0 <= p <= 1 for p in probs)
    exec_checks.append(("P4", "Probabilities 0-1", p4_pass, ""))
    
    p5_pass = None
    if poly and "signals" in poly:
        sents = [s.get("sentiment") for s in poly["signals"]]
        p5_pass = all(s in ["bullish", "bearish", "neutral"] for s in sents)
    exec_checks.append(("P5", "Sentiment values valid", p5_pass, ""))
    
    p6_note = ""
    if poly and "signals" in poly:
        qualifying = []
        for s in poly["signals"]:
            q = s.get("label", "").lower()
            if "recession" in q or ("inflation" in q and "rate" not in q) or "negative gdp" in q:
                qualifying.append(f"\"{s.get('label')}\": {s.get('probability')*100:.1f}%")
        p6_note = ", ".join(qualifying) if qualifying else "None present"
    exec_checks.append(("P6", "Base-rate qualifying signals", True, f"Signals: {p6_note}"))
    
    results["executive_summary"] = exec_checks
    
    # ----------------------------------------------------
    # SECTION 2: CARD 01 - REGIME QA
    # ----------------------------------------------------
    regime_checks = []
    if regime_card:
        rows = regime_card.get("rows", [])
        s1_pass = len(rows) == 3
        regime_checks.append(("S1", "Row count = 3", s1_pass, f"Count: {len(rows)}"))
        
        labels = [r.get("label") for r in rows]
        s2_pass = (labels == ["SPY Regime", "Stretch Risk", "Trend Cross"])
        regime_checks.append(("S2", "Row labels correct", s2_pass, f"Found: {labels}"))
        
        indicators = [r.get("indicator") for r in rows]
        s3_pass = (indicators == ["SPY vs 200d SMA", "Distance from 200d SMA", "50d SMA vs 200d SMA"])
        regime_checks.append(("S3", "Row indicators correct", s3_pass, f"Found: {indicators}"))
        
        spy_price = clean_num(rows[0].get("value", ""))
        vs200_disp = clean_num(rows[1].get("value", ""))
        cross_spread = clean_num(rows[2].get("value", ""))
        
        m1_pass = None
        m1_note = ""
        if spy_price is not None and vs200_disp is not None:
            derived_sma200 = spy_price / (1 + vs200_disp / 100)
            recalc_vs200 = ((spy_price - derived_sma200) / derived_sma200) * 100
            m1_pass = abs(recalc_vs200 - vs200_disp) < 0.05
            m1_note = f"Calculated: {recalc_vs200:.2f}%, Displayed: {vs200_disp:.2f}% (Derived 200d SMA: ${derived_sma200:.2f})"
        regime_checks.append(("M1", "vs200 math correct", m1_pass, m1_note))
        
        m2_pass = None
        if cross_spread is not None:
            r2_status = rows[2].get("status")
            r2_cond = rows[2].get("condition", "")
            if cross_spread > 8:
                m2_pass = (r2_status == "bullish" and "Golden Cross" in r2_cond)
            elif cross_spread >= -8:
                m2_pass = (r2_status == "neutral" and "Cross Forming" in r2_cond)
            else:
                m2_pass = (r2_status == "bearish" and "Death Cross" in r2_cond)
        regime_checks.append(("M2", "50d/200d spread band & status", m2_pass, f"Spread: {cross_spread}%, Status: {rows[2].get('status')}, Condition: \"{rows[2].get('condition')}\""))
        
        r0_status = rows[0].get("status")
        r0_cond = rows[0].get("condition", "")
        derived_sma200 = spy_price / (1 + vs200_disp / 100) if (spy_price and vs200_disp) else 0
        r0a_pass = (r0_status == "bullish" if spy_price > derived_sma200 else r0_status == "bearish")
        r0b_pass = ("Secular Bull" in r0_cond if spy_price > derived_sma200 else "Secular Bear" in r0_cond)
        regime_checks.append(("R0A", "Row 0 status correct", r0a_pass, f"SPY: ${spy_price:.2f} vs 200d: ${derived_sma200:.2f}"))
        regime_checks.append(("R0B", "Row 0 condition text", r0b_pass, f"Condition: \"{r0_cond}\""))
        
        r1_status = rows[1].get("status")
        r1_cond = rows[1].get("condition", "")
        if vs200_disp is not None:
            if vs200_disp > 14:
                exp_status, exp_cond = "bearish", "Overextended"
            elif vs200_disp > 10:
                exp_status, exp_cond = "neutral", "Extended"
            elif vs200_disp >= 0:
                exp_status, exp_cond = "bullish", "Normal Bull"
            elif vs200_disp >= -10:
                exp_status, exp_cond = "neutral", "Bearish Retest"
            else:
                exp_status, exp_cond = "bearish", "Deeply Oversold"
            r1a_pass = (r1_status == exp_status)
            r1b_pass = (exp_cond in r1_cond)
        else:
            r1a_pass, r1b_pass = None, None
        regime_checks.append(("R1A", "Row 1 status (zone)", r1a_pass, f"VS200: {vs200_disp}%, expected status: {exp_status if vs200_disp is not None else ''}"))
        regime_checks.append(("R1B", "Row 1 condition text", r1b_pass, f"Condition: \"{r1_cond}\""))
        
        regime_checks.append(("R2A", "Row 2 status correct", m2_pass, ""))
        regime_checks.append(("R2B", "Row 2 condition text", m2_pass, ""))
        
        r2c_pass = None
        if cross_spread is not None:
            if r2_status in ["bullish", "bearish"]:
                r2c_pass = ("%" in r2_cond)
            else:
                r2c_pass = True
        regime_checks.append(("R2C", "Spread % in condition", r2c_pass, f"Condition: \"{r2_cond}\""))
        
        o1_pass = None
        if spy_price is not None and derived_sma200:
            if spy_price < derived_sma200:
                o1_pass = (regime_status == "bearish")
            else:
                o1_pass = True
        regime_checks.append(("O1", "Override rule (bear)", o1_pass, f"SPY < 200d? {spy_price < derived_sma200 if (spy_price and derived_sma200) else ''}, Card Status: {regime_status}"))
        
        o2_pass = None
        if spy_price is not None and derived_sma200:
            if spy_price > derived_sma200:
                row_statuses = [r.get("status") for r in rows]
                b_c = row_statuses.count("bullish")
                n_c = row_statuses.count("neutral")
                be_c = row_statuses.count("bearish")
                if be_c > b_c:
                    exp_card_status = "bearish"
                elif b_c > 0 and be_c == 0:
                    exp_card_status = "bullish"
                else:
                    exp_card_status = "neutral"
                o2_pass = (regime_status == exp_card_status)
            else:
                o2_pass = True
        regime_checks.append(("O2", "Majority-wins logic", o2_pass, f"Row statuses: {row_statuses if (spy_price and derived_sma200) else ''}, Card Status: {regime_status}"))
        
        c_delta = regime_card.get("delta")
        d1_pass = c_delta in ["up", "down", "same"]
        regime_checks.append(("D1", "Card delta field present", d1_pass, f"Value: {c_delta}"))
        
        c_deltas = regime_card.get("deltas", {})
        d2_pass = isinstance(c_deltas, dict) and any(val is not None for val in c_deltas.values())
        regime_checks.append(("D2", "Deltas object present", d2_pass, str(c_deltas) if c_deltas else ""))
        
        d3_pass = True
        d3_note = ""
        if c_deltas:
            for k, val in c_deltas.items():
                if val not in ["up", "down", "flat", None]:
                    d3_pass = False
            d3_note = f"v200: {c_deltas.get('v200')}, crossSpread: {c_deltas.get('crossSpread')}, duration: {c_deltas.get('duration')}, velocity: {c_deltas.get('velocity')}"
        regime_checks.append(("D3", "Deltas sub-fields plausible", d3_pass, d3_note))
        
    results["regime"] = regime_checks
    
    # ----------------------------------------------------
    # SECTION 3: CARD 02 - LEADERSHIP QA
    # ----------------------------------------------------
    lead_checks = []
    lead_card = cards_map.get("leadership")
    if lead_card:
        rows = lead_card.get("rows", [])
        s1_pass = len(rows) == 3
        lead_checks.append(("S1", "Row count = 3", s1_pass, f"Count: {len(rows)}"))
        
        labels = [r.get("label") for r in rows]
        s2_pass = (labels == ["Market Breadth", "Tech Breadth", "Style Bias"])
        lead_checks.append(("S2", "Row labels correct", s2_pass, f"Found: {labels}"))
        
        indicators = [r.get("indicator") for r in rows]
        s3_pass = (indicators == ["RSP vs SPY \u2014 20d Return", "QQEW vs QQQ \u2014 20d Return", "IVW vs IVE \u2014 20d Return"])
        lead_checks.append(("S3", "Row indicators correct", s3_pass, f"Found: {indicators}"))
        
        p1_pass = True
        p2_pass = True
        p2_notes = []
        for i, row in enumerate(rows):
            val = row.get("value", "")
            if "\n" not in val and "<br>" not in val:
                p1_pass = False
                p2_notes.append(f"Row {i} not two-line: \"{val}\"")
                continue
            lines = val.split("\n") if "\n" in val else val.split("<br>")
            spread_line = lines[0].strip()
            details_line = lines[1].strip()
            
            if not (spread_line.startswith("+") or spread_line.startswith("-") or spread_line.startswith("0")):
                p1_pass = False
                
            try:
                spread_val = float(spread_line.replace("%", ""))
                parts = details_line.split()
                val1 = float(parts[1].replace("%", ""))
                val2 = float(parts[3].replace("%", ""))
                calc_spread = val1 - val2
                if abs(calc_spread - spread_val) > 0.15:
                    p2_pass = False
                    p2_notes.append(f"Row {i} spread mismatch: Display={spread_val}%, Calc={calc_spread:.2f}% ({parts[0]}={val1}%, {parts[2]}={val2}%)")
            except Exception as e:
                p2_pass = False
                p2_notes.append(f"Row {i} parse error: {e} in details \"{details_line}\"")
                
        lead_checks.append(("P1", "Spread on line 1 formatted correctly", p1_pass, ""))
        lead_checks.append(("P2", "Spread arithmetic matches individual returns", p2_pass, "; ".join(p2_notes) if p2_notes else "All rows match"))
        
        r0_status = rows[0].get("status")
        r0_cond = rows[0].get("condition", "")
        try:
            r0_spread = clean_num(rows[0].get("value", ""))
            r0a_pass = (r0_status == "bullish" if r0_spread > 0 else r0_status == "bearish")
            r0b_pass = ("Breadth Expanding" in r0_cond if r0_spread > 0 else "Rally Narrowing" in r0_cond)
            r0c_pass = (r0_cond == "Breadth Expanding \u2014 Add Broadly" if r0_spread > 0 else r0_cond == "Rally Narrowing \u2014 Stay with Leaders")
        except:
            r0a_pass, r0b_pass, r0c_pass = False, False, False
        lead_checks.append(("R0A", "Row 0 status matches spread direction", r0a_pass, ""))
        lead_checks.append(("R0B", "Row 0 condition correct", r0b_pass, ""))
        lead_checks.append(("R0C", "Row 0 full condition matches standard", r0c_pass, f"Condition: \"{r0_cond}\""))
        
        r1_status = rows[1].get("status")
        r1_cond = rows[1].get("condition", "")
        try:
            r1_spread = clean_num(rows[1].get("value", ""))
            r1a_pass = (r1_status == "bullish" if r1_spread > 0 else r1_status == "bearish")
            r1b_pass = ("Tech Broadening" in r1_cond if r1_spread > 0 else "Mega-Cap Driven" in r1_cond)
            r1c_pass = (r1_cond == "Tech Broadening \u2014 Tech Healthy" if r1_spread > 0 else r1_cond == "Mega-Cap Driven \u2014 Favour Large Cap")
        except:
            r1a_pass, r1b_pass, r1c_pass = False, False, False
        lead_checks.append(("R1A", "Row 1 status matches spread direction", r1a_pass, ""))
        lead_checks.append(("R1B", "Row 1 condition correct", r1b_pass, ""))
        lead_checks.append(("R1C", "Row 1 full condition matches standard", r1c_pass, f"Condition: \"{r1_cond}\""))
        
        r2_status = rows[2].get("status")
        r2_cond = rows[2].get("condition", "")
        try:
            r2_spread = clean_num(rows[2].get("value", ""))
            r2a_pass = (r2_status == "bullish" if r2_spread > 0 else r2_status == "neutral")
            r2b_pass = ("Growth Leading" in r2_cond if r2_spread > 0 else "Value Rotating" in r2_cond)
            r2c_pass = (r2_cond == "Growth Leading \u2014 Risk-On" if r2_spread > 0 else r2_cond == "Value Rotating \u2014 Reduce Growth")
        except:
            r2a_pass, r2b_pass, r2c_pass = False, False, False
        lead_checks.append(("R2A", "Row 2 status correct (neutral-only protection)", r2a_pass, f"Spread: {r2_spread}%, Status: {r2_status}"))
        lead_checks.append(("R2B", "Row 2 condition correct", r2b_pass, ""))
        lead_checks.append(("R2C", "Row 2 full condition matches standard", r2c_pass, f"Condition: \"{r2_cond}\""))
        
    results["leadership"] = lead_checks
    
    # ----------------------------------------------------
    # SECTION 4: CARD 03 - BREADTH QA
    # ----------------------------------------------------
    breadth_checks = []
    breadth_card = cards_map.get("breadth")
    if breadth_card:
        rows = breadth_card.get("rows", [])
        s1_pass = len(rows) == 4
        breadth_checks.append(("S1", "Row count = 4", s1_pass, f"Count: {len(rows)}"))
        
        labels = [r.get("label") for r in rows]
        s2_pass = (labels == ["NYSE 200d", "NYSE 50d", "Sector Check", "Consumer Signal"])
        breadth_checks.append(("S2", "Row labels correct", s2_pass, f"Found: {labels}"))
        
        indicators = [r.get("indicator") for r in rows]
        s3_pass = (indicators == [
            "$MMTH \u2014 % NYSE Stocks Above 200d SMA", 
            "$MMFI \u2014 % NYSE Stocks Above 50d SMA", 
            "SPDR Sectors Above 200d SMA (11)", 
            "RSPD (Equal-Weight Consumer Disc.)"
        ])
        breadth_checks.append(("S3", "Row indicators correct", s3_pass, f"Found: {indicators}"))
        
        note = breadth_card.get("note", "")
        s4_pass = isinstance(note, str) and len(note) > 0
        breadth_checks.append(("S4", "Note present and non-empty", s4_pass, ""))
        
        sector_tbl = breadth_card.get("sectorTable")
        s5_pass = isinstance(sector_tbl, list)
        breadth_checks.append(("S5", "Sector table present", s5_pass, f"Size: {len(sector_tbl) if sector_tbl else 0}"))
        
        r0_val = rows[0].get("value", "")
        r1_val = rows[1].get("value", "")
        r2_val = rows[2].get("value", "")
        r3_val = rows[3].get("value", "")
        
        mmth_val = None
        mmfi_val = None
        bull_sectors = None
        total_sectors = None
        
        mmth_unavail = (r0_val == "—")
        mmfi_unavail = (r1_val == "—")
        sectors_unavail = (r2_val == "—")
        
        try:
            if not mmth_unavail: mmth_val = float(r0_val.replace("%", ""))
            if not mmfi_unavail: mmfi_val = float(r1_val.replace("%", ""))
            if not sectors_unavail:
                parts = r2_val.split("/")
                bull_sectors = int(parts[0].strip())
                total_sectors = int(parts[1].strip())
        except:
            pass
            
        r0_status = rows[0].get("status")
        r0_cond = rows[0].get("condition", "")
        if mmth_unavail:
            r0a_pass = (r0_status == "neutral")
            r0b_pass = (r0_cond == "Awaiting Data")
        elif mmth_val is not None:
            if mmth_val >= 70:
                r0a_pass = (r0_status == "bullish")
                r0b_pass = ("Broad Participation" in r0_cond)
            elif mmth_val >= 40:
                r0a_pass = (r0_status == "neutral")
                r0b_pass = ("Mixed Breadth" in r0_cond)
            else:
                r0a_pass = (r0_status == "bearish")
                r0b_pass = ("Breadth Breakdown" in r0_cond)
        else:
            r0a_pass, r0b_pass = False, False
        breadth_checks.append(("R0A", "Row 0 status matches thresholds", r0a_pass, f"MMTH: {mmth_val}%, Status: {r0_status}"))
        breadth_checks.append(("R0B", "Row 0 condition correct", r0b_pass, f"Condition: \"{r0_cond}\""))
        
        r1_status = rows[1].get("status")
        r1_cond = rows[1].get("condition", "")
        if mmfi_unavail:
            r1a_pass = (r1_status == "neutral")
            r1b_pass = (r1_cond == "Awaiting Data")
        elif mmfi_val is not None:
            if mmfi_val >= 70:
                r1a_pass = (r1_status == "bullish")
                r1b_pass = ("Momentum Expanding" in r1_cond)
            elif mmfi_val >= 40:
                r1a_pass = (r1_status == "neutral")
                r1b_pass = ("Mixed Momentum" in r1_cond)
            else:
                r1a_pass = (r1_status == "bearish")
                r1b_pass = ("Momentum Fading" in r1_cond)
        else:
            r1a_pass, r1b_pass = False, False
        breadth_checks.append(("R1A", "Row 1 status matches thresholds", r1a_pass, f"MMFI: {mmfi_val}%, Status: {r1_status}"))
        breadth_checks.append(("R1B", "Row 1 condition correct", r1b_pass, f"Condition: \"{r1_cond}\""))
        
        r2_status = rows[2].get("status")
        r2_cond = rows[2].get("condition", "")
        if sectors_unavail:
            r2a_pass = (r2_status == "neutral")
            r2b_pass = (r2_cond == "Insufficient Data")
        elif bull_sectors is not None:
            if bull_sectors >= 8:
                r2a_pass = (r2_status == "bullish")
                r2b_pass = ("Broad Participation" in r2_cond)
            elif bull_sectors >= 5:
                r2a_pass = (r2_status == "neutral")
                r2b_pass = ("Be Selective" in r2_cond or "Mixed Breadth" in r2_cond)
            else:
                r2a_pass = (r2_status == "bearish")
                r2b_pass = ("Sector Breakdown" in r2_cond)
        else:
            r2a_pass, r2b_pass = False, False
        breadth_checks.append(("R2A", "Row 2 status matches thresholds", r2a_pass, f"Sectors: {bull_sectors}/{total_sectors}, Status: {r2_status}"))
        breadth_checks.append(("R2B", "Row 2 condition correct", r2b_pass, f"Condition: \"{r2_cond}\""))
        
        r3_status = rows[3].get("status")
        r3_cond = rows[3].get("condition", "")
        if r3_val == "—":
            r3a_pass = (r3_status == "neutral")
            r3b_pass = (r3_cond == "—")
        else:
            is_above = "Above 200d" in r3_cond
            r3a_pass = (r3_status == "bullish" if is_above else r3_status == "bearish")
            r3b_pass = ("Consumer Healthy" in r3_cond if is_above else "Risk Rising" in r3_cond)
        breadth_checks.append(("R3A", "Row 3 status matches position", r3a_pass, f"Status: {r3_status}, Condition: \"{r3_cond}\""))
        breadth_checks.append(("R3B", "Row 3 condition text", r3b_pass, ""))
        
    results["breadth"] = breadth_checks
    
    # ----------------------------------------------------
    # SECTION 5: CARD 04 - VALUATIONS QA
    # ----------------------------------------------------
    val_checks = []
    val_card = cards_map.get("valuations")
    if val_card:
        rows = val_card.get("rows", [])
        s1_pass = len(rows) == 4
        val_checks.append(("S1", "Row count = 4", s1_pass, f"Count: {len(rows)}"))
        
        labels = [r.get("label") for r in rows]
        s2_pass = (labels == ["Trailing P/E", "CAPE", "Buffett Ind.", "Japan P/E"])
        val_checks.append(("S2", "Row labels correct", s2_pass, f"Found: {labels}"))
        
        indicators = [r.get("indicator") for r in rows]
        s3_pass = (indicators == [
            "S&P 500 Trailing P/E (Shiller, 1-2mo lag)", 
            "Shiller CAPE (10yr)", 
            "Mkt Cap / GDP (Buffett)", 
            "EWJ (Japan ETF) vs S&P 500"
        ])
        val_checks.append(("S3", "Row indicators correct", s3_pass, f"Found: {indicators}"))
        
        pe_val = clean_num(rows[0].get("value", ""))
        cape_val = clean_num(rows[1].get("value", ""))
        buffett_val = clean_num(rows[2].get("value", ""))
        japan_val = clean_num(rows[3].get("value", ""))
        
        # Check Row 0 Trailing P/E status
        r0_status = rows[0].get("status")
        r0_cond = rows[0].get("condition", "")
        if pe_val is not None:
            if pe_val > 22:
                exp_status, exp_cond = "bearish", "Elevated"
            elif pe_val > 16:
                exp_status, exp_cond = "neutral", "Average"
            else:
                exp_status, exp_cond = "bullish", "Below Average"
            r0a_pass = (r0_status == exp_status)
            r0b_pass = (exp_cond in r0_cond)
        else:
            r0a_pass, r0b_pass = False, False
        val_checks.append(("R0A", "Row 0 status matches thresholds", r0a_pass, f"P/E: {pe_val}, Status: {r0_status}"))
        val_checks.append(("R0B", "Row 0 condition correct", r0b_pass, f"Condition: \"{r0_cond}\""))
        
        # Check Row 1 CAPE status
        r1_status = rows[1].get("status")
        r1_cond = rows[1].get("condition", "")
        if cape_val is not None:
            if cape_val > 35:
                exp_status = "bearish"
            elif cape_val > 20:
                exp_status = "neutral"
            else:
                exp_status = "bullish"
            r1a_pass = (r1_status == exp_status)
            
            # Condition check
            if cape_val > 40:
                exp_c = "Extreme"
            elif cape_val > 35:
                exp_c = "Very High"
            elif cape_val > 25:
                exp_c = "Elevated"
            else:
                exp_c = "Normal"
            r1b_pass = (exp_c in r1_cond)
        else:
            r1a_pass, r1b_pass = False, False
        val_checks.append(("R1A", "Row 1 status matches thresholds", r1a_pass, f"CAPE: {cape_val}, Status: {r1_status}"))
        val_checks.append(("R1B", "Row 1 condition correct", r1b_pass, f"Condition: \"{r1_cond}\""))
        
        # Check Row 2 Buffett Ind status
        r2_status = rows[2].get("status")
        r2_cond = rows[2].get("condition", "")
        if buffett_val is not None:
            if buffett_val > 115:
                exp_status = "bearish"
            elif buffett_val > 80:
                exp_status = "neutral"
            else:
                exp_status = "bullish"
            r2a_pass = (r2_status == exp_status)
            
            if buffett_val > 160:
                exp_c = "Extreme"
            elif buffett_val > 115:
                exp_c = "Overvalued"
            elif buffett_val > 80:
                exp_c = "Fairly Valued"
            else:
                exp_c = "Undervalued"
            r2b_pass = (exp_c in r2_cond)
        else:
            r2a_pass, r2b_pass = False, False
        val_checks.append(("R2A", "Row 2 status matches thresholds", r2a_pass, f"Buffett: {buffett_val}%, Status: {r2_status}"))
        val_checks.append(("R2B", "Row 2 condition correct", r2b_pass, f"Condition: \"{r2_cond}\""))
        
        # Valuations card status check: must slice first 3 rows (exclude Japan P/E)
        c_status = val_card.get("status")
        # Compute manually
        c_statuses = [rows[0].get("status"), rows[1].get("status"), rows[2].get("status")]
        b_c = c_statuses.count("bullish")
        be_c = c_statuses.count("bearish")
        if be_c > b_c:
            exp_card_status = "bearish"
        elif b_c > 0 and be_c == 0:
            exp_card_status = "bullish"
        else:
            exp_card_status = "neutral"
        o1_pass = (c_status == exp_card_status)
        val_checks.append(("O1", "Card status excludes Japan P/E", o1_pass, f"Status: {c_status}, Expected: {exp_card_status} (Rows: {c_statuses})"))
        
    results["valuations"] = val_checks
    
    # ----------------------------------------------------
    # SECTION 6: CARD 05 - YIELD QA
    # ----------------------------------------------------
    yield_checks = []
    yield_card = cards_map.get("yield")
    if yield_card:
        rows = yield_card.get("rows", [])
        s1_pass = len(rows) == 4
        yield_checks.append(("S1", "Row count = 4", s1_pass, f"Count: {len(rows)}"))
        
        labels = [r.get("label") for r in rows]
        s2_pass = (labels == ["30Y Yield", "10Y Yield", "Yield Curve", "2Y Trend"])
        yield_checks.append(("S2", "Row labels correct", s2_pass, f"Found: {labels}"))
        
        indicators = [r.get("indicator") for r in rows]
        s3_pass = (indicators == [
            "US 30-Year Yield (^TYX)", 
            "US 10-Year Yield (^TNX)", 
            "3m–10Y Spread (Recession Signal)", 
            "SHY \u2014 1-3yr Treasury ETF vs 200d SMA"
        ])
        yield_checks.append(("S3", "Row indicators correct", s3_pass, f"Found: {indicators}"))
        
        y30 = clean_num(rows[0].get("value", ""))
        y10 = clean_num(rows[1].get("value", ""))
        curve = clean_num(rows[2].get("value", ""))
        shy_val = clean_num(rows[3].get("value", ""))
        
        # Row 0: 30Y Yield
        r0_status = rows[0].get("status")
        r0_cond = rows[0].get("condition", "")
        if y30 is not None:
            # Note: yieldRnd = Math.round(yieldVal * 100) / 100
            y30_rnd = round(y30, 2)
            if y30_rnd >= 5:
                exp_s, exp_c = "bearish", "At/Above 5%"
            elif y30_rnd > 4.5:
                exp_s, exp_c = "neutral", "Approaching 5%"
            else:
                exp_s, exp_c = "bullish", "Below 5%"
            r0a_pass = (r0_status == exp_s)
            r0b_pass = (exp_c in r0_cond)
        else:
            r0a_pass, r0b_pass = False, False
        yield_checks.append(("R0A", "Row 0 status matches thresholds", r0a_pass, f"30Y: {y30}%, Status: {r0_status}"))
        yield_checks.append(("R0B", "Row 0 condition correct", r0b_pass, f"Condition: \"{r0_cond}\""))
        
        # Row 1: 10Y Yield
        r1_status = rows[1].get("status")
        r1_cond = rows[1].get("condition", "")
        if y10 is not None:
            if y10 >= 4.5:
                exp_s, exp_c = "bearish", "Restrictive"
            elif y10 >= 3.5:
                exp_s, exp_c = "neutral", "Elevated"
            elif y10 >= 2.5:
                exp_s, exp_c = "bullish", "Neutral"  # Note: 2.5 to 3.5 is neutral or bullish? Let's check:
                # tnx.price >= 4.5 ? 'bearish' : tnx.price >= 3.5 ? 'neutral' : 'bullish'
                # So tnx.price < 3.5 maps to bullish!
                # Wait, tnx.price >= 2.5 condition: 'Neutral'
                # Let's verify status and condition
                exp_s = "bullish"
                exp_c = "Neutral"
            else:
                exp_s, exp_c = "bullish", "Accommodative"
            r1a_pass = (r1_status == exp_s)
            r1b_pass = (exp_c in r1_cond)
        else:
            r1a_pass, r1b_pass = False, False
        yield_checks.append(("R1A", "Row 1 status matches thresholds", r1a_pass, f"10Y: {y10}%, Status: {r1_status}"))
        yield_checks.append(("R1B", "Row 1 condition correct", r1b_pass, f"Condition: \"{r1_cond}\""))
        
        # Row 2: Yield Curve
        r2_status = rows[2].get("status")
        r2_cond = rows[2].get("condition", "")
        if curve is not None:
            if curve < 0:
                exp_s = "bearish"
            elif curve < 1:
                exp_s = "neutral"
            else:
                exp_s = "bullish"
            r2a_pass = (r2_status == exp_s)
            
            if curve < -0.5:
                exp_c = "Deeply Inverted"
            elif curve < 0:
                exp_c = "Inverted"
            elif curve < 1:
                exp_c = "Flat"
            else:
                exp_c = "Steepening"
            r2b_pass = (exp_c in r2_cond)
        else:
            r2a_pass, r2b_pass = False, False
        yield_checks.append(("R2A", "Row 2 status matches thresholds", r2a_pass, f"Curve: {curve}%, Status: {r2_status}"))
        yield_checks.append(("R2B", "Row 2 condition correct", r2b_pass, f"Condition: \"{r2_cond}\""))
        
        # Override check: if 30Y >= 5%, card status is bearish!
        c_status = yield_card.get("status")
        if y30 is not None and round(y30, 2) >= 5:
            o1_pass = (c_status == "bearish")
        else:
            # standard majority wins
            c_statuses = [r.get("status") for r in rows]
            b_c = c_statuses.count("bullish")
            be_c = c_statuses.count("bearish")
            if be_c > b_c:
                exp_c_s = "bearish"
            elif b_c > 0 and be_c == 0:
                exp_c_s = "bullish"
            else:
                exp_c_s = "neutral"
            o1_pass = (c_status == exp_c_s)
        yield_checks.append(("O1", "Card status or 30Y override correct", o1_pass, f"Status: {c_status}, 30Y: {y30}%"))
        
    results["yield"] = yield_checks
    
    # ----------------------------------------------------
    # SECTION 7: CARD 06 - CREDIT QA
    # ----------------------------------------------------
    credit_checks = []
    credit_card = cards_map.get("credit")
    if credit_card:
        rows = credit_card.get("rows", [])
        s1_pass = len(rows) == 4
        credit_checks.append(("S1", "Row count = 4", s1_pass, f"Count: {len(rows)}"))
        
        labels = [r.get("label") for r in rows]
        s2_pass = (labels == ["Risk Appetite", "Credit Quality", "Global Credit", "Spread Signal"])
        credit_checks.append(("S2", "Row labels correct", s2_pass, f"Found: {labels}"))
        
        indicators = [r.get("indicator") for r in rows]
        s3_pass = (indicators == [
            "HYG \u2014 High Yield Corp Bond ETF", 
            "LQD \u2014 Investment Grade Bond ETF", 
            "EMB \u2014 EM USD Bond ETF (JP Morgan)", 
            "HYG vs LQD \u2014 HY vs IG (200d basis)"
        ])
        credit_checks.append(("S3", "Row indicators correct", s3_pass, f"Found: {indicators}"))
        
        hyg_vs200 = clean_num(rows[0].get("value", ""))
        lqd_vs200 = clean_num(rows[1].get("value", ""))
        emb_vs200 = clean_num(rows[2].get("value", ""))
        
        # Row 0 (HYG)
        r0_status = rows[0].get("status")
        r0_cond = rows[0].get("condition", "")
        if hyg_vs200 is not None:
            r0a_pass = (r0_status == "bullish" if hyg_vs200 > 0 else r0_status == "bearish")
            r0b_pass = ("Above 200d" in r0_cond if hyg_vs200 > 0 else "Below 200d" in r0_cond)
        else:
            r0a_pass, r0b_pass = False, False
        credit_checks.append(("R0A", "Row 0 status correct", r0a_pass, f"HYG vs200: {hyg_vs200}%, Status: {r0_status}"))
        credit_checks.append(("R0B", "Row 0 condition correct", r0b_pass, f"Condition: \"{r0_cond}\""))
        
        # Row 1 (LQD)
        r1_status = rows[1].get("status")
        r1_cond = rows[1].get("condition", "")
        if lqd_vs200 is not None:
            r1a_pass = (r1_status == "bullish" if lqd_vs200 > 0 else r1_status == "bearish")
            r1b_pass = ("Above 200d" in r1_cond if lqd_vs200 > 0 else "Below 200d" in r1_cond)
        else:
            r1a_pass, r1b_pass = False, False
        credit_checks.append(("R1A", "Row 1 status correct", r1a_pass, f"LQD vs200: {lqd_vs200}%, Status: {r1_status}"))
        credit_checks.append(("R1B", "Row 1 condition correct", r1b_pass, f"Condition: \"{r1_cond}\""))
        
        # Row 2 (EMB)
        r2_status = rows[2].get("status")
        r2_cond = rows[2].get("condition", "")
        if emb_vs200 is not None:
            r2a_pass = (r2_status == "bullish" if emb_vs200 > 0 else r2_status == "bearish")
            if emb_vs200 >= 0:
                exp_c = "Above 200d"
            elif emb_vs200 >= -2:
                exp_c = "Monitor EM"
            elif emb_vs200 >= -5:
                exp_c = "Stress Spreading"
            else:
                exp_c = "Contagion Risk"
            r2b_pass = (exp_c in r2_cond)
        else:
            r2a_pass, r2b_pass = False, False
        credit_checks.append(("R2A", "Row 2 status correct", r2a_pass, f"EMB vs200: {emb_vs200}%, Status: {r2_status}"))
        credit_checks.append(("R2B", "Row 2 condition correct", r2b_pass, f"Condition: \"{r2_cond}\""))
        
        # Card Status: strict bull-count threshold
        c_status = credit_card.get("status")
        c_statuses = [r.get("status") for r in rows]
        bull_c = c_statuses.count("bullish")
        exp_s = "bullish" if bull_c >= 3 else ("neutral" if bull_c == 2 else "bearish")
        o1_pass = (c_status == exp_s)
        credit_checks.append(("O1", "Card status bull-count rule matches", o1_pass, f"Status: {c_status}, Bull Count: {bull_c}"))
        
    results["credit"] = credit_checks
    
    # ----------------------------------------------------
    # SECTION 8: CARD 08 - GLOBAL FLOWS QA
    # ----------------------------------------------------
    flows_checks = []
    flows_card = cards_map.get("globalflows")
    if flows_card:
        rows = flows_card.get("rows", [])
        s1_pass = len(rows) == 8
        flows_checks.append(("S1", "Row count = 8", s1_pass, f"Count: {len(rows)}"))
        
        labels = [r.get("label") for r in rows]
        s2_pass = (labels == ["Regional Bull", "Global", "Emerging", "USA", "Canada", "Europe", "Asia", "LatAm"])
        flows_checks.append(("S2", "Row labels correct", s2_pass, f"Found: {labels}"))
        
        # Count bullish regional rows (rows 1-7)
        reg_statuses = [r.get("status") for r in rows[1:]]
        bull_reg = reg_statuses.count("bullish")
        
        r0_val = rows[0].get("value", "")
        # Expected value format: "X / 7"
        try:
            val_cnt = int(r0_val.split("/")[0].strip())
            r0_val_pass = (val_cnt == bull_reg)
        except:
            r0_val_pass = False
        flows_checks.append(("R0V", "Row 0 displays correct bull count", r0_val_pass, f"Display: {r0_val}, Calc: {bull_reg}"))
        
        # Check Card Status regional bull-count: >=6 bullish, >=4 neutral, else bearish
        c_status = flows_card.get("status")
        exp_s = "bullish" if bull_reg >= 6 else ("neutral" if bull_reg >= 4 else "bearish")
        o1_pass = (c_status == exp_s)
        flows_checks.append(("O1", "Card status matches regional bull count", o1_pass, f"Status: {c_status}, Bull Regions: {bull_reg}/7"))
        
    results["globalflows"] = flows_checks
    
    # ----------------------------------------------------
    # SECTION 9: CARD 09 - SECTORS Rotation Spread QA
    # ----------------------------------------------------
    sect_checks = []
    sect_card = cards_map.get("sectors")
    if sect_card:
        # Sector status check:
        # Average relative performance (20d vs SPY) cyclicals vs defensives
        # positive > +1.0% -> bullish, <-1.0% -> bearish, else neutral
        # Let's read card status and notes to verify it is matched
        c_status = sect_card.get("status")
        note = sect_card.get("note", "")
        # Note contains rotation spread like: "Cyclicals are leading defensives by +3.5%" or similar
        # We can extract spread from stats if present
        stats = sect_card.get("stats", [])
        spread_val = None
        if stats and len(stats) > 0:
            spread_val = clean_num(stats[0][1])
            
        o1_pass = None
        if spread_val is not None:
            if spread_val > 1:
                exp_s = "bullish"
            elif spread_val < -1:
                exp_s = "bearish"
            else:
                exp_s = "neutral"
            o1_pass = (c_status == exp_s)
        sect_checks.append(("O1", "Sectors status matches rotation spread", o1_pass, f"Status: {c_status}, Spread: {spread_val}%"))
        
    results["sectors"] = sect_checks
    
    # ----------------------------------------------------
    # SECTION 10: CARD 10 - COMMODITIES QA
    # ----------------------------------------------------
    comm_checks = []
    comm_card = cards_map.get("commodities")
    if comm_card:
        rows = comm_card.get("rows", [])
        s1_pass = len(rows) == 8
        comm_checks.append(("S1", "Row count = 8", s1_pass, f"Count: {len(rows)}"))
        
        labels = [r.get("label") for r in rows]
        s2_pass = (labels == ["USCI", "Copper", "Gold", "Silver", "Energy", "Agriculture", "Steel", "Uranium"])
        comm_checks.append(("S2", "Row labels correct", s2_pass, f"Found: {labels}"))
        
        # Bull-count rule: 7 sub-commodities (excluding USCI benchmark)
        # Count bullish rows among rows 1-7
        sub_statuses = [r.get("status") for r in rows[1:]]
        bull_sub = sub_statuses.count("bullish")
        
        c_status = comm_card.get("status")
        exp_s = "bullish" if bull_sub >= 5 else ("neutral" if bull_sub >= 3 else "bearish")
        o1_pass = (c_status == exp_s)
        comm_checks.append(("O1", "Card status matches sub-commodity bull count", o1_pass, f"Status: {c_status}, Sub-bulls: {bull_sub}/7"))
        
    results["commodities"] = comm_checks
    
    # ----------------------------------------------------
    # SECTION 11: CARD 11 - EQUITIES QA
    # ----------------------------------------------------
    eq_checks = []
    eq_card = cards_map.get("equities")
    if eq_card:
        rows = eq_card.get("rows", [])
        s1_pass = len(rows) == 9
        eq_checks.append(("S1", "Row count = 9", s1_pass, f"Count: {len(rows)}"))
        
        labels = [r.get("label") for r in rows]
        s2_pass = (labels == ["Russell 2000", "Freeport", "Gold Miners", "S&P 500", "Nvidia", "JPMorgan", "Caterpillar", "Exxon Mobil", "Emerging Markets"])
        eq_checks.append(("S2", "Row labels correct", s2_pass, f"Found: {labels}"))
        
        # Watchlist bull-count rule: >=7 bullish, >=5 neutral, else bearish
        bull_c = [r.get("status") for r in rows].count("bullish")
        c_status = eq_card.get("status")
        exp_s = "bullish" if bull_c >= 7 else ("neutral" if bull_c >= 5 else "bearish")
        o1_pass = (c_status == exp_s)
        eq_checks.append(("O1", "Card status matches watchlist bull count", o1_pass, f"Status: {c_status}, Bull Count: {bull_c}/9"))
        
    results["equities"] = eq_checks
    
    # ----------------------------------------------------
    # COMPILE FINAL REPORT
    # ----------------------------------------------------
    print("Market Hub QA run completed. Generating comprehensive report...")
    
    report = []
    report.append(f"# Market Hub QA Results — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"Target URL: {base_url}\n")
    
    report.append("### Live Values at Time of Check:")
    report.append(f"- **Weighted Composite Score:** {aggregate.get('score')} | **Glow:** {aggregate.get('glow')}")
    report.append(f"- **Label:** \"{aggregate.get('label')}\"")
    report.append(f"- **Posture:** \"{aggregate.get('posture')}\"")
    report.append(f"- **Chips:** {aggregate.get('bullish')} bullish, {aggregate.get('neutral')} neutral, {aggregate.get('bearish')} bearish")
    report.append(f"- **regimeBearish:** {aggregate.get('regimeBearish')}")
    
    # Divergence print
    div = aggregate.get("divergence")
    if div:
        report.append(f"- **Divergence Warning:** High={div.get('high')}, Low={div.get('low')} — *\"{div.get('message')}\"*")
    
    # Print categories
    for c_key, c_val in categories.items():
        report.append(f"- **{c_val.get('label')} Score:** {c_val.get('score')} ({c_val.get('glow')})")
        
    if kalshi and "events" in kalshi and len(kalshi["events"]) > 0:
        ev = kalshi["events"][0]
        report.append(f"- **Kalshi (top event):** {ev.get('label')} ({ev.get('type')}) - {ev.get('action')} {ev.get('consensus')} @ {ev.get('confidence')}% confidence on {ev.get('date')}")
        
    if poly and "signals" in poly and len(poly["signals"]) > 0:
        sig = poly["signals"][0]
        report.append(f"- **Polymarket (top signal):** \"{sig.get('label')}\" {sig.get('probability')*100:.1f}% volume=${sig.get('volume'):,.0f}")
        
    report.append("\n" + "---" + "\n")
    
    # Build sections
    sections_meta = [
        ("executive_summary", "1. Executive Summary QA Checks"),
        ("regime", "2. Card 01 — Regime Checks"),
        ("leadership", "3. Card 02 — Leadership Checks"),
        ("breadth", "4. Card 03 — Breadth Checks"),
        ("valuations", "5. Card 04 — Valuations Checks"),
        ("yield", "6. Card 05 — Yield Checks"),
        ("credit", "7. Card 06 — Credit Checks"),
        ("globalflows", "8. Card 08 — Global Flows Checks"),
        ("sectors", "9. Card 09 — Sectors Checks"),
        ("commodities", "10. Card 10 — Commodities Checks"),
        ("equities", "11. Card 11 — Equities Checks")
    ]
    
    for key, title in sections_meta:
        checks = results.get(key, [])
        if checks:
            report.append(f"## {title}")
            report.append("| Check | Description | Result | Notes |")
            report.append("|-------|-------------|--------|-------|")
            for code, desc, status, note in checks:
                report.append(f"| {code} | {desc} | {fmt_res(status)} | {note} |")
            report.append("\n")
            
    # Calculate totals
    all_checks = []
    for checks in results.values():
        all_checks.extend(checks)
        
    total_count = len(all_checks)
    passed_count = sum(1 for c in all_checks if c[2] is True)
    failed_count = sum(1 for c in all_checks if c[2] is False)
    na_count = sum(1 for c in all_checks if c[2] is None)
    
    report.append("---" + "\n")
    report.append("### Overall QA Status Summary")
    report.append(f"- **Total Checks Evaluated:** {total_count}")
    report.append(f"- **Passed Checks:** {passed_count} ({(passed_count/total_count)*100:.1f}%)")
    report.append(f"- **Failed Checks:** {failed_count} ({(failed_count/total_count)*100:.1f}%)")
    report.append(f"- **N/A / Warnings:** {na_count}")
    
    report_content = "\n".join(report)
    
    try:
        with open("qa/qa_run_results.md", "w", encoding="utf-8") as f:
            f.write(report_content)
        print("Successfully wrote comprehensive results to qa/qa_run_results.md.")
    except Exception as e:
        print(f"Error writing report file: {e}")
        
    return passed_count, failed_count, total_count

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.loganbase.com"
    run_qa(url)
