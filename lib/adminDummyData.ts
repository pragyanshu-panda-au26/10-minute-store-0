/**
 * Shared admin/customer types.
 */

export interface AdminProduct {
  id: string;
  sku?: string;
  name: string;
  category: string;
  subcategory?: string;
  costPrice?: number;
  price: number; // rupees (client-side representation)
  originalPrice?: number;
  stock: number;
  imageUrl: string;
  weight: string;
  description?: string;
  rating?: number;
  deliveryTime?: string;
  tags?: string[];
}

export interface DarkStore {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
  coverageRadiusKm: number;
  status: "active" | "inactive" | "maintenance";
  managerName: string;
  managerPhone: string;
  totalOrdersToday: number;
  isPrimary: boolean;
}

// Order lifecycle: admin drives every transition since they deliver themselves.
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface AdminOrderItem {
  id: string;
  productId?: string;
  name: string;
  price: number; // rupees
  quantity: number;
  imageUrl?: string;
  weight?: string;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod = "cod" | "razorpay";

export interface AdminOrder {
  id: string;
  orderNumber?: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  totalPrice: number;
  totalItems: number;
  items: AdminOrderItem[];
  status: OrderStatus;
  /** ISO string of the customer-chosen slot start, or null for instant. */
  scheduledFor?: string | null;
  createdAt: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  refundStatus?: "none" | "refunded" | "pending_refund";
  refundAmount?: number;
  geocoordinates?: { lat: number; lng: number } | null;
}

export interface AbandonedCart {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  items: AdminOrderItem[];
  totalValue: number;
  totalItems: number;
  lastActiveStep: "Basket Drawer" | "Delivery Address Selection" | "Payment Gateway";
  abandonedTimeAgo: string;
  recoveryPingSent: boolean;
  geocoordinates?: { lat: number; lng: number };
}

export interface AdminCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  isBlocked: boolean;
  joinedDate: string;
}

// Initial Dark Store Locations Seed Data
export const INITIAL_DARK_STORES: DarkStore[] = [
  {
    id: "ds_1",
    code: "DS-PATIA-01",
    name: "Patia Dark Store #01 (Central)",
    address: "Plot 45, KIIT Square, Patia, Bhubaneswar",
    city: "Bhubaneswar",
    pincode: "751024",
    lat: 20.2961,
    lng: 85.8245,
    coverageRadiusKm: 5,
    status: "active",
    managerName: "Rajesh Kumar",
    managerPhone: "+91 91234 56789",
    totalOrdersToday: 48,
    isPrimary: true,
  },
  {
    id: "ds_2",
    code: "DS-INFOCITY-02",
    name: "Infocity Tech Park Dark Store",
    address: "Plot 112, Chandaka Industrial Estate, Bhubaneswar",
    city: "Bhubaneswar",
    pincode: "751024",
    lat: 20.3587,
    lng: 85.8142,
    coverageRadiusKm: 6,
    status: "active",
    managerName: "Sanjay Mohanty",
    managerPhone: "+91 98111 22334",
    totalOrdersToday: 32,
    isPrimary: false,
  },
  {
    id: "ds_3",
    code: "DS-SAHEED-03",
    name: "Saheed Nagar Express Hub",
    address: "Plot 88, Janpath, Saheed Nagar, Bhubaneswar",
    city: "Bhubaneswar",
    pincode: "751007",
    lat: 20.2882,
    lng: 85.8421,
    coverageRadiusKm: 4,
    status: "active",
    managerName: "Anil Patnaik",
    managerPhone: "+91 94371 88990",
    totalOrdersToday: 21,
    isPrimary: false,
  },
];

export const INITIAL_ADMIN_ORDERS: AdminOrder[] = [];

export const INITIAL_ABANDONED_CARTS: AbandonedCart[] = [
  {
    id: "ab_1",
    customerName: "Ananya Mishra",
    customerPhone: "+91 98765 11223",
    customerEmail: "ananya.mishra@example.com",
    items: [
      { id: "p1", name: "Fresh Organic Tomatoes", price: 38, quantity: 2, weight: "500 g" },
      { id: "p13", name: "Amul Pasteurised Butter", price: 58, quantity: 1, weight: "100 g" },
      { id: "p16", name: "Coca-Cola Zero Sugar", price: 40, quantity: 2, weight: "300 ml Can" },
    ],
    totalValue: 214,
    totalItems: 5,
    lastActiveStep: "Payment Gateway",
    abandonedTimeAgo: "14 mins ago",
    recoveryPingSent: false,
    geocoordinates: { lat: 20.2961, lng: 85.8245 },
  },
];
