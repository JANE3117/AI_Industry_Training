"""Final-answer synthesis via the fine-tuned Nemotron model (DOMAIN_FT_MODEL).

DOMAIN_PREDICT_MODE=mock (the cluster bootstrap default) skips the model
call entirely and stitches the tool trace into a plain sentence -- useful
for testing the agent loop's plumbing before the fine-tuned adapter exists,
but this must never be what ships: the mock path earns zero fine-tuned
model score. See Setup_Instructions.md -> DOMAIN_PREDICT_MODE.
"""

import json

from openai import OpenAI

from agent import config

SYNTH_SYSTEM_PROMPT = (
    "You are a financial-domain answer writer. You will be given a question and "
    "a list of verified tool results (exact structured data, already correct). "
    "Write a direct, concise answer that states every number, date, and label "
    "the question asks for. Do not add unsupported claims, do not hedge with "
    "words like 'approximately', and do not invent values not present in the "
    "tool results. If the tool results are insufficient, say so plainly."
)


def synthesize(question, tool_trace):
    if config.DOMAIN_PREDICT_MODE == "mock":
        return _mock_synthesize(question, tool_trace)

    client = OpenAI(base_url=config.LITELLM_BASE_URL, api_key=config.LITELLM_KEY)
    evidence = "\n".join(
        f"- tool={t['tool']} args={t['args']} result={t['result']}" for t in tool_trace
    ) or "(no tool results were gathered)"
    resp = client.chat.completions.create(
        model=config.DOMAIN_FT_MODEL,
        messages=[
            {"role": "system", "content": SYNTH_SYSTEM_PROMPT},
            {"role": "user", "content": f"Question: {question}\n\nVerified tool results:\n{evidence}"},
        ],
    )
    return resp.choices[0].message.content


def _mock_synthesize(question, tool_trace):
    if not tool_trace:
        return "(mock synthesis -- DOMAIN_PREDICT_MODE=mock, no tool evidence gathered)"
    last = tool_trace[-1]
    return f"(mock synthesis -- DOMAIN_PREDICT_MODE=mock) {last['tool']} returned: {json.dumps(last['result'])}"
