// One-shot seed used to verify Phase B end-to-end — populates ratingCount +
// carousel images on three products and default search placeholders on the
// singleton StoreSetting. Safe to run repeatedly (idempotent updates).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const first3 = await prisma.product.findMany({ take: 3, orderBy: { createdAt: 'asc' } });
  const counts = [12583, 4172, 891];
  const extras = [
    'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1572441710266-c8ecebe12ff5?w=600&auto=format&fit=crop&q=80',
  ];
  for (const [i, p] of first3.entries()) {
    await prisma.product.update({
      where: { id: p.id },
      data: { ratingCount: counts[i], images: extras },
    });
    console.log(`Updated ${p.name} → ratingCount=${counts[i]}, images=${extras.length}`);
  }
  await prisma.storeSetting.update({
    where: { id: 'singleton' },
    data: {
      searchPlaceholders: ['bread', 'milk', 'eggs', 'chips', 'paneer', 'curd', 'rice', 'chocolate'],
    },
  });
  console.log('Store searchPlaceholders seeded.');
}

main().finally(() => prisma.$disconnect());
