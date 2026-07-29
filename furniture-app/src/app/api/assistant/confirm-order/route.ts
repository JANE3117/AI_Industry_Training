import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { placeOrder, friendlyOrderError } from "@/lib/catalogue-api";

// The only place that actually spends money on the assistant's behalf —
// deliberately separate from /api/assistant so a real order only ever
// happens from an explicit human click, never from the model on its own.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }

  const body = await request.json();
  const items = Array.isArray(body.items) ? (body.items as { itemId?: unknown; quantity?: unknown }[]) : [];

  const orderLines = items
    .filter((item) => typeof item.itemId === "string" && Number.isInteger(item.quantity) && (item.quantity as number) > 0)
    .map((item) => ({ externalId: item.itemId as string, quantity: item.quantity as number }));

  if (orderLines.length === 0) {
    return NextResponse.json({ error: "Nothing to order." }, { status: 400 });
  }

  const result = await placeOrder(orderLines);

  if (!result.ok) {
    const { status, message } = friendlyOrderError(result);
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, orderId: result.orderId, total: result.totalCents });
}
