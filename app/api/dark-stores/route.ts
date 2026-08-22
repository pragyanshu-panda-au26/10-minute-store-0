import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, handler, ok, parseJson, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { INITIAL_DARK_STORES } from "@/lib/adminDummyData";

/**
 * Dark-store hubs — moved from the file DB (`data/satyug_db.json`) to Prisma
 * for durability. Legacy shape kept on the wire so existing admin UI
 * continues to work without a client-side refactor.
 *
 * A single-store deployment leaves this table with one row (usually seeded
 * from INITIAL_DARK_STORES on first read).
 */

/**
 * Serialize the Prisma row into the legacy admin-UI shape. The old file DB
 * used slightly different field names (`coverageRadiusKm`, `status`,
 * `managerName`, etc.) — keep the wire format identical so the admin pages
 * don't have to change.
 */
function serialize(row: any) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    address: row.address,
    city: row.city,
    pincode: row.pincode,
    lat: row.lat,
    lng: row.lng,
    coverageRadiusKm: row.radiusKm,
    // Legacy UI expected an isActive string; use the primary/active mapping
    // it always used: "active" | "offline".
    status: row.isActive ? "active" : "offline",
    // ManagerName / phone weren't in the new Prisma model — surface the
    // contactPhone so existing UI keeps rendering the call-manager button.
    managerName: (row as any).managerName ?? "Store Manager",
    managerPhone: row.contactPhone ?? "+91 98765 43210",
    totalOrdersToday: 0,
    isPrimary: false, // we compute below from sort
  };
}

async function ensureSeeded() {
  const count = await prisma.darkStore.count().catch(() => -1);
  if (count > 0) return;
  if (count < 0) return; // DB unavailable — read handler will handle fallback
  await prisma.darkStore.createMany({
    data: INITIAL_DARK_STORES.map((s: any) => ({
      name: s.name,
      code: s.code ?? null,
      address: s.address ?? "",
      city: s.city ?? "Bhubaneswar",
      pincode: s.pincode ?? "751024",
      lat: s.lat ?? 20.2961,
      lng: s.lng ?? 85.8245,
      radiusKm: s.coverageRadiusKm ?? 5,
      etaMinutes: 10,
      isActive: (s.status ?? "active") === "active",
      contactPhone: s.managerPhone ?? null,
    })),
    skipDuplicates: true,
  }).catch(() => {});
}

export const GET = handler(async () => {
  try {
    await ensureSeeded();
    const rows = await prisma.darkStore.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });
    return ok({ darkStores: rows.map((r, i) => ({ ...serialize(r), isPrimary: i === 0 })) });
  } catch (err) {
    // DB unreachable — fall back to the seed so the admin dashboard still
    // renders instead of blowing up.
    return ok({ darkStores: INITIAL_DARK_STORES });
  }
});

const createSchema = z.object({
  code: z.string().max(30).optional(),
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(400),
  city: z.string().max(120).optional(),
  pincode: z.string().max(10).optional(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  coverageRadiusKm: z.coerce.number().positive().max(50).optional(),
  status: z.string().optional(),
  managerName: z.string().max(120).optional(),
  managerPhone: z.string().max(20).optional(),
  isPrimary: z.boolean().optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const body = await parseJson(req, createSchema);
  if (body instanceof NextResponse) return body;

  const created = await prisma.darkStore.create({
    data: {
      code: body.code || "DS-" + Math.floor(100 + Math.random() * 900),
      name: body.name,
      address: body.address,
      city: body.city || "Bhubaneswar",
      pincode: body.pincode || "751024",
      lat: body.lat,
      lng: body.lng,
      radiusKm: body.coverageRadiusKm ?? 5,
      isActive: (body.status ?? "active") === "active",
      contactPhone: body.managerPhone ?? null,
    },
  });
  return ok({ darkStore: serialize(created) }, { status: 201 });
});

const putSchema = z.object({
  id: z.string(),
  updates: z
    .object({
      name: z.string().max(120).optional(),
      address: z.string().max(400).optional(),
      city: z.string().max(120).optional(),
      pincode: z.string().max(10).optional(),
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional(),
      coverageRadiusKm: z.coerce.number().positive().max(50).optional(),
      status: z.string().optional(),
      managerPhone: z.string().max(20).optional(),
    })
    .optional(),
  setPrimary: z.boolean().optional(),
});

export const PUT = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const body = await parseJson(req, putSchema);
  if (body instanceof NextResponse) return body;

  if (body.updates) {
    await prisma.darkStore.update({
      where: { id: body.id },
      data: {
        ...(body.updates.name !== undefined ? { name: body.updates.name } : {}),
        ...(body.updates.address !== undefined ? { address: body.updates.address } : {}),
        ...(body.updates.city !== undefined ? { city: body.updates.city } : {}),
        ...(body.updates.pincode !== undefined ? { pincode: body.updates.pincode } : {}),
        ...(body.updates.lat !== undefined ? { lat: body.updates.lat } : {}),
        ...(body.updates.lng !== undefined ? { lng: body.updates.lng } : {}),
        ...(body.updates.coverageRadiusKm !== undefined ? { radiusKm: body.updates.coverageRadiusKm } : {}),
        ...(body.updates.status !== undefined ? { isActive: body.updates.status === "active" } : {}),
        ...(body.updates.managerPhone !== undefined ? { contactPhone: body.updates.managerPhone } : {}),
      },
    });
  }
  // setPrimary is a legacy concept — the new schema doesn't carry one; the
  // GET always marks the first active row as primary. Accept the flag for
  // wire compatibility but no-op on the DB side.

  const rows = await prisma.darkStore.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });
  return ok({ darkStores: rows.map((r, i) => ({ ...serialize(r), isPrimary: i === 0 })) });
});

export const DELETE = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return fail("Missing store ID", 400);
  await prisma.darkStore.delete({ where: { id } }).catch(() => null);
  return ok({ message: "Dark store deleted" });
});
