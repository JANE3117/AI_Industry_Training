# TMBL_X — Cognitivo Hackathon Agent

Everything below this section is our own project notes (how to run it, the
fine-tuning workflow). The organizer's reference material starts at
"# Team Submission" further down — unchanged from what they supplied.

## How to run this

There are two separate things to run: the agent server (works right now,
locally) and the fine-tuning job (only runs on the real GB10 cluster).

### 1. One-time setup

```bash
cd AI_Industry_Training_Hackathon
python3 -m venv .venv
.venv/bin/pip install fastapi uvicorn pydantic openai faiss-cpu scikit-learn
```

### 2. Build the AFR search indexes (one-time, ~1 minute total)

```bash
.venv/bin/python src/tools/build_fts_index.py       # ~45s, exact pattern/count search
.venv/bin/python src/tools/build_vector_index.py    # ~8s, semantic/sentiment search
```
These write local files under `src/tools/` (gitignored — not something to
commit, just something everyone running this needs to build once).

### 3. Run the agent server

```bash
PYTHONPATH=src .venv/bin/uvicorn agent.main:app --host 0.0.0.0 --port 8001
```
Port 8001 matches the "Agent HTTP server... Required" row in
`Participant_Package/Setup_Instructions.md` — not the generic `:5000` shown
elsewhere in the participant docs.

- `GET /health` works immediately, everywhere — it has no dependency on the
  cluster, by design (a hard requirement per the docs).
- `POST /query` needs a real `LITELLM_BASE_URL` to reach — until cluster
  access exists, it will fail with a connection error, which is expected,
  not a bug. Test it with:
  ```bash
  curl http://localhost:8001/health
  curl -X POST http://localhost:8001/query -H "Content-Type: application/json" \
    -d '{"question": "From the first RBA record to the last, how many cash-rate decisions changed the rate?"}'
  ```

### 4. Running for real, once on the cluster

```bash
ssh team-atom                          # onto the assigned head node
source ~/team.env                      # organizer-provided credentials
cd ~/AI_Industry_Training_Hackathon    # wherever this repo lives there
export DOMAIN_PREDICT_MODE=llm         # only once the fine-tuned adapter is actually being served — see below
PYTHONPATH=src .venv/bin/uvicorn agent.main:app --host 0.0.0.0 --port 8001
```
Then update `submission.json`'s `agent.endpoint` to `http://<real IP>:8001`
(an IP, not `localhost` or a hostname — the harness runs on a different
machine).

## Fine-tuning workflow

This part is entirely organizer-supplied scripts already living on the
fine-tuning/model node at `~/Cognitivo_Training/finagent-finetune` — we
don't write these, we just run them. **None of this can run from a laptop**,
it needs the real GB10 GPU. Full detail in
`Participant_Package/handout/01_training_guide.md`; this is the condensed
run order:

```bash
ssh team-atom                                    # or whichever node is assigned for fine-tuning
cd ~/Cognitivo_Training/finagent-finetune
source ~/team.env

# 1. Smoke test first (~30s) -- confirms the container/GPU/paths all work
#    before committing to a multi-hour run.
bash scripts/02_smoke_test.sh

# 2. Prepare training data from the same local datasets already in
#    data set/ here (organizer's script reads its own copies on the cluster).
python scripts/01_prepare_data.py \
  --afr_dir  "/home/cognitivo/Downloads/Jasonl format DataSets/AFR Jasonl" \
  --asx_dir  "/home/cognitivo/Downloads/Jasonl format DataSets/ASX-18-companies-2015-2021-Jasonl" \
  --rba_file "/home/cognitivo/Downloads/Jasonl format DataSets/RBA-Rates-2010-2026/RBA-rates.jsonl" \
  --out_dir  data/

# 3. Launch training inside tmux (survives SSH disconnects -- without this,
#    a dropped connection kills the whole multi-hour run).
tmux new-session -s train8b "bash scripts/07_train_8b_quicktest.sh"
tail -f /tmp/nemo_8b_test.log     # from another terminal/pane, to watch progress

# 4. Once training is done (or the step-20 checkpoint looks good --
#    it already shows meaningful improvement, no need to wait for step 100):
find "$MODELS_DIR/checkpoints" -type d -name hf_adapter
ADAPTER_CHECKPOINT="$MODELS_DIR/checkpoints/<your-run>/checkpoints/<checkpoint>/hf_adapter" \
  bash scripts/04_export_and_serve.sh
# This starts vLLM on port 8001 of the fine-tuning/model node, serving the adapter.
```

Then, back on the agent server (step 4 above), set `DOMAIN_FT_MODEL=domain-ft`
pointed at that vLLM endpoint and `DOMAIN_PREDICT_MODE=llm` — until then
the agent is using the mock synthesis path (`src/agent/synth.py`), which
answers correctly for testing but earns zero fine-tuned-model score.

**Known gotchas from the training guide, worth not rediscovering the hard way:**
- Must use `nvcr.io/nvidia/nemo:25.09` — `25.04` crashes on GB10.
- `LR=1e-4` causes a loss spike at step 50 — use the documented `5e-5`.
- `MAX_SEQ_LEN` over 512 runs out of memory on a single node.
- If training crashes before step 20, nothing is saved — restart from scratch.
- A full 100-step run takes **~2–3 hours** on one GB10 node — budget for it.

**Status: not yet run** — blocked on cluster network access (see project
notes), so there's no training evidence or base-vs-fine-tuned comparison in
`training/` yet. That's still a real gap against the submission checklist.

---

# Team Submission

Use this folder as the root of your team's fully public GitHub repository. Private repositories and
collaborator-only access are not supported. Replace the example values, add your source code and
training evidence, then submit the final repository URL and commit SHA.

```text
TeamSubmission/
  README.md
  submission.json
  src/
    .gitkeep
  training/
    .gitkeep
  logs/
    .gitkeep
  Participant_Package/
    answer_template.json
    Challenge_Brief.md
    public_questions.jsonl
    questions_template.json
    Setup_Instructions.md
    submission-guide.md
    submission_template.json
    validate.json
    handout/
      01_training_guide.md
      02_execution_guide.md
      03_scoring_and_examples.md
```

| Path | Required | Purpose |
|---|---:|---|
| `submission.json` | Yes | Team identity, pinned GitHub commit, agent endpoint, and fine-tuned model assessment information. |
| `src/` | Yes | Agent source code and any retrieval/data-query tools. |
| `training/` | Yes | Fine-tuning scripts, configs, preparation notes, logs, metrics, or model summary. |
| `logs/` | Yes | Non-sensitive run logs or screenshots useful for judging/debugging. |
| `Participant_Package/` | Yes | Challenge materials, examples, validation schema, and participant handouts. |

Files ending in `_template.json` are examples only. Edit the root `submission.json` for the final
team registration; use the question and answer templates to implement and test the `/query` API.

Use `src/` for the agent implementation submitted by your team. It must expose the required API
contract and implement the documented Qwen, tool-runtime, retrieval, and fine-tuned Nemotron flow.
Remove `.gitkeep` after adding source files.

Do not require `docs/`, `tests/`, `requirements.txt`, or Docker. The official Atom/shared
environment supplies common dependencies, and official scoring calls the registered agent endpoint.

## Agent Contract

The evaluation harness calls the endpoint declared in `submission.json`.

### Health Check

```http
GET /health
```

Must return HTTP 200. If this fails, the team is skipped.

Example:

```json
{"status": "ok"}
```

### Question Endpoint

```http
POST /query
Content-Type: application/json

{"question": "Hidden benchmark question"}
```

The returned JSON must include `answer`. The automated hidden-question judge grades only `answer`.
`steps` and `tool_trace` are optional and are retained only for private organizer diagnostics and
the submitting team's sanitized report. They do not appear on the public leaderboard.

The hidden-question harness may send up to **three concurrent `POST /query` requests per team**.
Your agent and model-serving stack must handle at least three simultaneous requests without mixing
responses or corrupting shared state. Organizers may lower this with `--workers`, but teams should
design for the documented default of three.

```json
{
  "answer": "41 of the 175 decision records changed the rate: 20 increases and 21 decreases.",
  "steps": 3,
  "tool_trace": [
    {
      "tool": "query_data",
      "args": {"dataset": "rba", "metric": "count_changes"},
      "result": "41 changes: 20 increases, 21 decreases"
    }
  ]
}
```

## Official Scoring

The final hackathon score combines three independently assessed categories:

| Category | Weight | Summary |
|---|---:|---|
| Fine-tuned model quality | 30% | Training quality, base-versus-fine-tuned improvement, robustness, evidence, and use of the fine-tuned model in the submitted solution. |
| Architecture and repository quality | 30% | Agent design, tools and retrieval, code quality, API compliance, reproducibility, documentation, training artifacts, logs, and repository hygiene. |
| Hidden-question evaluation | 40% | Component-based correctness on unseen questions, including partial credit and response-time penalties. |

```text
final_score =
    (fine_tuned_model_score * 0.30)
  + (architecture_repository_score * 0.30)
  + (hidden_question_score * 0.40)
```

See the [Challenge Brief](Participant_Package/Challenge_Brief.md#scoring) for the complete rubric.

## Hidden-Question Timeout And Slow Penalty

| Response time | Effect |
|---:|---|
| `<= 60s` | Full earned points |
| `> 60s` and `<= 300s` | 20% penalty on earned points for that question |
| `> 300s` | Timeout, zero points |

Example: if an answer earns `8/10` but returns in `83s`, the slow penalty is `1.6`, so the final
score is `6.4/10`.

## Leaderboard

The public leaderboard shows only **Rank**, **Team**, and the weighted final **Score**.
Latency, availability, tool usage, and step counts do not appear on the public leaderboard and are
not shared between teams.

After the run, each team receives a private detailed report covering only their own agent —
overall metrics plus a per-question breakdown with component YES/NO verdicts. Hidden grading
facts are stripped so nothing leaks from the question pool.

If your `GET /health` check fails at the start of the run, the team is skipped entirely and no
questions are graded. Test your endpoint from a different machine before submitting.

## Fine-Tuned Model Assessment

Fine-tuned model quality contributes 30% of the official score. Provide the model name and a
reachable OpenAI-compatible endpoint in `submission.json` when the organizers will test the model
directly. If direct model serving is not possible, agree on another assessment method with the
organizers before the deadline. The repository must still include training evidence and a
base-versus-fine-tuned comparison.

Typical setup:

```text
LiteLLM :4000
agent   :5000
vLLM FT :8001
```

Recommended architecture:

```text
brain/agent node -> Qwen3.6-35B-A3B-FP8 agent-brain + agent runtime
fine-tuning/model node -> fine-tuned Nemotron served by vLLM
```

Each team receives a two-node GIGABYTE Atom cluster with one NVIDIA GB10 per node. Hostnames and IP
addresses are assigned for the event, so use the values provided with your cluster rather than
hard-coding example machine names.

Required responsibility split:

1. Qwen3.6-35B-A3B-FP8, accessed through the supplied LiteLLM `agent-brain` alias, plans the answer and emits all
   tool calls and arguments.
2. The agent runtime validates and executes those calls against the approved datasets, then returns
   structured results to Qwen for any further reasoning.
3. When the tool loop is complete, the fine-tuned Nemotron model receives the question and verified
   tool results and synthesizes the final `answer`.

Participants fine-tune Nemotron, not Qwen3.6-35B-A3B-FP8. Qwen3.6-35B-A3B-FP8 requests tool calls; the application code performs
the actual dataset operations. See [Challenge Brief → Required Model
Roles](Participant_Package/Challenge_Brief.md#required-model-roles) for the binding model roles.

The cluster bootstrap starts with `DOMAIN_PREDICT_MODE=mock` so the pre-training scaffold can run.
After serving the adapter, set `DOMAIN_PREDICT_MODE=llm` before evaluation. Keeping `mock` enabled
means the submitted agent is not using the fine-tuned model and will lose model-quality and
architecture credit.

`submission.json` serves all three assessment pillars: the hidden-question harness uses the agent
endpoint, paths, and declared timeout; organizers use the public repository and pinned commit for
architecture review; and the declared model name and endpoint (or an approved alternative) support
fine-tuned-model assessment. The hidden-question harness does not clone or grade the repository.
Organizers can copy individual files into `p3_eval/submissions/<team>/submission.json` or pass the
portal's exported `submissions.json` manifest to the harness.

## Evaluation Flowchart

```mermaid
flowchart TD
    A["Team builds solution"] --> B["Submit GitHub repo + agent endpoint"]

    B --> C["Submission intake"]
    C --> C1["Clone public GitHub repo"]
    C1 --> C2["Pin declared commit SHA"]
    C2 --> C3["Read submission.json"]
    C3 --> C4["Validate structure, instructions,<br>and declared endpoints"]

    C4 --> D{"Submission valid?"}
    D -- "No" --> X["Fail validation / request fix"]
    D -- "Yes" --> H["Fine-tuned model quality<br>30%"]
    D -- "Yes" --> I["Architecture and repository quality<br>30%"]
    D -- "Yes" --> E["Agent health check: GET /health"]

    H --> H1["Review training data preparation,<br>configuration, checkpoints, and model summary"]
    H1 --> H2["Compare base and fine-tuned behavior"]
    H2 --> H3["Test declared model endpoint<br>or approved assessment method"]

    I --> I1["Inspect pinned GitHub commit"]
    I1 --> I2["Review Qwen planning, runtime tool execution,<br>Nemotron synthesis, retrieval, and data flow"]
    I2 --> I3["Assess code quality, reliability,<br>reproducibility, docs, logs, and security"]

    E --> F{"Agent healthy?"}
    F -- "No" --> Y["Hidden-question score: 0<br>for this run"]
    F -- "Yes" --> J["Hidden-question evaluation<br>40%"]
    J --> J1["Send hidden questions to POST /query"]
    J1 --> J2["Qwen3.6-35B-A3B-FP8 agent-brain plans<br>and emits tool calls"]
    J2 --> J3["Agent runtime executes tools<br>and returns structured results"]
    J3 --> J4["Qwen reviews results<br>and completes the reasoning loop"]
    J4 --> J5["Fine-tuned Nemotron<br>synthesizes the final answer"]
    J5 --> J6["Response JSON contains answer"]
    J6 --> J7["Grade only answer with<br>component-based partial credit"]
    J7 --> J8["Apply slow penalty after 60s<br>and timeout after 300s"]

    H3 --> K["Calculate weighted final score"]
    I3 --> K
    J8 --> K
    Y --> K

    K --> L["Public leaderboard:<br>Rank, Team, Final Score"]
    K --> M["Private organizer diagnostics"]
    M --> N["Sanitized per-team report"]
    L --> Z["Final ranking + prizes"]
```

## Participant Checklist

- Publish the contents of `TeamSubmission/` as the root of your fully public GitHub repo; private
  repositories and collaborator-only access are not supported.
- Fill in `submission.json` with final team info, IP, ports, and commit SHA.
- Keep `agent.endpoint` reachable from the organizer machine; do not use `localhost`.
- Confirm `GET /health` returns HTTP 200.
- Confirm `POST /query` accepts `{"question": "..."}`.
- Confirm `/query` returns JSON with `answer`.
- Put source code in `src/`.
- Put fine-tuning/training evidence, configuration, metrics, and a model summary in `training/`.
- Include a documented comparison between the supplied base model and the fine-tuned model.
- Make the fine-tuned model available for assessment through its declared endpoint or an organizer-approved method.
- Use the supplied Qwen3.6-35B-A3B-FP8 `agent-brain` alias for planning, tool selection, and tool-call generation.
- Execute Qwen's requested tool calls in the agent runtime and return structured results to the reasoning loop.
- Set `DOMAIN_PREDICT_MODE=llm` after the fine-tuned adapter is live; do not submit with the bootstrap `mock` mode.
- Use the fine-tuned Nemotron model to synthesize the final answer from the verified tool results.
- Confirm the service remains correct with three simultaneous `POST /query` requests.
- Document the complete Qwen, runtime, tool, retrieval, and Nemotron data flow in `README.md`.
- Put non-sensitive logs in `logs/`.
- Do not commit credentials, API keys, or hidden evaluation data.
