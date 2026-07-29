import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { runAgentTurn } from "@/lib/agent-loop";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }

  const body = await request.json();
  const incoming: ChatCompletionMessageParam[] = Array.isArray(body.messages) ? body.messages : [];

  const { messages, pendingOrder, timedOut } = await runAgentTurn(incoming);

  return NextResponse.json({
    messages,
    pendingOrder,
    ...(timedOut ? { error: "That took more steps than expected — try rephrasing your request." } : {}),
  });
}
