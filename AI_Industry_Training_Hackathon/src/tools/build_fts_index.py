"""One-time offline build step for the AFR exact full-text index.

Run this once before starting the agent server:

    .venv/bin/python src/tools/build_fts_index.py

Builds src/tools/afr_fts.db from `data set/AFR/*.jsonl`. Safe to re-run --
drops and recreates the table each time. The approved dataset is fixed per
the challenge rules ("do not alter the source datasets"), so this only
needs to run once per deployment, not on every server start. See
AFR_RAG_ARCHITECTURE.md for why this exists (turns a ~12s brute-force scan
into a ~50ms lookup for the common case).
"""

import glob
import json
import re
import sqlite3
import time
from pathlib import Path

AFR_DIR = Path(__file__).resolve().parents[2] / "data set" / "AFR"
DB_PATH = Path(__file__).resolve().parent / "afr_fts.db"

# Every AFR file covers exactly one calendar month (verified across the
# whole corpus) -- used as a fallback for the ~92 records whose own
# PUBLICATIONDATE is blank in the source data, so they still bucket
# correctly by month instead of being silently dropped. See afr.py.
_FILENAME_RE = re.compile(r"AFR_(\d{4})(\d{2})\d{2}-\d{8}\.jsonl$")


def build():
    start = time.time()
    DB_PATH.unlink(missing_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        "CREATE VIRTUAL TABLE afr_fts USING fts5("
        "headline, subhead, intro, text, pub_date UNINDEXED, fallback_ym UNINDEXED, "
        "tokenize='unicode61')"
    )

    count = 0
    for path in sorted(glob.glob(str(AFR_DIR / "*.jsonl"))):
        m = _FILENAME_RE.search(path)
        fallback_ym = f"{m.group(1)}-{m.group(2)}" if m else ""
        rows = []
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                r = json.loads(line)
                rows.append((
                    r.get("HEADLINE", "") or "",
                    r.get("SUBHEAD", "") or "",
                    r.get("INTRO", "") or "",
                    r.get("TEXT", "") or "",
                    r.get("PUBLICATIONDATE", "") or "",
                    fallback_ym,
                ))
        conn.executemany(
            "INSERT INTO afr_fts (headline, subhead, intro, text, pub_date, fallback_ym) VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        count += len(rows)

    conn.close()
    print(f"Indexed {count} AFR records into {DB_PATH} in {time.time() - start:.1f}s")


if __name__ == "__main__":
    build()
