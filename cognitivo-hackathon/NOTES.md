# Challenge notes — Cognitivo Hackathon

Distilled from the challenge brief PDF (exported 2026-07-30, same day as
this writing — the event looks imminent or already underway). This is
planning material for Jane + Claude; it is not part of the graded
submission.

## What we're building, in one paragraph

An agent that answers financial-market questions (about RBA interest-rate
decisions, ASX share prices, and AFR news) by calling data tools rather than
guessing, then writes a short, direct answer. It's judged on unseen
questions it has never been shown, on how well a small model was fine-tuned
to write the final answer, and on how clean the surrounding code is.

## The two-model pipeline (the most important rule in the brief)

| Model | Role | Do we fine-tune it? |
|---|---|---|
| **Qwen3.6-35B-A3B-FP8**, via a LiteLLM alias called `agent-brain` | Plans, chooses tools, writes tool-call arguments, reads tool results, decides when it has enough | **No — never.** The brief explicitly forbids training this one. |
| **Llama-3.1-Nemotron-Nano-8B-v1**, via `DOMAIN_FT_MODEL` | Takes the question + the *verified* tool results and writes the final answer | **Yes — this is the whole point of the fine-tuning requirement.** |

Application code (ours) sits in between: it takes Qwen's tool-call
requests, actually runs them against the approved local datasets, and
returns results to Qwen. Qwen never touches the data directly.

Getting this backwards — e.g. letting Nemotron pick tools, or skipping
Nemotron and just returning Qwen's answer — throws away the 30% "fine-tuned
model quality" score even if the answers happen to be correct.

## The exact contract we must implement

Incoming, one per request:
```json
{"question": "..."}
```

Outgoing:
```json
{
  "answer": "Direct answer with all requested values.",
  "steps": 3,
  "tool_trace": [
    {"tool": "tool_name", "args": {"param": "value"}, "result": "tool output summary"}
  ]
}
```
Only `answer` is scored automatically. `steps`/`tool_trace` are optional but
worth always filling in — they're the only way organizers can diagnose a
wrong answer, and they cost us nothing to produce since we already have the
trace internally.

The service must also expose:
- `GET /health` → HTTP 200
- `POST /query` → the response above

## Scoring — 30 / 30 / 40

- **30% fine-tuned model quality** — training data prep, config/hyperparameters,
  before/after comparison vs. the base Nemotron, and *evidence the fine-tuned
  model is actually wired into the running agent* (not just trained and
  shelved).
- **30% architecture and repository quality** — clean separation of the three
  responsibilities above, error handling/timeouts, a real README, reproducible
  training artifacts, no secrets committed.
- **40% hidden-question evaluation** — unseen questions, partial credit per
  sub-fact requested.

Roughly equal weight on "did you fine-tune well" and "is the code good" —
worth resisting the pull to spend all available time only on model quality.

## Traps — where the worked examples show teams losing points

1. **`GET /health` is a hard gate, not partial credit.** If it doesn't return
   200 during the pre-eval check, the team gets **zero** hidden-question points
   for that entire run — not a deduction, a skip. Keep it trivially reliable
   (no dependency on the LLM calls succeeding).
2. **Structured questions need a structured-data tool, not text search.** The
   brief's own "what zero looks like" examples show a retrieval/search tool
   over AFR news being asked to count RBA rate changes or find the longest
   unchanged streak — it can't, because that's not text search, it's
   filter/count/compare over a table. Design **`query_data`-style tools that
   compute exact numbers** (counts, streaks, sums, rankings) for RBA/ASX
   questions; save text retrieval for AFR *news* questions specifically.
3. **Response time is scored, separately from correctness.** ≤60s = full
   credit; 60–300s = lose 20% of *earned* points; >300s = zero for that
   question. The brief's own design target is **≤3 tool calls per question** —
   worth budgeting for explicitly rather than letting Qwen loop.
4. **Exact values matter.** The worked partial-credit example loses a third of
   its points over a single date being off by one day (`2010-11-03` vs. the
   expected `2010-11-02`). Equivalent formats/rounding are accepted per
   `grading.tolerance_note`, but wrong-by-one is still wrong.
5. **`DOMAIN_PREDICT_MODE` must be flipped from `mock` to `llm` before the real
   run.** Easy to forget after using mock mode for integration testing — if
   forgotten, the fine-tuned model is never actually called during
   evaluation.
6. **Don't hard-code answers to the 15 public practice questions.** They're
   calibration cases for us, explicitly not meant to be memorized.
7. **Concurrency: the harness sends up to 3 questions at once.** Whatever we
   build (agent runtime, tool layer, model servers) has to handle 3
   simultaneous `/query` calls without mixing up state between them — worth
   testing deliberately, not just assuming it works.

## The fine-tuning target, fact-checked

We didn't have training-data-cutoff confidence on this, so it was looked up:
**Llama-3.1-Nemotron-Nano-8B-v1** is a *dense*, standard decoder-only
Transformer — a post-trained derivative of Meta's Llama-3.1-8B-Instruct (SFT +
RL, tuned for reasoning/tool-calling), with a 128K context window. That
matters because it's architecturally **different from** the
`nvidia/nemotron-nano-9b-v2` model used in this same repo's
`llm-eval-nim-demo/` workshop — that one is a hybrid Mamba-Transformer model,
which is *why* that workshop's own LoRA notebook (03-Customizer) fine-tunes a
Llama-3.2-3B instead of its Nemotron (Mamba kernels aren't available on that
workshop's `aarch64` DGX Spark hardware). Nano-8B-v1 not being hybrid means
that specific blocker probably doesn't apply here — but "probably" is doing
work in that sentence: the AutoModel recipe/container would still need to be
checked against this exact model, on whatever hardware we actually train on,
before assuming it Just Works.

Sources: [PromptLayer model card](https://www.promptlayer.com/models/llama-31-nemotron-nano-8b-v1), [NVIDIA on Hugging Face](https://huggingface.co/nvidia/Llama-3.1-Nemotron-Nano-8B-v1), [unsloth mirror](https://huggingface.co/unsloth/Llama-3.1-Nemotron-Nano-8B-v1).

## The agent-brain, fact-checked

**Qwen3.6-35B-A3B-FP8**: a real, current Alibaba release — Mixture-of-Experts
(35B total parameters, ~3B active per token across 256 experts), hybrid
linear/gated attention, up to 262K context (extensible to 1M), Apache 2.0
licensed, strong specifically at agentic/tool-calling workflows. The `-FP8`
in the hackathon's name is just the quantized serving build — makes sense
for a shared, latency-sensitive "brain" endpoint many teams call into. This
lines up with its required role (fast planning + tool selection, not the
heavy synthesis work).

Sources: [Qwen3.6-35B-A3B on Hugging Face](https://huggingface.co/Qwen/Qwen3.6-35B-A3B), [OpenRouter listing](https://openrouter.ai/qwen/qwen3.6-35b-a3b).

## What's already in this repo that helps

- **`llm-eval-nim-demo/`** — a full NIM-deployment + NeMo Evaluator SDK +
  NeMo AutoModel (LoRA) workflow. The *pattern* (deploy → evaluate baseline →
  fine-tune → compare) is exactly the fine-tuning-quality deliverable this
  hackathon wants, and its `02-Evaluator_notebook.ipynb` (zero-shot vs. ICL,
  similarity metrics, LLM-as-judge) is a reasonable template for the
  base-vs-fine-tuned Nemotron comparison the rubric asks for. It fine-tunes a
  different model on different (legal) data, so it's a pattern to adapt, not
  code to reuse directly.
- **`langchain-basics/`** — a working async LangGraph agent with real tool
  definitions, an authorization-middleware pattern, and — most relevantly —
  a LangSmith eval dataset (`evals/dataset.py`) that scores *tool trajectory*
  (right tool, right arguments, in order), not just the final answer text.
  That's the same shape of check we'll want for "did Qwen call `query_data`
  correctly," even though we won't use LangSmith for the actual submission.
- **`my-app/`** — a minimal deployable LangGraph template. Could be a
  starting point for the agent runtime service, but its default server
  contract isn't `GET /health` / `POST /query` with this exact JSON shape, so
  it'd need a thin custom wrapper regardless of whether we start from this or
  from scratch.

## Proposed architecture (draft — will change once we have the real docs)

```
question
  -> Qwen (agent-brain, via LiteLLM) plans, emits a tool call
  -> our runtime validates + executes:
       - query_data(...)  for RBA/ASX: structured filter/count/calc, exact numbers
       - retrieve(...)    for AFR: text search over the news corpus
  -> result returns to Qwen; loop until Qwen has enough (budget: ~3 calls)
  -> question + verified tool results -> fine-tuned Nemotron (DOMAIN_FT_MODEL)
  -> Nemotron synthesizes the final answer
  -> wrapped as {"answer", "steps", "tool_trace"} -> POST /query response
```

## Resolved (2026-07-30)

- **Starter kit: confirmed none exists.** Cognitivo has not given the team a
  template repo. `DOMAIN_FT_MODEL` / `DOMAIN_PREDICT_MODE` / the "cluster
  bootstrap" are just the *contract* the brief describes in prose, not
  something pre-built we can go find — the agent runtime, the tool layer,
  and however `DOMAIN_FT_MODEL` gets served all have to be built from
  scratch. `llm-eval-nim-demo/` (NIM deploy pattern) and `langchain-basics/`
  (agent + tools pattern) are references to adapt, not shortcuts.
- **Team status: it's a team, and a submission repo already exists.**

## Resolved (2026-07-31)

- **The real team repo: `AI_Industry_Training_Hackathon`, confirmed by Jane.**
  Cloned locally at `../AI_Industry_Training_Hackathon` (sibling folder to
  this one), remote `https://github.com/cognitivo-aifactory/AI_Industry_Training_Hackathon.git`,
  branch `main`. Its root already matches the required `TeamSubmission/`
  layout exactly (`README.md`, `submission.json`, `src/`, `training/`,
  `logs/`, `Participant_Package/`) — real work happens there, directly at
  the repo root, not nested under a `TeamSubmission/` subfolder.
  **This `cognitivo-hackathon/` folder's own `TeamSubmission/` draft below is
  now superseded** — it was written before the real repo's location was
  known. Do not build there; it's kept only as Jane's original planning
  scratch.
- **All previously-blocked portal docs and data are now in the real repo's
  `Participant_Package/`**: `Setup_Instructions.md` (dataset schemas, AFR
  search rules, fine-tuning baseline config, model-serving endpoint table),
  `Challenge_Brief.md`, `submission-guide.md`, 3 handout docs
  (`01_training_guide.md`, `02_execution_guide.md`,
  `03_scoring_and_examples.md`), plus `questions_template.json`,
  `answer_template.json`, `submission_template.json`, `validate.json`, and
  `public_questions.jsonl` (15 real calibration questions with graded
  expected facts). The three approved datasets (`AFR/`, `ASX/`,
  `RBA Rates/`) are also already in the repo under `data set/`.
- **Concrete numbers now available** (from the handout docs, not guessable
  before): fine-tuning baseline reaches **+110% composite improvement**
  over base Nemotron at just the step-20 checkpoint (val loss 0.098); a full
  integrated pipeline (Qwen routing + tools + fine-tuned Nemotron) scored
  **~74–79%** on hidden questions, vs. **0%** for a no-tool-use baseline.
  Training a full 100-step run takes **~2–3 hours** on one GB10 node.

## Resolved (2026-07-31, later same day) — a fresh portal export

Jane exported `Setup Instructions` from the live portal again and it had a
row **missing from the copy already committed in the real repo**: the
Model Serving Endpoints table has a 4th row, "Agent HTTP server — Port
`8001` on the head node — Required, any other port fails." The team's own
`src/` agent (exposing `/health`/`/query`) must bind port **8001 on the
head node**, not the generic `:5000` shown as an example elsewhere in
submission-guide.md. Added to
`../AI_Industry_Training_Hackathon/Participant_Package/Setup_Instructions.md`
directly (with a note flagging it as a later addition), since that's the
team's working copy of this doc. **Not yet resolved: which of the two
cluster nodes counts as the "head node"** — ask an organizer before
deploying, since the brief elsewhere only names "brain/agent node" and
"fine-tuning/model node," not "head node."

Jane also believes the assigned cluster hostname is **`cognitivo_11`**
(unconfirmed which node this refers to — brain/agent, fine-tuning, or a
shared head node — and still need the actual IP address, since
`submission.json`'s `agent.endpoint` must use an IP, not a hostname).

**Follow-up same day**: Jane found `http://your-assigned-machine-ip:5000` in
the team submission material and flagged it against the 8001 requirement
above. Grepped the whole repo — `:5000` turns out to appear in **four**
places (`submission.json`, `Participant_Package/submission_template.json`,
`submission-guide.md`, `handout/02_execution_guide.md`'s architecture
diagram), all as the same generic illustrative example, none updated when
the "port 8001, required" line was added to Setup Instructions. This is a
real inconsistency in the organizers' own docs, not new information.
**Decision: trust the specific "Required... any other port will cause you
to fail" instruction over the four generic `:5000` examples** — updated
`submission.json`'s `agent.endpoint` port to 8001 accordingly (IP is still
the unresolved placeholder). Given a wrong port means the health-check gate
never gets reached at all (zero for the whole hidden-question run), this is
still worth a direct organizer confirmation before deploying, not just our
own best reading of conflicting docs.

## Still blocked on — need from teammates or organizers (not doc problems anymore)

Everything the portal docs could answer is now in `../AI_Industry_Training_Hackathon/Participant_Package/`.
What's left is team/event-logistics information no document will resolve:

- [ ] **Cluster access** — `~/.ssh/config`'s `team-atom` host was originally
      `ssh-gigabyte15.uiof.ai` / `cognitivo_g15`; Jane corrected it
      2026-07-31 to `ssh-gigabyte11.uiof.ai` / `cognitivo_g11` (team is 11,
      not 15 — likely a stale/wrong value from however this config was
      first generated). **Not yet verified against real hardware** — the
      connection attempt before this correction failed due to a Fortinet
      firewall on this (work/home) network doing TLS inspection on
      `uiof.ai`, unrelated to which team number was configured. **Must test
      from the event's own network or a connection without that content
      filtering** (e.g. mobile hotspot) — do not bypass the certificate
      check to work around it. Still need `~/team.env` (LiteLLM/agent-brain
      credentials) and the assigned IP for `submission.json` once a working
      connection is established.
- [ ] **The exact deadline/schedule** — when hidden-question evaluation
      runs, and when `submission.json`'s `commit_sha` needs to be locked in.
      Not in any doc read so far.
- [ ] **Jane's GitHub push access** on `AI_Industry_Training_Hackathon` —
      **confirmed missing, not just unconfirmed.** Tried `git push
      origin main` 2026-07-31 (3 local commits ready, working tree clean)
      and got `remote: Permission to
      cognitivo-aifactory/AI_Industry_Training_Hackathon.git denied to
      JANE3117` (403). Verified this isn't a login/auth mixup —
      `gh auth status` shows correctly logged in as `JANE3117` with `repo`
      scope on the token. **Someone with admin rights on the
      `cognitivo-aifactory` org needs to add `JANE3117` as a collaborator
      with write access** before any of the committed work (agent runtime,
      tools, RAG design, README updates — 3 commits, currently local-only)
      can reach the public repo.
- [ ] **Team role split** — who's covering agent runtime vs. fine-tuning vs.
      data prep, so effort here doesn't duplicate a teammate's work.
