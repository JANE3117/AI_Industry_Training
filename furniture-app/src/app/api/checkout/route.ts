import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { formatPennies } from "@/lib/money";

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

  const orderItems = items.map((item) => {
    const product = productsById.get(item.productId)!;
    return {
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.price,
    };
  });
  const basketTotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const pastOrders = await prisma.order.findMany({ where: { userId: user.id } });
  const alreadySpent = pastOrders.reduce((sum, order) => sum + order.total, 0);
  const remaining = user.budget - alreadySpent;

  if (basketTotal > remaining) {
    return NextResponse.json(
      {
        error: `This order costs ${formatPennies(basketTotal)} but you only have ${formatPennies(remaining)} left in your budget.`,
      },
      { status: 400 }
    );
  }

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: { userId: user.id, total: basketTotal },
    });
    await tx.orderItem.createMany({
      data: orderItems.map((item) => ({ ...item, orderId: createdOrder.id })),
    });
    return createdOrder;
  });

  return NextResponse.json({ ok: true, orderId: order.id, total: basketTotal });
}
