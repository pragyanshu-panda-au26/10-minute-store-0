import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { DarkStore, INITIAL_DARK_STORES } from "@/lib/adminDummyData";

export async function GET() {
  try {
    const db = getDb();
    const stores = db.darkStores && db.darkStores.length > 0 ? db.darkStores : INITIAL_DARK_STORES;
    return NextResponse.json({ success: true, darkStores: stores });
  } catch (error) {
    return NextResponse.json({ success: true, darkStores: INITIAL_DARK_STORES });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    if (!db.darkStores) db.darkStores = INITIAL_DARK_STORES;

    const newStore: DarkStore = {
      id: "ds_" + Date.now(),
      code: body.code || "DS-" + Math.floor(100 + Math.random() * 900),
      name: body.name,
      address: body.address,
      city: body.city || "Bhubaneswar",
      pincode: body.pincode || "751024",
      lat: parseFloat(body.lat) || 20.2961,
      lng: parseFloat(body.lng) || 85.8245,
      coverageRadiusKm: parseFloat(body.coverageRadiusKm) || 5,
      status: body.status || "active",
      managerName: body.managerName || "Store Manager",
      managerPhone: body.managerPhone || "+91 98765 43210",
      totalOrdersToday: 0,
      isPrimary: body.isPrimary || false,
    };

    if (newStore.isPrimary) {
      db.darkStores = db.darkStores.map((s) => ({ ...s, isPrimary: false }));
    }

    db.darkStores.unshift(newStore);
    saveDb(db);

    return NextResponse.json({ success: true, darkStore: newStore });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to create dark store hub" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, updates, setPrimary } = body;
    const db = getDb();
    if (!db.darkStores) db.darkStores = INITIAL_DARK_STORES;

    if (setPrimary) {
      db.darkStores = db.darkStores.map((s) => ({
        ...s,
        isPrimary: s.id === id,
      }));
    } else if (id && updates) {
      db.darkStores = db.darkStores.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
    }

    saveDb(db);
    return NextResponse.json({ success: true, darkStores: db.darkStores });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to update dark store hub" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing store ID" }, { status: 400 });
    }

    const db = getDb();
    if (!db.darkStores) db.darkStores = INITIAL_DARK_STORES;

    db.darkStores = db.darkStores.filter((s) => s.id !== id);
    saveDb(db);

    return NextResponse.json({ success: true, message: "Dark store deleted" });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to delete dark store hub" },
      { status: 500 }
    );
  }
}
