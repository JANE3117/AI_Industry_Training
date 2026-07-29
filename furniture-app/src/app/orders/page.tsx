import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatPennies } from "@/lib/money";
import { getBalance, getOrderHistory } from "@/lib/catalogue-api";
import { AppHeader } from "@/components/AppHeader";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [{ balanceCents }, orders] = await Promise.all([getBalance(), getOrderHistory()]);

  // Order history from the API only carries product id/name/price, no
  // image — look images up locally by externalId so past orders still show
  // the same product photos as the catalogue page.
  const productIds = orders.flatMap((order) => order.items.map((item) => item.productId));
  const products = await prisma.product.findMany({ where: { externalId: { in: productIds } } });
  const imageByExternalId = new Map(products.map((product) => [product.externalId, product.imageUrl]));

  const totalSpent = orders.reduce((sum, order) => sum + order.totalCents, 0);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <AppHeader userName={user.name} balance={balanceCents} active="orders" />

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
              key={order.orderId}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {order.timestamp
                    ? new Date(order.timestamp).toLocaleString("en-AU", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Date unknown"}
                </span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {formatPennies(order.totalCents)}
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {order.items.map((item, index) => {
                  const imageUrl = imageByExternalId.get(item.productId);
                  return (
                    <li key={`${order.orderId}-${index}`} className="flex items-center gap-3">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl}
                          alt={item.name ?? "Product"}
                          className="h-14 w-14 flex-shrink-0 rounded-md border border-neutral-200 object-cover dark:border-neutral-800"
                        />
                      ) : (
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100 text-[10px] text-neutral-400 dark:border-neutral-800 dark:bg-neutral-800">
                          No image
                        </div>
                      )}
                      <span className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
                        {item.name ?? item.productId} × {item.quantity}
                      </span>
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">
                        {formatPennies(item.unitPriceCents * item.quantity)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
