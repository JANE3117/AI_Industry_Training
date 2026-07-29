import "dotenv/config";
import { MongoClient } from "mongodb";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type ApiProduct = {
  item_id: string;
  product_name: string;
  price: number;
  category: string | null;
  colours?: string[] | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
};

type MongoImageDoc = {
  item_id?: unknown;
  image_url?: unknown;
  image_mime_type?: unknown;
};

const DEFAULT_STOCK = 10;
const PAGE_SIZE = 1000;

function describe(doc: { colours?: string[] | null; width?: number | null; height?: number | null; depth?: number | null }): string {
  const colours = Array.isArray(doc.colours) && doc.colours.length > 0
    ? `Available in ${doc.colours.join(", ")}.`
    : "";
  const dims = [
    typeof doc.width === "number" ? `width ${doc.width}cm` : null,
    typeof doc.height === "number" ? `height ${doc.height}cm` : null,
    typeof doc.depth === "number" ? `depth ${doc.depth}cm` : null,
  ].filter(Boolean);
  const dimsText = dims.length > 0 ? `Dimensions: ${dims.join(", ")}.` : "";
  return [colours, dimsText].filter(Boolean).join(" ") || "No further details available.";
}

async function fetchAllProducts(baseUrl: string, apiKey: string): Promise<ApiProduct[]> {
  const products: ApiProduct[] = [];
  let skip = 0;

  for (;;) {
    const url = `${baseUrl}/catalogue/search-index?limit=${PAGE_SIZE}&skip=${skip}`;
    const response = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!response.ok) {
      throw new Error(`Catalogue API returned ${response.status} ${response.statusText} for ${url}`);
    }
    const page = (await response.json()) as ApiProduct[];
    products.push(...page);
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  return products;
}

// The search-index endpoint is deliberately lightweight and doesn't include
// images. Real images live in the shared read-only Mongo catalog (same
// MONGODB_URI already used here before), keyed by the same item_id.
//
// Despite its name, `image_url` in this collection holds raw base64 image
// bytes, not a link (confirmed by inspecting real documents — a stored
// value starting with "/9j/4AAQ..." is the base64 header for a JPEG, and
// attempting to fetch it as a URL fails). It must be wrapped as a data: URI
// before it's usable in an <img src>.
async function fetchImageMap(mongoUri: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const docs = await client.db().collection("catalog").find().toArray();
    for (const doc of docs as MongoImageDoc[]) {
      const itemId = typeof doc.item_id === "string" ? doc.item_id : null;
      const imageData = typeof doc.image_url === "string" ? doc.image_url : null;
      const mimeType = typeof doc.image_mime_type === "string" ? doc.image_mime_type : "image/jpeg";
      if (itemId && imageData) map.set(itemId, `data:${mimeType};base64,${imageData}`);
    }
  } finally {
    await client.close();
  }
  return map;
}

async function main() {
  const apiBaseUrl = process.env.CATALOGUE_API_BASE_URL;
  const apiKey = process.env.CATALOGUE_API_KEY;
  if (!apiBaseUrl) throw new Error("CATALOGUE_API_BASE_URL is not set in .env");
  if (!apiKey) throw new Error("CATALOGUE_API_KEY is not set in .env");

  const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  const existingOrderItems = await prisma.orderItem.count();
  if (existingOrderItems > 0) {
    throw new Error(
      `Refusing to replace products: ${existingOrderItems} order item(s) reference existing products. ` +
        `Resolve those orders first, or adjust this script if you want to proceed anyway.`
    );
  }

  console.log("Fetching product listing from the catalogue search-index API...");
  const apiProducts = await fetchAllProducts(apiBaseUrl, apiKey);
  console.log(`Fetched ${apiProducts.length} products from the API.`);

  let imageMap = new Map<string, string>();
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      console.log("Fetching product images from the shared catalogue database...");
      imageMap = await fetchImageMap(mongoUri);
      console.log(`Found images for ${imageMap.size} products.`);
    } catch (error) {
      console.warn(`Could not fetch images from MONGODB_URI (continuing without images): ${(error as Error).message}`);
    }
  } else {
    console.warn("MONGODB_URI is not set — importing without product images.");
  }

  const products = apiProducts
    .filter((p) => p.product_name && p.category && typeof p.price === "number")
    .map((p) => ({
      externalId: p.item_id,
      name: p.product_name,
      description: describe(p),
      price: Math.round(p.price * 100),
      imageUrl: imageMap.get(p.item_id) ?? "",
      category: p.category as string,
      stock: DEFAULT_STOCK,
    }));

  const skipped = apiProducts.length - products.length;
  if (skipped > 0) {
    console.log(`Skipped ${skipped} product(s) missing a required field (name/category/price).`);
  }

  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: products });

  console.log(`Imported ${products.length} products.`);
  console.log("Sample:");
  for (const p of products.slice(0, 5)) {
    console.log(`  ${p.name} — A$${(p.price / 100).toFixed(2)} (${p.category})`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Import failed:", error.message);
  process.exitCode = 1;
});
