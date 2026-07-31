"""One-time offline build step for the AFR semantic (vector) index.

Run this once before using semantic_retrieve (not needed for the exact
count/count_by_month/share metrics, which use build_fts_index.py instead):

    .venv/bin/python src/tools/build_vector_index.py

Builds three files next to this script, all gitignored like afr_fts.db:
- afr_tfidf_vectorizer.pkl -- the fitted stand-in embedder (see embed.py)
- afr_vectors.faiss        -- the FAISS index (chosen over Qdrant after a
                               direct local benchmark, see
                               AFR_RAG_ARCHITECTURE.md)
- afr_vectors_meta.json    -- headline/intro/date per indexed article,
                               since FAISS stores only vectors + integer ids

Only headline + intro are embedded and stored (not the full article body)
to keep the metadata file a reasonable size across 219k articles -- that's
enough context for sentiment/direction questions per Setup_Instructions.md
("route retrieved AFR article text and the applicable RBA rate"), without
duplicating the 780MB corpus a second time.
"""

import glob
import json
import pickle
import time
from pathlib import Path

import faiss
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

AFR_DIR = Path(__file__).resolve().parents[2] / "data set" / "AFR"
HERE = Path(__file__).resolve().parent
VECTORIZER_PATH = HERE / "afr_tfidf_vectorizer.pkl"
INDEX_PATH = HERE / "afr_vectors.faiss"
META_PATH = HERE / "afr_vectors_meta.json"

DIM = 384


def build():
    start = time.time()
    docs = []
    for path in sorted(glob.glob(str(AFR_DIR / "*.jsonl"))):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                r = json.loads(line)
                docs.append({
                    "headline": r.get("HEADLINE", "") or "",
                    "intro": r.get("INTRO", "") or "",
                    "date": r.get("PUBLICATIONDATE", "") or "",
                })
    print(f"Loaded {len(docs)} AFR articles in {time.time() - start:.1f}s")

    texts = [f"{d['headline']} {d['intro']}" for d in docs]

    t0 = time.time()
    vectorizer = TfidfVectorizer(max_features=DIM, stop_words="english")
    X = vectorizer.fit_transform(texts).toarray().astype("float32")
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1
    X = X / norms
    print(f"Embedded (stand-in TF-IDF, dim={X.shape[1]}) in {time.time() - t0:.1f}s")

    t0 = time.time()
    index = faiss.IndexFlatIP(X.shape[1])
    index.add(X)
    faiss.write_index(index, str(INDEX_PATH))
    print(f"FAISS index built in {time.time() - t0:.1f}s -> {INDEX_PATH}")

    with open(VECTORIZER_PATH, "wb") as f:
        pickle.dump(vectorizer, f)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(docs, f)

    print(f"Saved vectorizer -> {VECTORIZER_PATH}")
    print(f"Saved metadata for {len(docs)} articles -> {META_PATH}")
    print(f"Total build time: {time.time() - start:.1f}s")


if __name__ == "__main__":
    build()
