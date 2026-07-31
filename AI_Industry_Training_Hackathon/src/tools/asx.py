"""Deterministic query_data tool for the ASX company-price dataset.

One JSONL file per ticker under `data set/ASX/`, fields: ticker, date, open,
high, low, close, volume. Per the training/execution guides: ASX questions
that say "excluding Tabcorp" must pass exclude_tickers=["TAH.AX"].
"""

from datetime import datetime
from pathlib import Path
import glob
import json
import statistics

ASX_DIR = Path(__file__).resolve().parents[2] / "data set" / "ASX"

_cache = None


def _load_all():
    global _cache
    if _cache is not None:
        return _cache
    by_ticker = {}
    for path in glob.glob(str(ASX_DIR / "*.jsonl")):
        rows = []
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                r = json.loads(line)
                r["_date"] = datetime.strptime(r["date"], "%Y-%m-%d")
                rows.append(r)
        rows.sort(key=lambda r: r["_date"])
        if rows:
            by_ticker[rows[0]["ticker"]] = rows
    _cache = by_ticker
    return by_ticker


def _apply_exclude(by_ticker, exclude_tickers):
    if not exclude_tickers:
        return by_ticker
    return {t: rows for t, rows in by_ticker.items() if t not in exclude_tickers}


def _filter_dates(rows, date_from=None, date_to=None):
    out = rows
    if date_from:
        d = datetime.strptime(date_from, "%Y-%m-%d")
        out = [r for r in out if r["_date"] >= d]
    if date_to:
        d = datetime.strptime(date_to, "%Y-%m-%d")
        out = [r for r in out if r["_date"] <= d]
    return out


def _annual_return(rows, year):
    yr = [r for r in rows if r["_date"].year == year]
    if len(yr) < 2:
        return None
    return (yr[-1]["close"] - yr[0]["close"]) / yr[0]["close"] * 100


def _full_sample_return(rows):
    if len(rows) < 2:
        return None
    return (rows[-1]["close"] - rows[0]["close"]) / rows[0]["close"] * 100


def _max_drawdown(rows):
    peak = rows[0]["close"]
    worst = 0.0
    for r in rows:
        peak = max(peak, r["close"])
        dd = (r["close"] - peak) / peak * 100
        worst = min(worst, dd)
    return worst


def query_asx(metric, ticker=None, exclude_tickers=None, date_from=None, date_to=None, year=None, tickers=None, **kwargs):
    by_ticker = _apply_exclude(_load_all(), exclude_tickers)

    if metric == "dimensions":
        all_rows = _load_all()
        counts = {len(r) for r in all_rows.values()}
        starts = {r[0]["date"] for r in all_rows.values()}
        ends = {r[-1]["date"] for r in all_rows.values()}
        return {
            "num_tickers": len(all_rows),
            "rows_per_ticker": sorted(counts),
            "date_range_start": min(starts),
            "date_range_end": max(ends),
        }

    if metric == "full_sample_return":
        if ticker:
            rows = _filter_dates(by_ticker.get(ticker, []), date_from, date_to)
            return {"ticker": ticker, "return_pct": _full_sample_return(rows)}
        return {t: _full_sample_return(_filter_dates(rows, date_from, date_to)) for t, rows in by_ticker.items()}

    if metric == "annual_return":
        if not year:
            return {"error": "annual_return requires year"}
        if ticker:
            return {"ticker": ticker, "year": year, "return_pct": _annual_return(by_ticker.get(ticker, []), year)}
        return {t: _annual_return(rows, year) for t, rows in by_ticker.items()}

    if metric == "rank_annual_returns":
        if not year:
            return {"error": "rank_annual_returns requires year"}
        results = [(t, _annual_return(rows, year)) for t, rows in by_ticker.items()]
        results = [(t, r) for t, r in results if r is not None]
        results.sort(key=lambda kv: kv[1], reverse=True)
        return {"year": year, "ranked": [{"ticker": t, "return_pct": r} for t, r in results]}

    if metric == "avg_volume":
        if ticker:
            rows = _filter_dates(by_ticker.get(ticker, []), date_from, date_to)
            return {"ticker": ticker, "avg_volume": statistics.mean(r["volume"] for r in rows) if rows else None}
        return {t: statistics.mean(r["volume"] for r in _filter_dates(rows, date_from, date_to)) for t, rows in by_ticker.items()}

    if metric == "rank_avg_volume":
        results = []
        for t, rows in by_ticker.items():
            filtered = _filter_dates(rows, date_from, date_to)
            if filtered:
                results.append((t, statistics.mean(r["volume"] for r in filtered)))
        results.sort(key=lambda kv: kv[1], reverse=True)
        return {"ranked": [{"ticker": t, "avg_volume": v} for t, v in results]}

    if metric == "volatility":
        if not ticker:
            return {"error": "volatility requires ticker"}
        rows = _filter_dates(by_ticker.get(ticker, []), date_from, date_to)
        closes = [r["close"] for r in rows]
        if len(closes) < 2:
            return {"error": "not enough data points"}
        daily_returns = [(closes[i] - closes[i - 1]) / closes[i - 1] for i in range(1, len(closes))]
        return {"ticker": ticker, "daily_volatility_pct": statistics.pstdev(daily_returns) * 100}

    if metric == "max_drawdown":
        if not ticker:
            return {"error": "max_drawdown requires ticker"}
        rows = _filter_dates(by_ticker.get(ticker, []), date_from, date_to)
        return {"ticker": ticker, "max_drawdown_pct": _max_drawdown(rows)}

    if metric == "correlation":
        if not tickers or len(tickers) != 2:
            return {"error": "correlation requires tickers=[a, b]"}
        a_rows = {r["date"]: r["close"] for r in _filter_dates(by_ticker.get(tickers[0], []), date_from, date_to)}
        b_rows = {r["date"]: r["close"] for r in _filter_dates(by_ticker.get(tickers[1], []), date_from, date_to)}
        common = sorted(set(a_rows) & set(b_rows))
        if len(common) < 2:
            return {"error": "not enough overlapping dates"}
        a_vals = [a_rows[d] for d in common]
        b_vals = [b_rows[d] for d in common]
        return {"tickers": tickers, "correlation": statistics.correlation(a_vals, b_vals)}

    return {"error": f"unknown asx metric: {metric}"}
