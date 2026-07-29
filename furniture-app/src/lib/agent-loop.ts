import { getAzureOpenAIClient, getAzureDeployment } from "@/lib/azure-openai";
import { TOOLS, executeTool, type PendingOrder } from "@/lib/agent-tools";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const SYSTEM_PROMPT = `You are a shopping assistant for Jane's Furniture online site.

You can search the catalogue by exact category, search it by meaning for open-ended requests, look up one product's full detail, check the current user's balance, and propose an order.

search_catalogue only matches an exact category name — it has no idea what "cheap", "cosy", or a colour means. For requests like that, use semantic_search_catalogue instead, which finds products by meaning rather than an exact field match.

Placing an order never happens just because you or the user said so in chat — proposing an order only shows the user what it would cost, and it's only actually placed if they separately confirm it in the app. Never tell the user an order has gone through unless a tool result explicitly says so.

If a tool call comes back with an error (unknown item, insufficient balance, etc.), explain that back to the user in plain, friendly language and suggest what to try instead — never show them a raw error.`;

export type AgentTurnResult = {
  messages: ChatCompletionMessageParam[];
  pendingOrder?: PendingOrder;
  timedOut?: boolean;
};

// Shared by the in-app chat widget (/api/assistant) and the hackathon
// portal's public query contract (/query) — same tools, same system
// prompt, same money-safety behaviour (place_order only ever proposes).
export async function runAgentTurn(conversation: ChatCompletionMessageParam[]): Promise<AgentTurnResult> {
  const client = getAzureOpenAIClient();
  const deployment = getAzureDeployment();

  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: SYSTEM_PROMPT }, ...conversation];
  let pendingOrder: PendingOrder | undefined;

  // A handful of rounds is plenty for a four-tool menu this small.
  for (let round = 0; round < 5; round++) {
    const completion = await client.chat.completions.create({
      model: deployment,
      messages,
      tools: TOOLS,
    });

    const message = completion.choices[0].message;
    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { messages: messages.slice(1), pendingOrder };
    }

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function") continue;

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        // Bad JSON from the model — fall through with empty args; the
        // tool itself will report back what's missing.
      }

      let result;
      try {
        result = await executeTool(toolCall.function.name, args);
      } catch (error) {
        result = { content: JSON.stringify({ error: (error as Error).message }) };
      }

      if (result.pendingOrder) {
        pendingOrder = result.pendingOrder;
      }

      messages.push({ role: "tool", tool_call_id: toolCall.id, content: result.content });
    }
  }

  return { messages: messages.slice(1), pendingOrder, timedOut: true };
}
