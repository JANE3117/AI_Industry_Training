# src/

Agent runtime goes here once we have the missing pieces: the Qwen
tool-calling loop (via the `agent-brain` LiteLLM alias), the
`query_data`/`retrieve` tool implementations against the real RBA/ASX/AFR
datasets, the call out to the fine-tuned Nemotron for final synthesis, and
the `GET /health` / `POST /query` server. See `../../NOTES.md` for the
planned shape and exactly what's blocking this.
