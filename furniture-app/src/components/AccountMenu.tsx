"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatPennies } from "@/lib/money";
import { useBasket } from "@/lib/basket-context";
import { LogoutButton } from "@/components/LogoutButton";

type AccountMenuProps = {
  userName: string;
  balance: number;
  active: "catalogue" | "orders";
};

export function AccountMenu({ userName, balance, active }: AccountMenuProps) {
  const basket = useBasket();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-open the corner menu whenever something is added to the basket.
  useEffect(() => {
    if (basket && basket.lastAddedAt > 0) {
      setIsOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basket?.lastAddedAt]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const itemCount = basket?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const linkClass = (page: AccountMenuProps["active"]) =>
    page === active
      ? "font-semibold text-neutral-900 dark:text-neutral-100"
      : "text-neutral-600 hover:underline dark:text-neutral-400";

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full border border-neutral-300 py-1 pl-1 pr-3 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
          {userName.charAt(0).toUpperCase()}
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{userName}</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatPennies(balance)} left
          </span>
        </span>
        {itemCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
            {itemCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">{userName}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Balance: <span className="font-medium">{formatPennies(balance)}</span>
            </p>
          </div>

          {basket && (
            <div className="mb-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Your basket
              </h3>
              {basket.lines.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No items yet — add something from the catalogue.
                </p>
              ) : (
                <ul className="mb-2 flex flex-col gap-2">
                  {basket.lines.map((line) => (
                    <li key={line.productId} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate text-neutral-700 dark:text-neutral-300">
                        {line.name}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={line.quantity}
                        onChange={(event) =>
                          basket.updateQuantity(line.productId, Number(event.target.value))
                        }
                        aria-label={`Quantity for ${line.name}`}
                        className="w-12 rounded border border-neutral-300 px-1 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                      />
                      <span className="w-16 text-right text-neutral-700 dark:text-neutral-300">
                        {formatPennies(line.price * line.quantity)}
                      </span>
                      <button
                        onClick={() => basket.removeFromBasket(line.productId)}
                        aria-label={`Remove ${line.name}`}
                        className="text-neutral-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">Basket total</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {formatPennies(basket.basketTotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">Remaining after order</span>
                <span
                  className={
                    basket.remainingAfterOrder < 0
                      ? "font-medium text-red-600"
                      : "text-neutral-500 dark:text-neutral-400"
                  }
                >
                  {formatPennies(basket.remainingAfterOrder)}
                </span>
              </div>
              {basket.error && (
                <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {basket.error}
                </p>
              )}
              <button
                onClick={basket.placeOrder}
                disabled={basket.lines.length === 0 || basket.isSubmitting}
                className="mt-2 w-full rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {basket.isSubmitting ? "Placing order…" : "Place order"}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2 text-sm">
            <Link href="/" onClick={() => setIsOpen(false)} className={linkClass("catalogue")}>
              Catalogue
            </Link>
            <Link href="/orders" onClick={() => setIsOpen(false)} className={linkClass("orders")}>
              My orders
            </Link>
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}
