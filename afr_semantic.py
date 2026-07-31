"""Semantic retrieval for AFR sentiment/context questions.

See AFR_RAG_ARCHITECTURE.md for the design and the FAISS-vs-Qdrant
benchmark behind choosing FAISS. Needs build_vector_index.py to have been
run first; degrades to an FTS5 keyword-plus-recency search (still no
cluster dependency) if the FAISS index isn't present -- a worse but honest
answer beats no answer, per the brief's own rule.
"""

import json
import re
import sqlite3
from pathlib import Path

HERE = Path(__file__).resolve().parent
INDEX_PATH = HERE / "afr_vectors.faiss"
META_PATH = HERE / "afr_vectors_meta.json"

_index = None
_meta = None


def available():
    return INDEX_PATH.exists() and META_PATH.exists()


def _load():
    global _index, _meta
    if _index is None:
        import faiss

        _index = faiss.read_index(str(INDEX_PATH))
        with open(META_PATH, encoding="utf-8") as f:
            _meta = json.load(f)
    return _index, _meta


def _rba_rate_on(date_yyyymmdd):
    if len(date_yyyymmdd) != 8:
        return None
    from tools.rba import query_rba

    iso_date = f"{date_yyyymmdd[:4]}-{date_yyyymmdd[4:6]}-{date_yyyymmdd[6:8]}"
    result = query_rba("lookup_rate", date_from=iso_date)
    return result.get("rate")


def semantic_retrieve(query, top_k=5):
    if not available():
        return _keyword_fallback(query, top_k)

    from tools.embed import embed_texts

    index, meta = _load()
    vec = embed_texts([query])
    scores, ids = index.search(vec, top_k)

    results = []
    for score, idx in zip(scores[0], ids[0]):
        if idx < 0:
            continue
        d = meta[idx]
        results.append({
            "headline": d["headline"],
            "intro": d["intro"],
            "date": d["date"],
            "rba_rate_at_date": _rba_rate_on(d["date"]),
            "similarity": float(score),
        })
    return {"query": query, "method": "faiss_semantic", "results": results}


def _keyword_fallback(query, top_k):
    from tools.afr import FTS_DB_PATH

    if not FTS_DB_PATH.exists():
        return {
            "query": query,
            "method": "unavailable",
            "results": [],
            "error": "neither the FAISS semantic index nor the FTS5 index is built",
        }

    terms = [t for t in re.findall(r"[A-Za-z0-9]+", query) if len(t) > 2]
    if not terms:
        return {"query": query, "method": "unavailable", "results": []}
    match_query = " OR ".join(terms)

    conn = sqlite3.connect(FTS_DB_PATH)
    try:
        rows = conn.execute(
            "SELECT headline, intro, pub_date FROM afr_fts WHERE afr_fts MATCH ? "
            "ORDER BY pub_date DESC LIMIT ?",
            (match_query, top_k),
        ).fetchall()
    finally:
        conn.close()

    results = [
        {
            "headline": h,
            "intro": i,
            "date": pub_date,
            "rba_rate_at_date": _rba_rate_on(pub_date),
            "similarity": None,
        }
        for h, i, pub_date in rows
    ]
    return {"query": query, "method": "fts_keyword_fallback", "results": results}
