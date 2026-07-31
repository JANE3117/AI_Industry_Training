import json

from fastapi import FastAPI
from pydantic import BaseModel

from agent import config
from agent.brain import call_brain
from agent.synth import synthesize
from agent.tools import QUERY_DATA_TOOL_SCHEMA, query_data

SYSTEM_PROMPT = (
    "You are the planning brain for a financial-market question-answering agent. "
    "You have one tool, query_data, which computes exact facts from the RBA "
    "cash-rate, ASX price, and AFR news datasets -- never guess a number query_data "
    "could compute. Call it as many times as needed (aim for 3 or fewer), then stop "
    "calling tools once you have everything the question asks for."
)


def run_agent(question, brain_fn=call_brain, synth_fn=synthesize, max_steps=None):
    max_steps = max_steps or config.MAX_AGENT_STEPS
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]
    tool_trace = []
    steps = 0

    for _ in range(max_steps):
        steps += 1
        msg = brain_fn(messages, [QUERY_DATA_TOOL_SCHEMA])

        if not msg["tool_calls"]:
            break

        messages.append({
            "role": "assistant",
            "content": msg["content"],
            "tool_calls": [
                {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"])}}
                for tc in msg["tool_calls"]
            ],
        })

        for tc in msg["tool_calls"]:
            if tc["name"] == "query_data":
                result = query_data(**tc["arguments"])
            else:
                result = {"error": f"unknown tool: {tc['name']}"}
            tool_trace.append({"tool": tc["name"], "args": tc["arguments"], "result": json.dumps(result)})
            messages.append({"role": "tool", "tool_call_id": tc["id"], "content": json.dumps(result)})

    answer = synth_fn(question, tool_trace)
    return {"answer": answer, "steps": steps, "tool_trace": tool_trace}


app = FastAPI()


class QueryRequest(BaseModel):
    question: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/query")
def query(req: QueryRequest):
    return run_agent(req.question)
