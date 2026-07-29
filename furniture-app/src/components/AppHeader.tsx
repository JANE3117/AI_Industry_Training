import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";

type AppHeaderProps = {
  userName: string;
  balance: number;
  active: "catalogue" | "orders";
};

export function AppHeader({ userName, balance, active }: AppHeaderProps) {
  return (
    <header className="mb-8 flex items-center justify-between gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800">
      <Link href="/" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Jane&apos;s Furniture Buyer Site
      </Link>
      <AccountMenu userName={userName} balance={balance} active={active} />
    </header>
  );
}
