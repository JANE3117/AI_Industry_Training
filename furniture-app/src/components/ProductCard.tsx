"use client";

import { useState } from "react";
import { formatPennies } from "@/lib/money";
import { useBasket } from "@/lib/basket-context";

type ProductCardProps = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
};

export function ProductCard({ id, name, description, price, imageUrl, category }: ProductCardProps) {
  const basket = useBasket();
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={name} className="aspect-[4/3] w-full object-cover" />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {category}
        </span>
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{name}</h3>
        <p className="flex-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
        <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {formatPennies(price)}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(event) => {
              const next = Number(event.target.value);
              setQuantity(Number.isInteger(next) && next > 0 ? Math.min(next, 20) : 1);
            }}
            aria-label={`Quantity for ${name}`}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            onClick={() => basket?.addToBasket(id, quantity, { name, price })}
            className="flex-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Add to basket
          </button>
        </div>
      </div>
    </div>
  );
}
