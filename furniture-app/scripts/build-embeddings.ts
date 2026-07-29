// Step 7 (RAG): embeds every product in data/catalogue.json with Voyage AI
// and saves the vectors to data/catalogue-embeddings.json. Run this again
// whenever catalogue.json changes — it always re-embeds everything, since
// 762 products is small enough that there's no need for incremental
// updates (see lib/rag-search.ts for how these vectors get used).
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const MODEL = "voyage-3.5";
const BATCH_SIZE = 100; // Voyage accepts batched input; keeps request count low for 762 products.

type CatalogueEntry = {
  itemId: string;
  name: string;
  category: string;
  priceCents: number;
  width: number | null;
  height: number | null;
  depth: number | null;
};

function chunkText(p: CatalogueEntry): string {
  const price = `$${(p.priceCents / 100).toFixed(2)} AUD`;
  const dims = [p.width, p.height, p.depth].some((d) => d !== null)
    ? `, dimensions ${p.width ?? "?"} × ${p.height ?? "?"} × ${p.depth ?? "?"} cm`
    : "";
  return `${p.name} — category: ${p.category}, price: ${price}${dims}`;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: "document" }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage embeddings request failed: ${response.status} ${response.statusText} — ${body}`);
  }
  const data = (await response.json()) as { data: { embedding: number[]; index: number }[] };
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function main() {
  if (!VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is not set in .env");
  }

  const catalogPath = join(__dirname, "..", "data", "catalogue.json");
  const outPath = join(__dirname, "..", "data", "catalogue-embeddings.json");
  const products: CatalogueEntry[] = JSON.parse(readFileSync(catalogPath, "utf8"));

  const results: { itemId: string; chunk: string; embedding: number[] }[] = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const chunks = batch.map(chunkText);
    const embeddings = await embedBatch(chunks);
    batch.forEach((p, j) => results.push({ itemId: p.itemId, chunk: chunks[j], embedding: embeddings[j] }));
    console.log(`Embedded ${Math.min(i + BATCH_SIZE, products.length)}/${products.length}`);
  }

  writeFileSync(outPath, JSON.stringify({ model: MODEL, entries: results }));
  console.log(`Saved ${results.length} embeddings -> ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
