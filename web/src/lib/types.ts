export type Lang = 'en' | 'bn';

export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  group: 'CLOTHING' | 'GADGET';
  image?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  productCount?: number;
}

export interface Variant {
  id: string;
  sku: string;
  price: number;
  comparePrice?: number | null;
  stock: number;
  options: Record<string, string>;
}

export interface ReviewSummary {
  average: number;
  count: number;
  breakdown: number[];
}

export interface Review {
  id: string;
  name: string;
  rating: number;
  comment?: string | null;
  verified: boolean;
  helpful: number;
  adminReply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
}

export type TryOnKind = 'top' | 'bottom' | 'dress';

export interface ProductMedia {
  video?: { url: string };
  spin?: string[];
  hotspots?: { x: number; y: number; title: string; text: string }[];
  colorImages?: Record<string, string[]>;
  sizeChart?: { rows: { size: string; label?: string; heightMin: number; heightMax: number }[] };
  tryOn?: { image: string; kind: TryOnKind; colors?: Record<string, string> };
  store3d?: string;
}

export interface Product {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  descEn?: string | null;
  descBn?: string | null;
  type: 'CLOTHING' | 'GADGET';
  categoryId?: string;
  category?: Category | null;
  brand?: string | null;
  images: string[];
  specs?: { key: string; value: string }[] | null;
  warrantyMonths?: number | null;
  media?: ProductMedia | null;
  isFeatured?: boolean;
  isActive?: boolean;
  price: number;
  comparePrice?: number | null;
  saleEndsAt?: string | null;
  inStock: boolean;
  totalStock?: number;
  variants?: Variant[];
}

export interface OrderItem {
  productId?: string | null;
  variantId?: string | null;
  id: string;
  nameEn: string;
  nameBn: string;
  image?: string | null;
  options?: Record<string, string>;
  unitPrice: number;
  qty: number;
}

export type OrderStatus = 'PENDING' | 'ON_HOLD' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';
export type PaymentMethod = 'COD' | 'BKASH' | 'NAGAD';

export interface Order {
  id: string;
  number: string;
  customerName: string;
  phone: string;
  email?: string | null;
  address: string;
  district: string;
  area?: string | null;
  note?: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentRef?: string | null;
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  total: number;
  couponCode?: string | null;
  courier?: string | null;
  consignmentId?: string | null;
  trackingCode?: string | null;
  courierStatus?: string | null;
  courierError?: string | null;
  source?: string | null;
  items: OrderItem[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email?: string | null;
  phone: string;
  role: 'CUSTOMER' | 'ADMIN' | 'AGENT';
  avatar?: string | null;
  createdAt?: string;
}

export type Settings = Record<string, string>;
export interface Facet {
  key: string;
  nameEn: string;
  nameBn: string;
  values: { value: string; count: number }[];
}