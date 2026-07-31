"""Deterministic query_data tool for the RBA cash-rate dataset.

Fields per Setup_Instructions.md: `Effective Date`, `Change % points`,
`Cash rate target%` (file is UTF-8 BOM encoded — must open with utf-8-sig).
"""

from datetime import datetime
from pathlib import Path
import json

RBA_PATH = Path(__file__).resolve().parents[2] / "data set" / "RBA Rates" / "RBA-rates.jsonl"


def _load_rows():
    rows = []
    with open(RBA_PATH, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            rows.append({
                "date": datetime.strptime(r["Effective Date"], "%d %b %Y"),
                "change": float(r["Change % points"]),
                "rate": float(r["Cash rate target%"]),
                "date_str": r["Effective Date"],
            })
    rows.sort(key=lambda r: r["date"])
    return rows


def _fmt(d):
    return d.strftime("%Y-%m-%d")


def query_rba(metric, **kwargs):
    rows = _load_rows()

    if metric == "count":
        return {"total_records": len(rows)}

    if metric == "count_changes":
        changed = [r for r in rows if r["change"] != 0]
        increases = [r for r in changed if r["change"] > 0]
        decreases = [r for r in changed if r["change"] < 0]
        return {
            "total_records": len(rows),
            "changed": len(changed),
            "increases": len(increases),
            "decreases": len(decreases),
        }

    if metric == "count_increases":
        return {"increases": sum(1 for r in rows if r["change"] > 0)}

    if metric == "count_decreases":
        return {"decreases": sum(1 for r in rows if r["change"] < 0)}

    if metric == "extremes":
        max_rate = max(r["rate"] for r in rows)
        min_rate = min(r["rate"] for r in rows)
        max_rows = [r for r in rows if r["rate"] == max_rate]
        min_rows = [r for r in rows if r["rate"] == min_rate]
        return {
            "max_rate": max_rate,
            "max_rate_first_effective_date": _fmt(max_rows[0]["date"]),
            "max_rate_record_count": len(max_rows),
            "min_rate": min_rate,
            "min_rate_first_effective_date": _fmt(min_rows[0]["date"]),
            "min_rate_record_count": len(min_rows),
        }

    if metric == "max_hold_streak":
        changed = [r for r in rows if r["change"] != 0]
        if len(changed) < 2:
            return {"error": "not enough rate changes to compute a hold streak"}
        best = None
        for a, b in zip(changed, changed[1:]):
            days = (b["date"] - a["date"]).days
            if best is None or days > best["days"]:
                best = {
                    "days": days,
                    "start_date": _fmt(a["date"]),
                    "end_date": _fmt(b["date"]),
                    "rate_during_hold": a["rate"],
                    "rate_after": b["rate"],
                }
        return best

    if metric == "lookup_rate":
        date_from = kwargs.get("date_from")
        if not date_from:
            return {"error": "lookup_rate requires date_from"}
        target = datetime.strptime(date_from, "%Y-%m-%d")
        candidates = [r for r in rows if r["date"] <= target]
        if not candidates:
            return {"error": f"no RBA record on or before {date_from}"}
        latest = max(candidates, key=lambda r: r["date"])
        return {"date": _fmt(latest["date"]), "rate": latest["rate"]}

    if metric == "cycle_summary":
        date_from = kwargs.get("date_from")
        date_to = kwargs.get("date_to")
        if not date_from or not date_to:
            return {"error": "cycle_summary requires date_from and date_to"}
        start = datetime.strptime(date_from, "%Y-%m-%d")
        end = datetime.strptime(date_to, "%Y-%m-%d")
        in_range = [r for r in rows if start <= r["date"] <= end]
        if not in_range:
            return {"error": f"no RBA records between {date_from} and {date_to}"}
        changed = [r for r in in_range if r["change"] != 0]
        increases = [r for r in changed if r["change"] > 0]
        decreases = [r for r in changed if r["change"] < 0]
        before = [r for r in rows if r["date"] < start]
        by_year = {}
        for r in changed:
            by_year[r["date"].year] = by_year.get(r["date"].year, 0) + 1
        return {
            "changes": len(changed),
            "increases": len(increases),
            "decreases": len(decreases),
            "changes_by_year": by_year,
            "cumulative_change": round(sum(r["change"] for r in changed), 2),
            "rate_before_first_change": before[-1]["rate"] if before else None,
            "rate_at_range_end": in_range[-1]["rate"],
        }

    if metric == "list":
        start = kwargs.get("date_from")
        end = kwargs.get("date_to")
        out = rows
        if start:
            s = datetime.strptime(start, "%Y-%m-%d")
            out = [r for r in out if r["date"] >= s]
        if end:
            e = datetime.strptime(end, "%Y-%m-%d")
            out = [r for r in out if r["date"] <= e]
        return {"records": [
            {"date": _fmt(r["date"]), "change": r["change"], "rate": r["rate"]} for r in out
        ]}

    return {"error": f"unknown rba metric: {metric}"}
