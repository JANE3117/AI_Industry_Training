"use client";

import { useEffect, useState } from "react";
import { TetrisGame } from "@/components/TetrisGame";

// Opens the game as a popup over whatever page you're on (home/catalogue,
// in practice) instead of navigating to a separate route — same
// open/close-on-Escape/close-on-outside-click pattern as AccountMenu and
// ShoppingCart, just as a full overlay instead of a dropdown.
export function TetrisButton() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md px-3 py-2 text-sm font-medium text-pink-700 hover:bg-pink-200/60 dark:text-pink-300 dark:hover:bg-pink-900/40"
      >
        🐱 Tetris
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="relative max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close Tetris"
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-pink-500 text-lg leading-none text-white shadow hover:bg-pink-600"
            >
              ×
            </button>
            <TetrisGame />
          </div>
        </div>
      )}
    </>
  );
}
