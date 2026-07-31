"""Locally compute the llm_correctness / llm_conciseness judge scores and
push them to LangSmith as feedback.

Why this exists: the dataset-bound ``chinook-offline-llm-correctness`` and
``chinook-offline-llm-conciseness`` evaluators run *on LangSmith's servers*,
which need OPENAI_API_KEY stored in the workspace's Secrets to invoke the
judge model -- adding a shared key to a shared hackathon workspace isn't a
call to make unilaterally. This script does the same judging locally, using
the Azure credentials already configured in this environment, and posts the
resulting scores back to LangSmith via the API. No key ever leaves this
machine.

Run from the project root:

    .venv/bin/python evals/run-local-judge.py --experiment jane-hackathon-05
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv
from langsmith import Client
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

load_dotenv(PROJECT_ROOT / ".env")

from agent import model  # noqa: E402  (loaded after .env so config is correct)


class CorrectnessFeedback(BaseModel):
    llm_correctness: bool = Field(
        description=(
            "True only when the assistant response satisfies the reference "
            "rubric accurately, helpfully, and safely."
        )
    )
    reasoning: str = Field(description="A concise explanation of the verdict.")


class ConcisenessFeedback(BaseModel):
    llm_conciseness: bool = Field(
        description=(
            "True when the response is direct and appropriately brief while "
            "still containing the information needed to answer the user."
        )
    )
    reasoning: str = Field(description="A concise explanation of the verdict.")


CORRECTNESS_SYSTEM = (
    "You are grading a customer-support assistant. Determine whether the "
    "response satisfies the reference rubric. Prioritize factual accuracy, "
    "fulfillment of the request, authorization boundaries, and absence of "
    "invented information."
)
CONCISENESS_SYSTEM = (
    "Grade whether a customer-support response is concise. It must answer "
    "directly without unnecessary repetition or tangents, but must not omit "
    "information necessary to help the user."
)


async def _judge(run, example) -> None:
    question = run.inputs.get("question", "")
    answer = (run.outputs or {}).get("answer", "")
    reference = (example.outputs or {}).get("reference_answer", "")

    correctness_model = model.with_structured_output(CorrectnessFeedback)
    correctness = await correctness_model.ainvoke(
        [
            {"role": "system", "content": CORRECTNESS_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"USER QUESTION:\n{question}\n\nASSISTANT RESPONSE:\n{answer}"
                    f"\n\nREFERENCE RUBRIC:\n{reference}"
                ),
            },
        ]
    )

    conciseness_model = model.with_structured_output(ConcisenessFeedback)
    conciseness = await conciseness_model.ainvoke(
        [
            {"role": "system", "content": CONCISENESS_SYSTEM},
            {"role": "user", "content": f"ASSISTANT RESPONSE:\n{answer}"},
        ]
    )
    return correctness, conciseness


async def amain(experiment_name: str) -> int:
    client = Client()
    runs = list(client.list_runs(project_name=experiment_name, is_root=True))
    if not runs:
        print(f"No runs found under experiment {experiment_name!r}.")
        return 1

    examples = {
        ex.id: ex
        for ex in client.list_examples(
            example_ids=[r.reference_example_id for r in runs if r.reference_example_id]
        )
    }

    for run in runs:
        example = examples.get(run.reference_example_id)
        if example is None:
            print(f"Run {run.id}: no reference example, skipping.")
            continue

        correctness, conciseness = await _judge(run, example)

        client.create_feedback(
            run_id=run.id,
            key="llm_correctness",
            score=1.0 if correctness.llm_correctness else 0.0,
            comment=correctness.reasoning,
        )
        client.create_feedback(
            run_id=run.id,
            key="llm_conciseness",
            score=1.0 if conciseness.llm_conciseness else 0.0,
            comment=conciseness.reasoning,
        )
        print(
            f"Run {run.id}: correctness={correctness.llm_correctness} "
            f"conciseness={conciseness.llm_conciseness}"
        )

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--experiment", required=True, help="LangSmith experiment/session name")
    args = parser.parse_args()
    return asyncio.run(amain(args.experiment))


if __name__ == "__main__":
    sys.exit(main())
