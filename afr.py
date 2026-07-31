"""Retrieve tool for the AFR news corpus.

Setup_Instructions.md is explicit and non-negotiable about the search rules:
- search HEADLINE + SUBHEAD + INTRO + TEXT combined, case-insensitive
- count a record once even if the pattern matches more than one field
- whole-word patterns must use \\b boundaries (caller's responsibility,
  e.g. pattern=r"\\bNAB\\b") — this tool does not add boundaries itself,
  since some questions may legitimately want a substring match

Two lookup paths, see AFR_RAG_ARCHITECTURE.md:
- fast path: src/tools/afr_fts.db (SQLite FTS5), built by build_fts_index.py,
  used when `pattern` is a plain \\bword\\b or \\bWord-with-dots\\b term
  (the common case for the public questions seen so far)
- fallback: brute-force scan of every file, used when the index is missing
  or the pattern is more complex regex than a single literal term
"""

from datetime import datetime
from pathlib import Path
import glob
import json
import re
import sqlite3

AFR_DIR = Path(__file__).resolve().parents[2] / "data set" / "AFR"
FTS_DB_PATH = Path(__file__).resolve().parent / "afr_fts.db"

_FIELDS = ("HEADLINE", "SUBHEAD", "INTRO", "TEXT")

# AFR filenames are AFR_<start>-<end>.jsonl and every file covers exactly one
# calendar month (verified across the whole corpus) -- used to recover
# year/month for the ~92 records with a blank PUBLICATIONDATE, without
# fabricating a specific day we don't actually know.
_FILENAME_RE = re.compile(r"AFR_(\d{4})(\d{2})\d{2}-\d{8}\.jsonl$")

# A single literal word (letters/digits/./- internal chars) wrapped in \b
# boundaries -- FTS5's default tokenizer already only matches whole tokens,
# so translating this straight to an FTS MATCH query preserves the
# word-boundary semantics the challenge requires. Anything more complex
# (alternation, character classes, unanchored substrings) falls back to the
# brute-force scan instead of risking a wrong translation.
_SIMPLE_TERM_RE = re.compile(r"^\\b([A-Za-z0-9][A-Za-z0-9.\-]*)\\b$")


def _fallback_year_month(path):
    m = _FILENAME_RE.search(path)
    return f"{m.group(1)}-{m.group(2)}" if m else None


def _iter_records():
    """Yields every AFR record with best-effort date info attached.

    r['_date'] = parsed datetime if PUBLICATIONDATE is a valid YYYYMMDD,
    else None. r['_fallback_year_month'] = "YYYY-MM" derived from the
    source filename, used only when the record's own date is missing.
    """
    for path in sorted(glob.glob(str(AFR_DIR / "*.jsonl"))):
        fallback_ym = _fallback_year_month(path)
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                r = json.loads(line)
                pub = r.get("PUBLICATIONDATE", "")
                d = None
                if len(pub) == 8:
                    try:
                        d = datetime.strptime(pub, "%Y%m%d")
                    except ValueError:
                        d = None
                r["_date"] = d
                r["_fallback_year_month"] = fallback_ym
                yield r


def _matches(record, regex):
    combined = " ".join(record.get(f, "") or "" for f in _FIELDS)
    return regex.search(combined) is not None


def _brute_force(pattern, date_from=None, date_to=None):
    regex = re.compile(pattern, re.IGNORECASE)
    start = datetime.strptime(date_from, "%Y-%m-%d") if date_from else None
    end = datetime.strptime(date_to, "%Y-%m-%d") if date_to else None

    total_records = 0
    matched = 0
    by_year = {}
    by_year_month = {}
    excluded_missing_date = 0

    for r in _iter_records():
        d = r["_date"]

        if start or end:
            if d is None:
                if _matches(r, regex):
                    excluded_missing_date += 1
                continue
            if start and d < start:
                continue
            if end and d > end:
                continue

        total_records += 1
        if not _matches(r, regex):
            continue
        matched += 1

        if d is not None:
            y, ym = d.year, d.strftime("%Y-%m")
        elif r["_fallback_year_month"]:
            ym = r["_fallback_year_month"]
            y = int(ym[:4])
        else:
            y = ym = None
        if y is not None:
            by_year[y] = by_year.get(y, 0) + 1
            by_year_month[ym] = by_year_month.get(ym, 0) + 1

    return {
        "matched": matched,
        "total_records": total_records,
        "by_year": by_year,
        "by_year_month": by_year_month,
        "excluded_missing_date": excluded_missing_date,
    }


def _try_fts(pattern, date_from=None, date_to=None):
    """Returns the same shape as _brute_force(), or None to signal
    "can't serve this from the index, fall back to the brute-force scan"
    (index missing, or pattern isn't a simple literal term).
    """
    if not FTS_DB_PATH.exists():
        return None
    m = _SIMPLE_TERM_RE.match(pattern)
    if not m:
        return None
    term = m.group(1)

    conn = sqlite3.connect(FTS_DB_PATH)
    try:
        rows = conn.execute(
            "SELECT pub_date, fallback_ym FROM afr_fts WHERE afr_fts MATCH ?",
            (f'"{term}"',),
        ).fetchall()
    finally:
        conn.close()

    start = datetime.strptime(date_from, "%Y-%m-%d") if date_from else None
    end = datetime.strptime(date_to, "%Y-%m-%d") if date_to else None

    matched = 0
    by_year = {}
    by_year_month = {}
    excluded_missing_date = 0

    for pub_date, fallback_ym in rows:
        d = datetime.strptime(pub_date, "%Y%m%d") if len(pub_date) == 8 else None

        if start or end:
            if d is None:
                excluded_missing_date += 1
                continue
            if start and d < start:
                continue
            if end and d > end:
                continue

        matched += 1
        if d is not None:
            y, ym = d.year, d.strftime("%Y-%m")
        elif fallback_ym:
            ym = fallback_ym
            y = int(ym[:4])
        else:
            y = ym = None
        if y is not None:
            by_year[y] = by_year.get(y, 0) + 1
            by_year_month[ym] = by_year_month.get(ym, 0) + 1

    if start or end:
        total_records = _fts_total_in_range(date_from, date_to)
    else:
        total_records = _fts_total_all()

    return {
        "matched": matched,
        "total_records": total_records,
        "by_year": by_year,
        "by_year_month": by_year_month,
        "excluded_missing_date": excluded_missing_date,
    }


def _fts_total_all():
    conn = sqlite3.connect(FTS_DB_PATH)
    try:
        return conn.execute("SELECT COUNT(*) FROM afr_fts").fetchone()[0]
    finally:
        conn.close()


def _fts_total_in_range(date_from, date_to):
    conn = sqlite3.connect(FTS_DB_PATH)
    try:
        return conn.execute(
            "SELECT COUNT(*) FROM afr_fts WHERE pub_date >= ? AND pub_date <= ? AND pub_date != ''",
            (date_from.replace("-", ""), date_to.replace("-", "")),
        ).fetchone()[0]
    finally:
        conn.close()


def query_afr(metric, pattern=None, query=None, top_k=5, date_from=None, date_to=None, **kwargs):
    if metric == "semantic_retrieve":
        from tools.afr_semantic import semantic_retrieve

        q = query or pattern
        if not q:
            return {"error": "semantic_retrieve requires query (natural-language text, not a regex)"}
        return semantic_retrieve(q, top_k=top_k)

    if not pattern:
        return {"error": "afr queries require pattern (a Python regex)"}

    stats = _try_fts(pattern, date_from, date_to)
    if stats is None:
        stats = _brute_force(pattern, date_from, date_to)

    result = {"pattern": pattern, "matching_records": stats["matched"]}
    if stats["excluded_missing_date"]:
        result["excluded_missing_date"] = stats["excluded_missing_date"]

    if metric == "count":
        return result

    if metric == "count_by_month":
        by_year, by_year_month = stats["by_year"], stats["by_year_month"]
        peak_year = max(by_year, key=by_year.get) if by_year else None
        peak_ym = max(by_year_month, key=by_year_month.get) if by_year_month else None
        result.update({
            "by_year": by_year,
            "by_year_month": by_year_month,
            "peak_year": peak_year,
            "peak_year_count": by_year.get(peak_year),
            "peak_month": peak_ym,
            "peak_month_count": by_year_month.get(peak_ym),
        })
        return result

    if metric == "share":
        total = stats["total_records"]
        result.update({
            "total_records": total,
            "share_pct": (stats["matched"] / total * 100) if total else None,
        })
        return result

    return {"error": f"unknown afr metric: {metric}"}
