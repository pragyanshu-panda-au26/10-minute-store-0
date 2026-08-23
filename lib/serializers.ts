/**
 * Serializers to convert Prisma rows into the JSON shape the client expects.
 * The client works in rupees (numbers), the DB stores paise (integers).
 */
import type {
  Product,
  ProductVariant,
  Category,
  Subcategory,
  Order,
  OrderItem,
  Coupon,
  Banner,
  Address,
  Customer,
} from "@prisma/client";
import { toRupees } from "@/lib/money";

export type SerializedProduct = ReturnType<typeof serializeProduct>;
export function serializeProduct(
  p: Product & { subcategory?: Subcategory | null; variants?: ProductVariant[] }
) {
  const variants = (p.variants ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      price: toRupees(v.price),
      originalPrice: v.originalPrice ? toRupees(v.originalPrice) : null,
      stock: v.stock,
      imageUrl: v.imageUrl ?? null,
      sortOrder: v.sortOrder,
      isDefault: v.isDefault,
    }));

  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description ?? "",
    brand: p.brand ?? null,
    isVeg: p.isVeg,
    category: p.categoryId,
    subcategory: p.subcategory?.name ?? null,
    subcategoryId: p.subcategoryId ?? null,
    price: toRupees(p.price),
    originalPrice: p.originalPrice ? toRupees(p.originalPrice) : null,
    costPrice: p.costPrice ? toRupees(p.costPrice) : null,
    stock: p.stock,
    weight: p.weight,
    imageUrl: p.imageUrl,
    // Full image list for the PDP carousel — always leads with the primary
    // imageUrl so callers can rely on a non-empty array without a fallback.
    // De-duplicated so an admin who accidentally re-uploads the primary as
    // an "additional" image doesn't get a repeated first slide.
    images: (() => {
      const extras = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
      const all = [p.imageUrl, ...extras].filter(Boolean);
      return Array.from(new Set(all));
    })(),
    rating: p.rating,
    ratingCount: p.ratingCount,
    // Blinkit-parity attribute fields — surfaced on the PDP as key-feature
    // chips (type / shelfLife / countryOfOrigin) plus optional ingredients
    // and nutrition sections. All null-safe; the PDP hides any that are
    // empty so fresh produce doesn't render an empty "Shelf life —" row.
    type: p.type ?? null,
    shelfLife: p.shelfLife ?? null,
    countryOfOrigin: p.countryOfOrigin ?? null,
    ingredients: p.ingredients ?? null,
    nutrition: (p.nutrition as Record<string, string> | null) ?? null,
    deliveryTime: `${p.deliveryMinutes} mins`,
    deliveryMinutes: p.deliveryMinutes,
    tags: p.tags,
    isActive: p.isActive,
    variants, // [] when the product has no explicit variants (backward-compat)
  };
}

export function serializeCategory(
  c: Category & { subcategories?: Subcategory[] }
) {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    subcategories: (c.subcategories ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.name),
  };
}

export function serializeOrder(
  o: Order & { items: (OrderItem & { product?: Product | null })[] }
) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    customerName: o.customerNameSnap,
    customerPhone: o.customerPhoneSnap,
    deliveryAddress: o.deliveryAddress,
    status: o.status,
    subtotal: toRupees(o.subtotal),
    discount: toRupees(o.discount),
    deliveryFee: toRupees(o.deliveryFee),
    handlingFee: toRupees(o.handlingFee),
    tip: toRupees(o.tip),
    total: toRupees(o.total),
    totalPrice: toRupees(o.total),
    totalItems: o.items.reduce((n, i) => n + i.quantity, 0),
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    couponCode: o.couponCode,
    razorpayOrderId: o.razorpayOrderId,
    notes: o.notes ?? "",
    scheduledFor: (o as any).scheduledFor ? (o as any).scheduledFor.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    geocoordinates: o.lat != null && o.lng != null ? { lat: o.lat, lng: o.lng } : null,
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      variantId: it.variantId ?? null,
      name: it.nameSnap,
      imageUrl: it.imageSnap ?? undefined,
      weight: it.weightSnap ?? undefined,
      price: toRupees(it.unitPrice),
      quantity: it.quantity,
    })),
  };
}

export function serializeCoupon(c: Coupon) {
  return {
    id: c.id,
    code: c.code,
    description: c.description ?? "",
    type: c.type,
    // Percent coupons store `value` as a percentage (0-100), everything else in paise.
    value: c.type === "percent" ? c.value : toRupees(c.value),
    maxDiscount: c.maxDiscount != null ? toRupees(c.maxDiscount) : null,
    minOrder: toRupees(c.minOrder),
    usageLimit: c.usageLimit,
    timesUsed: c.timesUsed,
    isActive: c.isActive,
    validFrom: c.validFrom.toISOString(),
    validUntil: c.validUntil?.toISOString() ?? null,
  };
}

export function serializeBanner(b: Banner) {
  return {
    id: b.id,
    title: b.title,
    subtitle: b.subtitle ?? "",
    badge: b.badge ?? "",
    code: b.code ?? "",
    imageUrl: b.imageUrl,
    linkUrl: b.linkUrl ?? "",
    sortOrder: b.sortOrder,
    isActive: b.isActive,
  };
}

export function serializeAddress(a: Address) {
  return {
    id: a.id,
    label: a.label,
    houseNo: a.houseNo,
    area: a.area,
    city: a.city,
    pincode: a.pincode,
    lat: a.lat ?? undefined,
    lng: a.lng ?? undefined,
    landmark: a.landmark ?? "",
    contactName: a.contactName ?? "",
    contactPhone: a.contactPhone ?? "",
    isDefault: a.isDefault,
  };
}

export function serializeCustomer(
  c: Customer & { _count?: { orders: number }; orders?: Pick<Order, "total">[] }
) {
  const totalSpent = c.orders
    ? c.orders.reduce((n, o) => n + o.total, 0)
    : 0;
  return {
    id: c.id,
    name: c.name ?? "Customer",
    phone: c.phone,
    email: c.email ?? "",
    isBlocked: c.isBlocked,
    totalOrders: c._count?.orders ?? c.orders?.length ?? 0,
    totalSpent: toRupees(totalSpent),
    joinedDate: c.createdAt.toISOString().slice(0, 10),
  };
}
