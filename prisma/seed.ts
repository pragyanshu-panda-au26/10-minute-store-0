/**
 * Seed script: `npm run db:seed`
 *
 * Idempotent: safe to run multiple times. It upserts categories, products,
 * banners, coupons, delivery zones, and creates a single admin user from
 * ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD env vars.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import { CATEGORIES, PRODUCTS } from "../lib/dummyData";
import { toPaise } from "../lib/money";

async function main() {
  console.log("→ Seeding categories…");
  for (const [i, c] of CATEGORIES.entries()) {
    if (c.id === "all") continue; // "all" is a UI concept, not a real category
    await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name, icon: c.icon, sortOrder: i },
      create: { id: c.id, name: c.name, icon: c.icon, sortOrder: i },
    });

    for (const [j, sub] of c.subcategories.entries()) {
      if (sub === "All Items") continue;
      await prisma.subcategory.upsert({
        where: { categoryId_name: { categoryId: c.id, name: sub } },
        update: { sortOrder: j },
        create: { categoryId: c.id, name: sub, sortOrder: j },
      });
    }
  }

  console.log("→ Seeding products…");
  for (const p of PRODUCTS) {
    // Find matching subcategory row (if any)
    const sub = p.subcategory
      ? await prisma.subcategory.findUnique({
          where: { categoryId_name: { categoryId: p.category, name: p.subcategory } },
        })
      : null;

    await prisma.product.upsert({
      where: { sku: `SKU-${p.id.toUpperCase()}` },
      update: {
        name: p.name,
        description: p.description ?? "",
        categoryId: p.category,
        subcategoryId: sub?.id ?? null,
        price: toPaise(p.price),
        originalPrice: p.originalPrice ? toPaise(p.originalPrice) : null,
        costPrice: p.costPrice ? toPaise(p.costPrice) : toPaise(Math.round(p.price * 0.7)),
        stock: p.stock ?? 25,
        weight: p.weight ?? "500 g",
        imageUrl: p.imageUrl,
        rating: p.rating ?? 4.5,
        tags: p.tags ?? [],
      },
      create: {
        sku: `SKU-${p.id.toUpperCase()}`,
        name: p.name,
        description: p.description ?? "",
        categoryId: p.category,
        subcategoryId: sub?.id ?? null,
        price: toPaise(p.price),
        originalPrice: p.originalPrice ? toPaise(p.originalPrice) : null,
        costPrice: p.costPrice ? toPaise(p.costPrice) : toPaise(Math.round(p.price * 0.7)),
        stock: p.stock ?? 25,
        weight: p.weight ?? "500 g",
        imageUrl: p.imageUrl,
        rating: p.rating ?? 4.5,
        tags: p.tags ?? [],
      },
    });
  }

  console.log("→ Seeding banners…");
  const banners = [
    {
      title: "Fresh Fruits & Organic Veggies",
      badge: "10minute Flash Deal",
      subtitle: "Get UP TO 40% OFF on daily essentials.",
      code: "SATYUG50",
      imageUrl:
        "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=1000&auto=format&fit=crop&q=80",
      sortOrder: 0,
    },
    {
      title: "Cold Drinks & Munchies",
      badge: "Midnight Craving",
      subtitle: "Stock up on icy soda cans & chips.",
      code: "SATYUG50",
      imageUrl:
        "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=1000&auto=format&fit=crop&q=80",
      sortOrder: 1,
    },
  ];
  // Wipe & reinsert banners (they're display-only, small)
  await prisma.banner.deleteMany();
  for (const b of banners) await prisma.banner.create({ data: b });

  console.log("→ Seeding coupons…");
  const coupons = [
    {
      code: "SATYUG50",
      description: "Flat ₹50 OFF on orders above ₹199",
      type: "flat" as const,
      value: toPaise(50),
      minOrder: toPaise(199),
    },
    {
      code: "FREESHIP",
      description: "100% Free Delivery on your order",
      type: "free_shipping" as const,
      value: toPaise(25),
      minOrder: toPaise(99),
    },
    {
      code: "WELCOME20",
      description: "20% OFF up to ₹100 for new users",
      type: "percent" as const,
      value: 20,
      maxDiscount: toPaise(100),
      minOrder: toPaise(149),
    },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }

  console.log("→ Seeding delivery zones…");
  const zones = [
    { name: "Patia",       pincode: "751024", etaMinutes: 10, deliveryFee: toPaise(19), freeAbove: toPaise(199) },
    { name: "Chandaka",    pincode: "751024", etaMinutes: 12, deliveryFee: toPaise(19), freeAbove: toPaise(199) },
    { name: "Nayapalli",   pincode: "751012", etaMinutes: 15, deliveryFee: toPaise(29), freeAbove: toPaise(299) },
  ];
  for (const z of zones) {
    await prisma.deliveryZone.upsert({
      where: { pincode: z.pincode },
      update: z,
      create: z,
    });
  }

  console.log("→ Seeding admin user…");
  const adminEmail = process.env.ADMIN_SEED_EMAIL || "admin@satyug.local";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "ChangeMeInProd!123";
  const adminName = process.env.ADMIN_SEED_NAME || "Store Owner";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { name: adminName },
    create: { email: adminEmail, name: adminName, passwordHash },
  });
  console.log(`   admin: ${adminEmail}`);

  console.log("✔ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
