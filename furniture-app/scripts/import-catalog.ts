import "dotenv/config";
import { MongoClient } from "mongodb";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type SourceDoc = {
  product_name?: unknown;
  category?: unknown;
  price?: unknown;
  image_url?: unknown;
  image_mime_type?: unknown;
  colours?: unknown;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
};

const DEFAULT_STOCK = 10;

function describe(doc: SourceDoc): string {
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

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is not set in .env");

  const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  const existingOrderItems = await prisma.orderItem.count();
  if (existingOrderItems > 0) {
    throw new Error(
      `Refusing to replace products: ${existingOrderItems} order item(s) reference existing products. ` +
        `Resolve those orders first, or adjust this script if you want to proceed anyway.`
    );
  }

  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const sourceDocs = await mongoClient.db().collection("catalog").find().toArray();
  await mongoClient.close();

  console.log(`Fetched ${sourceDocs.length} documents from the source catalog.`);

  const products: {
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    category: string;
    stock: number;
  }[] = [];
  let skipped = 0;

  for (const doc of sourceDocs as SourceDoc[]) {
    const name = typeof doc.product_name === "string" ? doc.product_name : null;
    const category = typeof doc.category === "string" ? doc.category : null;
    const rawPrice = typeof doc.price === "number" ? doc.price : null;
    const imageData = typeof doc.image_url === "string" ? doc.image_url : null;
    const mimeType = typeof doc.image_mime_type === "string" ? doc.image_mime_type : "image/jpeg";

    if (!name || !category || rawPrice === null || !imageData) {
      skipped++;
      continue;
    }

    products.push({
      name,
      description: describe(doc),
      price: Math.round(rawPrice * 100),
      imageUrl: `data:${mimeType};base64,${imageData}`,
      category,
      stock: DEFAULT_STOCK,
    });
  }

  if (skipped > 0) {
    console.log(`Skipped ${skipped} document(s) missing a required field (name/category/price/image).`);
  }

  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: products });

  console.log(`Imported ${products.length} products.`);
  console.log("Sample:");
  for (const p of products.slice(0, 5)) {
    console.log(`  ${p.name} — £${(p.price / 100).toFixed(2)} (${p.category})`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Import failed:", error.message);
  process.exitCode = 1;
});
