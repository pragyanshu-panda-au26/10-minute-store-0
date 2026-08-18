import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 requires config here (not in schema.prisma).
 * DATABASE_URL is used by `prisma migrate`/`prisma db push`/`prisma studio`.
 * The runtime app connects via an adapter (see `lib/prisma.ts`).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
