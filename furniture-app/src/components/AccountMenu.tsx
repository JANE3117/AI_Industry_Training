"use client";

import { useEffect, useRef, useState } from "react";
import { formatPennies } from "@/lib/money";
import { LogoutButton } from "@/components/LogoutButton";

type AccountMenuProps = {
  userName: string;
  balance: number;
};

export function AccountMenu({ userName, balance }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">{userName}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Balance: <span className="font-medium">{formatPennies(balance)}</span>
            </p>
          </div>
          <LogoutButton />
        </div>
      )}
    </div>
  );
}
