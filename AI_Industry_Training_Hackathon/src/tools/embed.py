"""Text -> vector embeddings for AFR semantic retrieval.

EMBED_MODE=local_tfidf (default, no cluster needed): a TF-IDF vectorizer
fitted once by build_vector_index.py and persisted alongside the FAISS
index. This is a stand-in for real semantic understanding -- chosen so the
retrieval pipeline (indexing, FAISS search, RBA cross-referencing) could be
built and tested before cluster access to the real embedding model exists.

EMBED_MODE=llm: calls the organizer-supplied EMBED_MODEL alias via LiteLLM
once real embeddings are reachable. Swapping is a config change only --
afr_semantic.py just calls embed_texts(), nothing else in the pipeline
needs to know which mode produced the vectors. If the real model's
dimension differs from the 384 used here, build_vector_index.py must be
re-run so the FAISS index and query embeddings agree.
"""

import pickle
from pathlib import Path

from agent import config

VECTORIZER_PATH = Path(__file__).resolve().parent / "afr_tfidf_vectorizer.pkl"

_vectorizer = None


def _load_vectorizer():
    global _vectorizer
    if _vectorizer is None:
        with open(VECTORIZER_PATH, "rb") as f:
            _vectorizer = pickle.load(f)
    return _vectorizer


def embed_texts(texts):
    """Returns an (n, dim) float32 array of L2-normalized vectors."""
    if config.EMBED_MODE == "llm":
        return _embed_via_llm(texts)
    return _embed_local_tfidf(texts)


def _embed_local_tfidf(texts):
    import numpy as np

    vec = _load_vectorizer()
    X = vec.transform(texts).toarray().astype("float32")
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return X / norms


def _embed_via_llm(texts):
    import numpy as np
    from openai import OpenAI

    client = OpenAI(base_url=config.LITELLM_BASE_URL, api_key=config.LITELLM_KEY)
    resp = client.embeddings.create(model=config.EMBED_MODEL, input=texts)
    X = np.array([d.embedding for d in resp.data], dtype="float32")
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return X / norms
