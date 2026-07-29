"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type BasketLine = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

type BasketContextValue = {
  lines: BasketLine[];
  basketTotal: number;
  remainingAfterOrder: number;
  error: string | null;
  isSubmitting: boolean;
  lastAddedAt: number;
  addToBasket: (productId: string, quantity: number, product: { name: string; price: number }) => void;
  removeFromBasket: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  placeOrder: () => Promise<void>;
};

const BasketContext = createContext<BasketContextValue | null>(null);

export function useBasket() {
  return useContext(BasketContext);
}

export function BasketProvider({
  remainingBudget,
  children,
}: {
  remainingBudget: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAddedAt, setLastAddedAt] = useState(0);

  const basketTotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const remainingAfterOrder = remainingBudget - basketTotal;

  function addToBasket(productId: string, quantity: number, product: { name: string; price: number }) {
    setError(null);
    setLines((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (existing) {
        return current.map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity + quantity } : line
        );
      }
      return [...current, { productId, name: product.name, price: product.price, quantity }];
    });
    setLastAddedAt((current) => current + 1);
  }

  function removeFromBasket(productId: string) {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromBasket(productId);
      return;
    }
    setLines((current) =>
      current.map((line) => (line.productId === productId ? { ...line, quantity } : line))
    );
  }

  async function placeOrder() {
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    setLines([]);
    router.push("/orders");
    router.refresh();
  }

  return (
    <BasketContext.Provider
      value={{
        lines,
        basketTotal,
        remainingAfterOrder,
        error,
        isSubmitting,
        lastAddedAt,
        addToBasket,
        removeFromBasket,
        updateQuantity,
        placeOrder,
      }}
    >
      {children}
    </BasketContext.Provider>
  );
}
