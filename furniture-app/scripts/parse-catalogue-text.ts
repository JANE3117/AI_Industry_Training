// One-off: turns data/catalogue-raw.txt (text copied out of the Step 7
// hackathon PDF) into structured JSON, one record per product. This is the
// "chunk per product" input for the embeddings step — see build-embeddings.ts.
//
// Each product is 4 or 5 lines: name, category, price, an optional
// dimensions line ("W × H × D cm", missing entirely for some products), and
// the item_id (a bare numeric string). We tell the dimensions line apart
// from the item_id line by checking for "×" — nothing else in the format
// contains it.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type CatalogueEntry = {
  itemId: string;
  name: string;
  category: string;
  priceCents: number;
  width: number | null;
  height: number | null;
  depth: number | null;
};

const rawPath = join(__dirname, "..", "data", "catalogue-raw.txt");
const outPath = join(__dirname, "..", "data", "catalogue.json");

const lines = readFileSync(rawPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

function parseDimensions(line: string): { width: number | null; height: number | null; depth: number | null } {
  const parts = line.replace(/\s*cm$/, "").split("×").map((p) => p.trim());
  const toNum = (p: string) => (p === "?" ? null : Number(p));
  return { width: toNum(parts[0]), height: toNum(parts[1]), depth: toNum(parts[2]) };
}

function parsePriceCents(line: string): number {
  const dollars = Number(line.replace(/^\$/, "").replace(/,/g, ""));
  return Math.round(dollars * 100);
}

const entries: CatalogueEntry[] = [];
let i = 0;
while (i < lines.length) {
  const name = lines[i++];
  const category = lines[i++];
  const priceLine = lines[i++];
  if (!priceLine.startsWith("$")) {
    throw new Error(`Expected a price line after "${name}" / "${category}", got "${priceLine}" at line ${i}`);
  }
  const priceCents = parsePriceCents(priceLine);

  let dims = { width: null as number | null, height: null as number | null, depth: null as number | null };
  let itemIdLine = lines[i++];
  if (itemIdLine.includes("×")) {
    dims = parseDimensions(itemIdLine);
    itemIdLine = lines[i++];
  }
  if (!/^\d+$/.test(itemIdLine)) {
    throw new Error(`Expected a numeric item_id after "${name}", got "${itemIdLine}" at line ${i}`);
  }

  entries.push({
    itemId: itemIdLine,
    name,
    category,
    priceCents,
    width: dims.width,
    height: dims.height,
    depth: dims.depth,
  });
}

writeFileSync(outPath, JSON.stringify(entries, null, 2));
console.log(`Parsed ${entries.length} products -> ${outPath}`);

const categories = new Set(entries.map((e) => e.category));
console.log(`${categories.size} categories: ${[...categories].sort().join(", ")}`);
