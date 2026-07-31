import os

LITELLM_BASE_URL = os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1")
LITELLM_KEY = os.environ.get("LITELLM_KEY", "sk-local-cluster")
BRAIN_MODEL = os.environ.get("BRAIN_MODEL", "agent-brain")
DOMAIN_FT_MODEL = os.environ.get("DOMAIN_FT_MODEL", "domain-ft")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "local-embed")
# "local_tfidf" (default) needs no cluster access -- see tools/embed.py.
# Switch to "llm" once the organizer-supplied EMBED_MODEL is reachable.
EMBED_MODE = os.environ.get("EMBED_MODE", "local_tfidf")
# "mock" is the pre-training bootstrap default. Must be "llm" before official
# evaluation, per Setup_Instructions.md, or the fine-tuned model is never used.
DOMAIN_PREDICT_MODE = os.environ.get("DOMAIN_PREDICT_MODE", "mock")
MAX_AGENT_STEPS = int(os.environ.get("MAX_AGENT_STEPS", "6"))
