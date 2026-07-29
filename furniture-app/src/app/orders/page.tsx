import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatPennies } from "@/lib/money";
import { AppHeader } from "@/components/AppHeader";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } } },
  });

  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
  const remaining = user.budget - totalSpent;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <AppHeader userName={user.name} remaining={remaining} budget={user.budget} active="orders" />

      <div className="mb-6 flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">My orders</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {orders.length} order{orders.length === 1 ? "" : "s"} placed
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Total spent</p>
          <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {formatPennies(totalSpent)}
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          You haven&apos;t placed any orders yet. Head to the{" "}
          <Link href="/" className="underline">
            catalogue
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {order.createdAt.toLocaleString("en-AU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {formatPennies(order.total)}
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="h-14 w-14 flex-shrink-0 rounded-md border border-neutral-200 object-cover dark:border-neutral-800"
                    />
                    <span className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
                      {item.product.name} × {item.quantity}
                    </span>
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {formatPennies(item.unitPrice * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
