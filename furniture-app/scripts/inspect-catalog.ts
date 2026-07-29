import "dotenv/config";
import { MongoClient } from "mongodb";

function summarize(value: unknown): unknown {
  if (typeof value === "string" && value.length > 60) {
    return `<string, length ${value.length}, starts "${value.slice(0, 20)}...">`;
  }
  if (Array.isArray(value)) {
    return value.map(summarize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, summarize(v)])
    );
  }
  return value;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in .env");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const collection = db.collection("catalog");

  const count = await collection.countDocuments();
  console.log(`catalog collection: ${count} documents\n`);

  const fieldNames = new Set<string>();
  const cursor = collection.find().limit(200);
  let sampleCount = 0;
  for await (const doc of cursor) {
    Object.keys(doc).forEach((key) => fieldNames.add(key));
    sampleCount++;
  }
  console.log(`Field names seen across ${sampleCount} sampled documents:`);
  console.log([...fieldNames].sort().join(", "));

  console.log("\n5 full sample documents (long strings summarized):");
  const samples = await collection.find().limit(5).toArray();
  for (const doc of samples) {
    console.log(JSON.stringify(summarize(doc), null, 2));
  }

  await client.close();
}

main().catch((error) => {
  console.error("Inspection failed:", error.message);
  process.exitCode = 1;
});
