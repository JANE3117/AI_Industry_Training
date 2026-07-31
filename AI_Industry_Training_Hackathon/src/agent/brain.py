"""Calls the supplied Qwen3.6-35B-A3B-FP8 reasoning model via the `agent-brain`
LiteLLM alias. Qwen plans and selects tools; it is never fine-tuned.

call_brain() takes a standard OpenAI-style message list and returns a plain
dict: {"tool_calls": [{"id", "name", "arguments"}] | None, "content": str | None}.
This shape (rather than passing the raw SDK response around) is what lets
run_agent() in main.py be tested with a fake brain, with no network and no
change to the loop code once the real cluster is available.
"""

import json

from openai import OpenAI

from agent import config


def call_brain(messages, tools):
    client = OpenAI(base_url=config.LITELLM_BASE_URL, api_key=config.LITELLM_KEY)
    resp = client.chat.completions.create(
        model=config.BRAIN_MODEL,
        messages=messages,
        tools=tools,
        tool_choice="auto",
    )
    msg = resp.choices[0].message
    if msg.tool_calls:
        return {
            "content": msg.content,
            "tool_calls": [
                {"id": tc.id, "name": tc.function.name, "arguments": json.loads(tc.function.arguments)}
                for tc in msg.tool_calls
            ],
        }
    return {"content": msg.content, "tool_calls": None}
