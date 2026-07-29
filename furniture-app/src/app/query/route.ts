import { NextResponse } from "next/server";
import { runAgentTurn } from "@/lib/agent-loop";

// Deliberately at the app root (not /api/query) and deliberately public —
// this is the hackathon portal's grading contract, separate from the buyer
// app's own login. It shares the same catalogue-API account as everything
// else (see .env), and inherits the same money-safety property as the chat
// widget: place_order only ever proposes, it never spends for real, so
// there's nothing an anonymous caller here can actually purchase.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json(
      { error: 'Expected a JSON body like {"question": "..."}.' },
      { status: 400 }
    );
  }

  try {
    const { messages, timedOut } = await runAgentTurn([{ role: "user", content: question }]);
    const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant" && m.content);
    const answer = typeof lastAssistantMessage?.content === "string"
      ? lastAssistantMessage.content
      : "I couldn't come up with an answer to that.";

    return NextResponse.json({
      answer,
      ...(timedOut ? { warning: "Took more steps than expected to answer." } : {}),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
