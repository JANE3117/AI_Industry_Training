import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const DEMO_USERS = [
  { email: "alice@example.com", password: "password123", name: "Alice", budget: 100000 },
  { email: "bob@example.com", password: "password123", name: "Bob", budget: 50000 },
];

const PLACEHOLDER_PRODUCTS = [
  { name: "Oakwood Dining Table", description: "Solid oak table, seats six.", price: 45000, category: "Tables", stock: 8, imageUrl: "https://placehold.co/400x300?text=Dining+Table" },
  { name: "Birch Coffee Table", description: "Light birch veneer, round top.", price: 12000, category: "Tables", stock: 15, imageUrl: "https://placehold.co/400x300?text=Coffee+Table" },
  { name: "Linen Armchair", description: "Upholstered armchair in natural linen.", price: 32000, category: "Chairs", stock: 10, imageUrl: "https://placehold.co/400x300?text=Armchair" },
  { name: "Walnut Dining Chair", description: "Walnut frame, woven seat.", price: 8500, category: "Chairs", stock: 24, imageUrl: "https://placehold.co/400x300?text=Dining+Chair" },
  { name: "Velvet Accent Chair", description: "Deep green velvet, brass legs.", price: 27500, category: "Chairs", stock: 6, imageUrl: "https://placehold.co/400x300?text=Accent+Chair" },
  { name: "3-Seater Sofa", description: "Grey boucle fabric, deep cushions.", price: 89900, category: "Sofas", stock: 5, imageUrl: "https://placehold.co/400x300?text=Sofa" },
  { name: "2-Seater Loveseat", description: "Compact sofa in charcoal fabric.", price: 62000, category: "Sofas", stock: 7, imageUrl: "https://placehold.co/400x300?text=Loveseat" },
  { name: "Oak Bookshelf", description: "5-tier open bookshelf.", price: 18500, category: "Storage", stock: 12, imageUrl: "https://placehold.co/400x300?text=Bookshelf" },
  { name: "Rattan Sideboard", description: "Rattan-front sideboard with 3 drawers.", price: 34500, category: "Storage", stock: 9, imageUrl: "https://placehold.co/400x300?text=Sideboard" },
  { name: "Bedside Table", description: "Compact oak bedside table, one drawer.", price: 7500, category: "Storage", stock: 20, imageUrl: "https://placehold.co/400x300?text=Bedside+Table" },
  { name: "Floor Lamp", description: "Tripod floor lamp, linen shade.", price: 9800, category: "Lighting", stock: 14, imageUrl: "https://placehold.co/400x300?text=Floor+Lamp" },
  { name: "Table Lamp Pair", description: "Set of two ceramic table lamps.", price: 6400, category: "Lighting", stock: 18, imageUrl: "https://placehold.co/400x300?text=Table+Lamps" },
];

async function main() {
  for (const user of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        passwordHash,
        name: user.name,
        budget: user.budget,
      },
    });
  }

  for (const product of PLACEHOLDER_PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    if (!existing) {
      await prisma.product.create({ data: product });
    }
  }

  console.log(`Seeded ${DEMO_USERS.length} users and ${PLACEHOLDER_PRODUCTS.length} products.`);
  console.log("Demo logins:");
  for (const user of DEMO_USERS) {
    console.log(`  ${user.email} / ${user.password}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
