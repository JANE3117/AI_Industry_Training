// Client for the Day 1 hackathon training API — the furniture shop's own
// balance and ordering system. This is a single shared participant account
// (CATALOGUE_API_USER_ID), not one account per app login — see .env.
//
// Money here comes back from the API as plain dollar floats (e.g. 398.0),
// unlike the rest of this app's cents-as-integer convention. Every function
// below converts to cents at the boundary so callers never see raw dollars.

const BASE_URL = process.env.CATALOGUE_API_BASE_URL;
const API_KEY = process.env.CATALOGUE_API_KEY;
const USER_ID = process.env.CATALOGUE_API_USER_ID;

function requireConfig() {
  if (!BASE_URL) throw new Error("CATALOGUE_API_BASE_URL is not set in .env");
  if (!API_KEY) throw new Error("CATALOGUE_API_KEY is not set in .env");
  if (!USER_ID) throw new Error("CATALOGUE_API_USER_ID is not set in .env");
  return { baseUrl: BASE_URL, apiKey: API_KEY, userId: USER_ID };
}

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export async function getBalance(): Promise<{ balanceCents: number; name: string }> {
  const { baseUrl, apiKey, userId } = requireConfig();
  const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}`, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Catalogue API balance check failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { balance: number; name: string };
  return { balanceCents: toCents(data.balance), name: data.name };
}

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      totalCents: number;
      remainingBalanceCents: number;
    }
  | {
      ok: false;
      kind: "insufficient_balance" | "item_unavailable" | "other";
      message: string;
    };

// Confirmed against the live API (not just the participant guide, whose
// example was misleadingly truncated): POST /orders takes a single call
// with a top-level "items" array of {item_id, quantity} — one real order
// covering the whole basket, not one order per product.
export async function placeOrder(
  items: { externalId: string; quantity: number }[]
): Promise<PlaceOrderResult> {
  const { baseUrl, apiKey, userId } = requireConfig();

  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      items: items.map((item) => ({ item_id: item.externalId, quantity: item.quantity })),
    }),
  });

  if (response.ok) {
    const data = (await response.json()) as { order_id: string; total_price: number };
    // The success response's exact shape beyond order_id/total_price isn't
    // confirmed, so get the authoritative remaining balance with a fresh
    // call rather than guess at a "remaining_balance" field name.
    const { balanceCents } = await getBalance();
    return {
      ok: true,
      orderId: data.order_id,
      totalCents: toCents(data.total_price),
      remainingBalanceCents: balanceCents,
    };
  }

  // Confirmed by direct testing against the real API: 402 for insufficient
  // balance, 404 for an item_id it doesn't recognise. Other codes (422
  // validation errors, 5xx) fall through to a generic message, logged here
  // so the real detail isn't lost.
  const body = await response.json().catch(() => ({ detail: null }));
  const detail = typeof body.detail === "string" ? body.detail : null;

  if (response.status === 402) {
    return { ok: false, kind: "insufficient_balance", message: detail ?? "Insufficient balance." };
  }
  if (response.status === 404) {
    return { ok: false, kind: "item_unavailable", message: detail ?? "Item not found." };
  }
  console.error(
    `Catalogue API order failed: ${response.status} ${response.statusText}`,
    JSON.stringify(body)
  );
  return {
    ok: false,
    kind: "other",
    message: detail ?? `Catalogue API order failed: ${response.status} ${response.statusText}`,
  };
}

export type OrderHistoryEntry = {
  orderId: string;
  timestamp: string | null;
  totalCents: number;
  items: { productId: string; name: string | null; quantity: number; unitPriceCents: number }[];
};

export async function getOrderHistory(): Promise<OrderHistoryEntry[]> {
  const { baseUrl, apiKey, userId } = requireConfig();
  const response = await fetch(`${baseUrl}/orders/${encodeURIComponent(userId)}`, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Catalogue API order history failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as {
    order_id: string;
    timestamp: string | null;
    total_amount: number;
    items: { product_id: string; product_name: string | null; quantity: number; unit_price: number }[];
  }[];

  return data.map((order) => ({
    orderId: order.order_id,
    timestamp: order.timestamp,
    totalCents: toCents(order.total_amount),
    items: order.items.map((item) => ({
      productId: item.product_id,
      name: item.product_name,
      quantity: item.quantity,
      unitPriceCents: toCents(item.unit_price),
    })),
  }));
}
