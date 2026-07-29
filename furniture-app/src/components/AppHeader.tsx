import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { ShoppingCart } from "@/components/ShoppingCart";
import { ShoppingAssistant } from "@/components/ShoppingAssistant";

type AppHeaderProps = {
  userName: string;
  balance: number;
  active: "catalogue" | "orders";
};

export function AppHeader({ userName, balance, active }: AppHeaderProps) {
  const navLinkClass = (page: AppHeaderProps["active"]) =>
    page === active
      ? "rounded-md px-3 py-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100"
      : "rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800";

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800">
      <Link href="/" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        🎀 Jane&apos;s Furniture online site
      </Link>

      <nav className="flex flex-wrap items-center gap-1">
        <Link href="/" className={navLinkClass("catalogue")}>
          Catalogue
        </Link>
        <Link href="/orders" className={navLinkClass("orders")}>
          My orders
        </Link>
        <ShoppingCart />
        <ShoppingAssistant />
        <AccountMenu userName={userName} balance={balance} />
      </nav>
    </header>
  );
}
