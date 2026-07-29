// Step 7 (RAG): semantic search over the catalogue, for open-ended questions
// the exact-match search_catalogue tool can't answer (e.g. "something like a
// cheap Scandinavian side table"). Embeddings are pre-built by
// scripts/build-embeddings.ts and just loaded here — nothing gets embedded
// at request time except the incoming question itself.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const EMBEDDINGS_PATH = join(process.cwd(), "data", "catalogue-embeddings.json");
const CATALOGUE_PATH = join(process.cwd(), "data", "catalogue.json");

type CatalogueEntry = {
  itemId: string;
  name: string;
  category: string;
  priceCents: number;
  width: number | null;
  height: number | null;
  depth: number | null;
};

type EmbeddedEntry = { itemId: string; chunk: string; embedding: number[] };
type EmbeddingsFile = { model: string; entries: EmbeddedEntry[] };

// Loaded once per server process — 762 vectors is small enough to keep
// entirely in memory rather than reach for a vector database.
let cache: { model: string; entries: EmbeddedEntry[]; byItemId: Map<string, CatalogueEntry> } | null = null;

function loadIndex() {
  if (cache) return cache;
  const embeddings: EmbeddingsFile = JSON.parse(readFileSync(EMBEDDINGS_PATH, "utf8"));
  const catalogue: CatalogueEntry[] = JSON.parse(readFileSync(CATALOGUE_PATH, "utf8"));
  const byItemId = new Map(catalogue.map((p) => [p.itemId, p]));
  cache = { model: embeddings.model, entries: embeddings.entries, byItemId };
  return cache;
}

async function embedQuery(question: string, model: string): Promise<number[]> {
  if (!VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY is not set in .env");
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: [question], model, input_type: "query" }),
  });
  if (!response.ok) {
    throw new Error(`Voyage embeddings request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type SemanticMatch = {
  itemId: string;
  name: string;
  category: string;
  priceCents: number;
  width: number | null;
  height: number | null;
  depth: number | null;
  score: number;
};

export async function semanticSearchCatalogue(question: string, topK = 8): Promise<SemanticMatch[]> {
  const index = loadIndex();
  const queryVector = await embedQuery(question, index.model);

  const scored = index.entries.map((e) => ({ itemId: e.itemId, score: cosineSimilarity(queryVector, e.embedding) }));
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(({ itemId, score }) => {
    const product = index.byItemId.get(itemId)!;
    return { ...product, score };
  });
}
