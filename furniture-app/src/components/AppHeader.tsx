import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { ShoppingCart } from "@/components/ShoppingCart";
import { ShoppingAssistant } from "@/components/ShoppingAssistant";
import { TetrisButton } from "@/components/TetrisButton";

type AppHeaderProps = {
  userName: string;
  balance: number;
  active: "catalogue" | "orders";
};

export function AppHeader({ userName, balance, active }: AppHeaderProps) {
  const navLinkClass = (page: AppHeaderProps["active"]) =>
    page === active
      ? "rounded-md px-3 py-2 text-sm font-semibold text-pink-900 bg-pink-200/60 dark:text-pink-100 dark:bg-pink-900/40"
      : "rounded-md px-3 py-2 text-sm font-medium text-pink-700 hover:bg-pink-200/50 dark:text-pink-300 dark:hover:bg-pink-900/30";

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-pink-200 bg-gradient-to-r from-pink-100 via-fuchsia-50 to-pink-100 px-6 py-4 shadow-sm dark:border-pink-900 dark:from-pink-950 dark:via-neutral-950 dark:to-fuchsia-950">
      <Link href="/" className="text-lg font-semibold text-pink-900 dark:text-pink-100">
        🌸 Jane&apos;s Furniture online site 🐾
      </Link>

      <nav className="flex flex-wrap items-center gap-1">
        <Link href="/" className={navLinkClass("catalogue")}>
          Catalogue
        </Link>
        <Link href="/orders" className={navLinkClass("orders")}>
          My orders
        </Link>
        <TetrisButton />
        <ShoppingCart />
        <ShoppingAssistant />
        <AccountMenu userName={userName} balance={balance} />
      </nav>
    </header>
  );
}
