import { prisma } from "@/lib/db";
import { searchCatalogue, getProductDetail, getBalance } from "@/lib/catalogue-api";
import { semanticSearchCatalogue } from "@/lib/rag-search";

// The things the furniture shop's API can actually do, wired up as tools
// for the shopping-assistant model. See catalogue-api.ts for what each
// endpoint really returns and doesn't. semantic_search_catalogue (Step 7)
// is the odd one out — it doesn't call the shop's API at all, it searches
// pre-built embeddings over the same 762-product catalogue (see
// lib/rag-search.ts) for questions search_catalogue's exact category match
// can't answer.
export const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_catalogue",
      description:
        "Search the furniture catalogue, optionally filtered to one exact category (e.g. 'Chairs', 'Tables', 'Sofas', 'Lighting', 'Storage'). Returns matching products with their item_id, name, price (AUD), category, and colours — no images, no dimensions. Category matching is an exact, case-insensitive string match only: it does NOT understand price ranges, colours, or vibes like 'cheap' or 'cosy'. If the user describes something like that, call this with just a category (or no category to browse everything) and apply that judgement yourself over the results you get back.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Exact category name to filter by, e.g. 'Chairs'. Omit to search across all categories.",
          },
          limit: {
            type: "integer",
            description: "Max results to return. Default 20, capped at 50.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_product_detail",
      description:
        "Get full detail — including dimensions — for exactly one product you already know the item_id of, e.g. one returned by search_catalogue. Don't use this to browse or compare several products; it's meant for one specific item at a time. It never returns an image to you.",
      parameters: {
        type: "object",
        properties: {
          item_id: {
            type: "string",
            description: "The product's item_id, e.g. from a previous search_catalogue result.",
          },
        },
        required: ["item_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "semantic_search_catalogue",
      description:
        "Search the furniture catalogue by meaning rather than exact fields — use this for open-ended requests search_catalogue can't handle, like 'something like a Scandinavian side table but cheaper', 'what's your most affordable option in blue', or vague vibes ('cosy', 'minimalist'). Returns the closest-matching products with their item_id, name, category, price (AUD), and dimensions, ranked by relevance — not necessarily an exact match, so use judgement about whether a result actually fits what the user asked for. Prefer search_catalogue instead when the user gives an exact category name.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The user's request, in their own words.",
          },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_balance",
      description:
        "Check how much budget the current user has left to spend. This is always about whoever is currently chatting — there is no way to check anyone else's balance. Takes no parameters.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "place_order",
      description:
        "Propose an order for specific item(s) for the current user. This does NOT spend any money immediately — it prepares the order and the app will show the user exactly what it would cost, waiting for them to confirm or cancel it themselves before anything is actually purchased. Only call this once you know exactly which item(s) and quantities the user wants; don't guess a substitute if they haven't confirmed one.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "The item(s) to order.",
            items: {
              type: "object",
              properties: {
                item_id: { type: "string" },
                quantity: { type: "integer", minimum: 1 },
              },
              required: ["item_id", "quantity"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
];

export type PendingOrder = {
  items: { itemId: string; name: string; quantity: number; unitPriceCents: number }[];
  totalCents: number;
};

export type ToolResult = { content: string; pendingOrder?: PendingOrder };

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "search_catalogue": {
      const category = typeof args.category === "string" ? args.category : undefined;
      const limit = typeof args.limit === "number" ? args.limit : undefined;
      const results = await searchCatalogue({ category, limit });
      return { content: JSON.stringify(results) };
    }

    case "get_product_detail": {
      const itemId = typeof args.item_id === "string" ? args.item_id : "";
      const detail = itemId ? await getProductDetail(itemId) : null;
      if (!detail) {
        return { content: JSON.stringify({ error: `No product with item_id '${itemId}'.` }) };
      }
      return { content: JSON.stringify(detail) };
    }

    case "semantic_search_catalogue": {
      const question = typeof args.question === "string" ? args.question : "";
      if (!question) {
        return { content: JSON.stringify({ error: "No question given." }) };
      }
      const matches = await semanticSearchCatalogue(question);
      return { content: JSON.stringify(matches) };
    }

    case "check_balance": {
      const { balanceCents } = await getBalance();
      return { content: JSON.stringify({ balanceCents }) };
    }

    case "place_order": {
      const requested = Array.isArray(args.items)
        ? (args.items as { item_id?: unknown; quantity?: unknown }[])
            .filter((i) => typeof i.item_id === "string" && Number.isInteger(i.quantity) && (i.quantity as number) > 0)
            .map((i) => ({ itemId: i.item_id as string, quantity: i.quantity as number }))
        : [];

      if (requested.length === 0) {
        return { content: JSON.stringify({ error: "No valid items given — need at least one item_id and quantity." }) };
      }

      // Real prices/names looked up locally, same as checkout — never trust
      // whatever the model claims a price is.
      const products = await prisma.product.findMany({
        where: { externalId: { in: requested.map((i) => i.itemId) } },
      });
      const byExternalId = new Map(products.map((p) => [p.externalId, p]));

      const missing = requested.filter((i) => !byExternalId.has(i.itemId));
      if (missing.length > 0) {
        return {
          content: JSON.stringify({
            error: `Unknown item_id(s): ${missing.map((i) => i.itemId).join(", ")}. Double-check with search_catalogue first.`,
          }),
        };
      }

      const items = requested.map((i) => {
        const product = byExternalId.get(i.itemId)!;
        return { itemId: i.itemId, name: product.name, quantity: i.quantity, unitPriceCents: product.price };
      });
      const totalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

      return {
        content: JSON.stringify({
          status: "awaiting_user_confirmation",
          items,
          totalCents,
          note: "Tell the user exactly what this order contains and its total (in AUD). It will only actually be placed if they confirm in the app — don't tell them it's been bought yet.",
        }),
        pendingOrder: { items, totalCents },
      };
    }

    default:
      return { content: JSON.stringify({ error: `Unknown tool '${name}'.` }) };
  }
}
