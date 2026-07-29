"use client";

import { useEffect, useState } from "react";
import { formatPennies } from "@/lib/money";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
};

type PendingOrder = {
  items: { itemId: string; name: string; quantity: number; unitPriceCents: number }[];
  totalCents: number;
};

type OrderOutcome = { type: "success" | "error"; message: string };

export function ShoppingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [orderOutcome, setOrderOutcome] = useState<OrderOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isSending) return;

    const nextHistory: ChatMessage[] = [...history, { role: "user", content: text }];
    setHistory(nextHistory);
    setInput("");
    setIsSending(true);
    setError(null);
    setOrderOutcome(null);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The assistant couldn't respond. Please try again.");
        return;
      }
      setHistory(data.messages ?? nextHistory);
      setPendingOrder(data.pendingOrder ?? null);
      if (data.error) setError(data.error);
    } catch {
      setError("Couldn't reach the assistant. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  async function confirmOrder() {
    if (!pendingOrder) return;
    setIsConfirming(true);
    try {
      const response = await fetch("/api/assistant/confirm-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: pendingOrder.items }),
      });
      const data = await response.json();
      if (!response.ok) {
        setOrderOutcome({ type: "error", message: data.error ?? "Something went wrong placing your order." });
        setHistory((current) => [...current, { role: "user", content: "(That order failed — it was not placed.)" }]);
      } else {
        setOrderOutcome({ type: "success", message: `Order placed — ${formatPennies(data.total)} total.` });
        setHistory((current) => [...current, { role: "user", content: "(I confirmed and that order was placed successfully.)" }]);
      }
    } catch {
      setOrderOutcome({ type: "error", message: "Couldn't reach the server. Please try again." });
    } finally {
      setIsConfirming(false);
      setPendingOrder(null);
    }
  }

  function cancelOrder() {
    setHistory((current) => [...current, { role: "user", content: "(I decided not to place that order.)" }]);
    setPendingOrder(null);
  }

  const visibleMessages = history.filter(
    (message) => (message.role === "user" || message.role === "assistant") && message.content
  );

  return (
    <>
      {/* Nav bar entry and the floating corner button are two doors into
          the same chat state — whichever one is more convenient to reach. */}
      <button
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        💬 Assistant
      </button>

      <div className="fixed bottom-4 right-4 z-30">
        {isOpen && (
          <div className="mb-3 flex h-[28rem] w-80 flex-col rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 p-3 dark:border-neutral-800">
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Shopping assistant
            </span>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {visibleMessages.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Ask me things like &ldquo;find me a chair under $500&rdquo; or &ldquo;what&apos;s my balance?&rdquo;
              </p>
            )}
            <div className="flex flex-col gap-2">
              {visibleMessages.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.role === "user"
                      ? "self-end rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
                      : "self-start rounded-lg bg-neutral-100 px-3 py-1.5 text-sm text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                  }
                >
                  {message.content}
                </div>
              ))}
            </div>

            {pendingOrder && (
              <div className="mt-3 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
                <p className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Confirm this order?
                </p>
                <ul className="mb-2 flex flex-col gap-1">
                  {pendingOrder.items.map((item) => (
                    <li key={item.itemId} className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
                      <span>{item.name} × {item.quantity}</span>
                      <span>{formatPennies(item.unitPriceCents * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mb-3 flex justify-between text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  <span>Total</span>
                  <span>{formatPennies(pendingOrder.totalCents)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={confirmOrder}
                    disabled={isConfirming}
                    className="flex-1 rounded-md bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700 disabled:opacity-50 dark:bg-pink-500 dark:hover:bg-pink-600"
                  >
                    {isConfirming ? "Placing…" : "Confirm & buy"}
                  </button>
                  <button
                    onClick={cancelOrder}
                    disabled={isConfirming}
                    className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {orderOutcome && (
              <p
                role="alert"
                className={
                  orderOutcome.type === "success"
                    ? "mt-3 text-xs text-green-700 dark:text-green-400"
                    : "mt-3 text-xs text-red-600 dark:text-red-400"
                }
              >
                {orderOutcome.message}
              </p>
            )}

            {error && (
              <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
            className="flex gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800"
          >
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about furniture…"
              disabled={isSending}
              className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="rounded-md bg-pink-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50 dark:bg-pink-500 dark:hover:bg-pink-600"
            >
              {isSending ? "…" : "Send"}
            </button>
          </form>
        </div>
        )}

        <button
          onClick={() => setIsOpen((current) => !current)}
          aria-label={isOpen ? "Close assistant" : "Open assistant"}
          className="rounded-full bg-pink-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-pink-700 dark:bg-pink-500 dark:hover:bg-pink-600"
        >
          {isOpen ? "Close" : "💬"}
        </button>
      </div>
    </>
  );
}
