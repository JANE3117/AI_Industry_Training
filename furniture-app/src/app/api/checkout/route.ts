import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { placeOrder } from "@/lib/catalogue-api";

type BasketItemInput = { productId: string; quantity: number };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }

  const body = await request.json();
  const rawItems = Array.isArray(body.items) ? (body.items as unknown[]) : [];

  const items: BasketItemInput[] = rawItems
    .filter(
      (item): item is BasketItemInput =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as BasketItemInput).productId === "string" &&
        Number.isInteger((item as BasketItemInput).quantity) &&
        (item as BasketItemInput).quantity > 0
    );

  if (items.length === 0) {
    return NextResponse.json({ error: "Your basket is empty." }, { status: 400 });
  }

  // Always re-fetch products server-side rather than trusting anything the
  // browser sent — this also gets us each product's externalId, which is
  // what the catalogue API actually needs to place the order.
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.productId) } },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  if (products.length !== new Set(items.map((item) => item.productId)).size) {
    return NextResponse.json(
      { error: "One or more items in your basket are no longer available." },
      { status: 400 }
    );
  }

  const orderLines = items.map((item) => {
    const product = productsById.get(item.productId)!;
    return { externalId: product.externalId, quantity: item.quantity };
  });

  const result = await placeOrder(orderLines);

  if (!result.ok) {
    if (result.kind === "insufficient_balance") {
      return NextResponse.json(
        { error: "You don't have enough balance left for this order." },
        { status: 400 }
      );
    }
    if (result.kind === "item_unavailable") {
      return NextResponse.json(
        { error: "One or more items in your basket are no longer available." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong placing your order. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, orderId: result.orderId, total: result.totalCents });
}
