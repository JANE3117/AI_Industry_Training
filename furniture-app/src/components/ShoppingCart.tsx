"use client";

import { useEffect, useRef, useState } from "react";
import { formatPennies } from "@/lib/money";
import { useBasket } from "@/lib/basket-context";

export function ShoppingCart() {
  const basket = useBasket();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-open whenever something is added to the basket, from anywhere in the app.
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

  // Nothing to add to a basket on pages without a BasketProvider (e.g. orders).
  if (!basket) return null;

  const itemCount = basket.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        🛒 Cart
        {itemCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-600 px-1.5 text-xs font-semibold text-white">
            {itemCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
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
                    onChange={(event) => basket.updateQuantity(line.productId, Number(event.target.value))}
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
            className="mt-2 w-full rounded-md bg-pink-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50 dark:bg-pink-500 dark:hover:bg-pink-600"
          >
            {basket.isSubmitting ? "Placing order…" : "Place order"}
          </button>
        </div>
      )}
    </div>
  );
}
