import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

/**
 * Prisma 7 uses driver adapters. We use the Neon serverless HTTP adapter,
 * which works well from Vercel serverless functions and Edge alike, and
 * connects to any Neon Postgres via the pooled connection string.
 *
 * If you want to run against non-Neon Postgres (e.g. local docker), swap
 * this for `@prisma/adapter-pg` (npm i @prisma/adapter-pg pg).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is not set. Configure your Neon connection string.");
    }
    console.warn("[prisma] DATABASE_URL is not set — queries will fail until you add it to .env.");
  }
  const adapter = new PrismaNeon({ connectionString: connectionString ?? "" });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
