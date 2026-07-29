import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getBalance } from "@/lib/catalogue-api";
import { AppHeader } from "@/components/AppHeader";
import { ProductCard } from "@/components/ProductCard";
import { BasketProvider } from "@/lib/basket-context";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { balanceCents } = await getBalance();

  const DISPLAY_LIMIT = 24;
  const [products, totalProductCount] = await Promise.all([
    prisma.product.findMany({ orderBy: { category: "asc" }, take: DISPLAY_LIMIT }),
    prisma.product.count(),
  ]);

  return (
    <BasketProvider remainingBudget={balanceCents}>
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <AppHeader userName={user.name} balance={balanceCents} active="catalogue" />

        <div className="mb-6">
          <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">Catalogue</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Showing {products.length} of {totalProductCount} products. Pagination/search isn&apos;t
            built yet, so the list is capped here to keep the page fast.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              description={product.description}
              price={product.price}
              imageUrl={product.imageUrl}
              category={product.category}
            />
          ))}
        </div>
      </main>
    </BasketProvider>
  );
}
