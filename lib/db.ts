/**
 * Legacy file-backed JSON "database".
 *
 * Prisma + Neon is now the source of truth (see `lib/prisma.ts`). This module
 * remains ONLY as a graceful in-memory fallback for the older code paths that
 * still call `getDb()` / `saveDb()` — mostly in the orders route as a
 * "keep-serving-if-Prisma-throws" layer.
 *
 * IMPORTANT for Vercel: the serverless filesystem is read-only outside `/tmp`.
 * Writing to `data/satyug_db.json` throws EROFS and crashes the invocation.
 * We therefore keep everything in-memory when running on Vercel (or any host
 * where writes are disallowed), and only touch the disk in local dev.
 *
 * Do NOT rely on this for durable state — a serverless cold start reboots
 * the process and any in-memory changes are lost.
 */
import fs from "fs";
import path from "path";
import {
  AdminProduct,
  AdminOrder,
  AdminCustomer,
  AbandonedCart,
  DarkStore,
  INITIAL_ABANDONED_CARTS,
  INITIAL_DARK_STORES,
} from "@/lib/adminDummyData";
import { PRODUCTS } from "@/lib/dummyData";

export interface DatabaseSchema {
  products: AdminProduct[];
  orders: AdminOrder[];
  abandonedCarts: AbandonedCart[];
  darkStores: DarkStore[];
  customers: AdminCustomer[];
  coupons: {
    id: string;
    code: string;
    discountPercent: number;
    maxDiscount: number;
    minOrder: number;
    isActive: boolean;
  }[];
  banners: {
    id: string;
    title: string;
    badge: string;
    subtitle: string;
    code: string;
    imageUrl: string;
    isActive: boolean;
  }[];
  /** @deprecated Support tickets moved to Prisma (`SupportTicket`). */
  supportTickets?: SupportTicket[];
}

/** @deprecated Kept only for old file-DB dumps that still reference the field. */
export interface SupportTicket {
  id: string;
  customerId?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  message: string;
  status: "open" | "resolved";
  createdAt: string; // ISO
}

const INITIAL_DB: DatabaseSchema = {
  products: PRODUCTS.map((p) => ({
    id: p.id,
    sku: p.sku || "SKU-SL-" + p.id.toUpperCase(),
    name: p.name,
    category: p.category,
    subcategory: p.subcategory || "General",
    costPrice: p.costPrice || Math.round(p.price * 0.7),
    price: p.price,
    originalPrice: p.originalPrice || Math.round(p.price * 1.25),
    stock: p.stock ?? 25,
    weight: p.weight || "500 g",
    imageUrl: p.imageUrl,
    description: p.description || "",
    rating: p.rating || 4.5,
    deliveryTime: p.deliveryTime || "10 mins",
    tags: p.tags || [],
  })),
  orders: [],
  abandonedCarts: INITIAL_ABANDONED_CARTS,
  darkStores: INITIAL_DARK_STORES,
  customers: [],
  coupons: [],
  banners: [],
  supportTickets: [],
};

// Detect environments where we cannot / should not write to disk.
// Vercel sets VERCEL=1 automatically. Also any read-only container.
const READ_ONLY_FS =
  process.env.VERCEL === "1" ||
  process.env.NEXT_RUNTIME === "edge" ||
  process.env.NODE_ENV === "production";

// Local dev file location
const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "satyug_db.json");

// In-memory copy — the ONLY source of truth on read-only hosts.
let cached: DatabaseSchema | null = null;

function loadFromDisk(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), "utf-8");
      return { ...INITIAL_DB };
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as DatabaseSchema;
    // Backfill missing keys (schema evolution safety)
    if (!parsed.abandonedCarts) parsed.abandonedCarts = INITIAL_ABANDONED_CARTS;
    if (!parsed.darkStores) parsed.darkStores = INITIAL_DARK_STORES;
    if (!parsed.orders) parsed.orders = [];
    if (!parsed.supportTickets) parsed.supportTickets = [];
    return parsed;
  } catch (err) {
    console.warn("[lib/db] failed to load from disk, using in-memory defaults:", err);
    return { ...INITIAL_DB };
  }
}

export function getDb(): DatabaseSchema {
  if (cached) return cached;
  cached = READ_ONLY_FS ? { ...INITIAL_DB } : loadFromDisk();
  return cached;
}

/**
 * Save the DB.
 *   - Local dev: writes to `data/satyug_db.json`.
 *   - Vercel / prod / edge: keeps changes in-memory only for this instance.
 */
export function saveDb(data: DatabaseSchema): void {
  cached = data;
  if (READ_ONLY_FS) return; // no-op — filesystem is read-only

  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[lib/db] disk write failed; keeping in-memory copy only:", err);
  }
}
