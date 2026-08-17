/**
 * BAMYON-IMS — core domain types.
 *
 * These mirror the Firestore data model (build documentation, section 28).
 * Every document that belongs to a merchant carries a `storeId` — queries and
 * security rules use this for tenant isolation. Money is always stored as an
 * integer in the currency's minor unit (kobo, cents, etc) — see lib/money.ts.
 * Never represent money as a floating point number anywhere in this codebase.
 */

export type ID = string;

export type Timestamped = {
  createdAt: number; // epoch millis (client-set on create; rules cap client-side clock skew abuse via serverTimestamp in real writes)
  updatedAt: number;
};

// ---------------------------------------------------------------------------
// Store / tenant
// ---------------------------------------------------------------------------

export interface Store extends Timestamped {
  id: ID;
  name: string;
  slug: string;
  baseCurrency: string; // ISO 4217, e.g. "NGN"
  enabledCurrencies: string[];
  branding: {
    logoUrl?: string;
    faviconUrl?: string;
  };
  theme: {
    colorBrand: string;
    colorBrandDark: string;
    colorBrandLight: string;
    colorAccent: string;
    colorAccentDark: string;
    colorSurface: string;
    colorSurfaceMuted: string;
    colorInk: string;
    colorInkMuted: string;
    radiusCard: string;
    fontDisplay: string;
    fontBody: string;
  };
  featureFlags: {
    community: boolean;
    courses: boolean;
    affiliate: boolean;
    referrals: boolean;
    wallet: boolean;
    pos: boolean;
  };
  policies?: {
    termsUrl?: string;
    privacyUrl?: string;
    returnsUrl?: string;
  };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export type UserRole = "customer" | "staff" | "admin";

export type CustomerStatus =
  | "customer"
  | "verified_customer"
  | "pro_member"
  | "top_member"
  | "elite_member"
  | "affiliate"
  | "shop_owner";

export interface AppUser extends Timestamped {
  uid: ID;
  storeId: ID;
  role: UserRole;
  status: CustomerStatus;
  name: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  whatsapp?: string;
  photoUrl?: string;
  referralCode: string;
  referredBy?: ID | null;
  addresses: Address[];
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  lastSeenAt?: number;
}

export interface Address {
  id: ID;
  label: string;
  fullName: string;
  phone: string;
  countryCode: string;
  state: string;
  city: string;
  line1: string;
  line2?: string;
  isDefault: boolean;
}

export interface StaffProfile extends Timestamped {
  uid: ID;
  storeId: ID;
  roleId: ID;
  permissions: Permission[];
  status: "active" | "suspended";
  lastActiveAt?: number;
}

export interface Role extends Timestamped {
  id: ID;
  storeId: ID;
  name: string;
  permissions: Permission[];
  isSensitive: boolean;
}

/** Action-based permission strings — enforced both in UI and (critically) in Firestore rules. */
export type Permission =
  | "products.read"
  | "products.write"
  | "orders.read"
  | "orders.update"
  | "customers.read"
  | "wallet.read"
  | "wallet.verify"
  | "wallet.adjust"
  | "reviews.moderate"
  | "blog.publish"
  | "community.moderate"
  | "analytics.read"
  | "settings.theme"
  | "staff.manage"
  | "affiliate.manage"
  | "pos.operate";

export interface StaffInvite extends Timestamped {
  email: string; // doc ID is the lowercased email
  storeId: ID;
  permissions: Permission[];
  invitedByUid: ID;
  label: string; // e.g. "Order Manager" — display only
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export type ProductStatus = "draft" | "published" | "archived";

export interface Category extends Timestamped {
  id: ID;
  storeId: ID;
  name: string;
  slug: string;
  parentId?: ID | null;
  imageUrl?: string;
  sortOrder: number;
}

export interface ProductMedia {
  publicId: string; // Cloudinary public ID
  url: string;
  alt?: string;
  isVideo?: boolean;
}

export interface Product extends Timestamped {
  id: ID;
  storeId: ID;
  title: string;
  slug: string;
  description: string;
  categoryIds: ID[];
  brand?: string;
  media: ProductMedia[];
  status: ProductStatus;
  affiliateEnabled: boolean;
  affiliateCommission?: { type: "percent" | "fixed"; value: number };
  seo?: { title?: string; description?: string };
  ratingAverage: number; // denormalized, recomputed from reviews
  ratingCount: number;
}

export interface Variant extends Timestamped {
  id: ID;
  storeId: ID;
  productId: ID;
  sku: string;
  attributes: Record<string, string>; // e.g. { color: "Black", size: "M" }
  priceMinor: number; // minor units of store currency
  compareAtPriceMinor?: number;
  currency: string;
  media?: ProductMedia[];
  stockOnHand: number;
  stockReserved: number;
  lowStockThreshold: number;
}

// ---------------------------------------------------------------------------
// Cart / Orders
// ---------------------------------------------------------------------------

export interface CartItem {
  productId: ID;
  variantId: ID;
  quantity: number;
  // Snapshot at add-time for display only — checkout always re-validates
  // against the live variant document before creating an order.
  titleSnapshot: string;
  priceMinorSnapshot: number;
  imageSnapshot?: string;
}

export interface Cart {
  storeId: ID;
  ownerId: ID; // uid or anonymous session id
  items: CartItem[];
  updatedAt: number;
}

export type OrderPaymentStatus =
  | "pending"
  | "reserved"
  | "paid"
  | "failed"
  | "refunded";

export type OrderDeliveryStatus =
  | "placed"
  | "processing"
  | "packed"
  | "dispatched"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "issue"
  | "cancelled";

export interface OrderItem {
  productId: ID;
  variantId: ID;
  titleSnapshot: string;
  attributesSnapshot: Record<string, string>;
  imageSnapshot?: string;
  quantity: number;
  unitPriceMinorSnapshot: number;
  lineTotalMinor: number;
}

export interface Order extends Timestamped {
  id: ID;
  storeId: ID;
  orderNo: string;
  userId: ID;
  items: OrderItem[];
  currency: string;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  discountMinor: number;
  totalMinor: number;
  paymentStatus: OrderPaymentStatus;
  paymentMethod: "paystack" | "wallet" | "bank_transfer" | "cash";
  deliveryStatus: OrderDeliveryStatus;
  deliveryAddress: Address;
  trackingNumber?: string;
  courier?: string;
  affiliateId?: ID | null;
  referralCode?: string | null;
  channel: "storefront" | "pos";
  notes?: string;
}

export interface Campaign extends Timestamped {
  id: ID;
  storeId: ID;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  linkHref?: string;
  ctaLabel?: string;
  backgroundColor?: string; // hex — falls back to brand color if unset
  startsAt: number | null; // null = starts immediately
  endsAt: number | null; // null = runs indefinitely
  enabled: boolean;
  sortOrder: number;
}

export type HomepageSectionSource = "all_published" | "category" | "manual";

export interface HomepageSection extends Timestamped {
  id: ID;
  storeId: ID;
  title: string;
  subtitle?: string;
  sourceType: HomepageSectionSource;
  categoryId?: string | null; // used when sourceType === "category"
  productIds?: string[]; // used when sourceType === "manual"
  take: number;
  enabled: boolean;
  sortOrder: number;
}

export interface DeliveryZone extends Timestamped {
  id: ID;
  storeId: ID;
  name: string; // e.g. "Lagos Mainland", "Abuja", "Rest of Nigeria"
  states: string[]; // matched case-insensitively against Address.state
  feeMinor: number;
  estimateDaysMin: number;
  estimateDaysMax: number;
  isDefault: boolean; // used when no zone matches the customer's state
}

export interface ErrorLogEntry extends Timestamped {
  id: ID;
  storeId: ID;
  message: string;
  stack?: string;
  context: string; // e.g. "checkout.placeOrder", "pos.recordSale", route path
  userId?: string | null;
  severity: "error" | "warning";
}

// ---------------------------------------------------------------------------
// Wallet — append-only ledger. Balances are DERIVED, never edited directly.
// ---------------------------------------------------------------------------

export type LedgerEntryType =
  | "credit_deposit"
  | "debit_purchase"
  | "reserve_order"
  | "release_reservation"
  | "refund"
  | "commission_pending"
  | "commission_approved"
  | "withdrawal_pending"
  | "withdrawal_paid"
  | "adjustment";

export interface WalletLedgerEntry extends Timestamped {
  id: ID;
  storeId: ID;
  userId: ID;
  type: LedgerEntryType;
  amountMinor: number; // always positive; `type` determines sign/effect
  currency: string;
  reference: string; // order id, payment reference, withdrawal id, etc.
  status: "pending" | "settled" | "reversed";
  actorId: ID; // who caused this entry (user, staff uid, or "system")
  reason?: string; // required for `adjustment`
}

export interface WalletBalance {
  storeId: ID;
  userId: ID;
  currency: string;
  availableMinor: number;
  reservedMinor: number;
  pendingMinor: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface PaymentRecord extends Timestamped {
  id: ID;
  storeId: ID;
  userId: ID;
  provider: "paystack" | "bank_transfer";
  purpose: "wallet_topup" | "order_payment" | "course_payment";
  reference: string;
  amountMinor: number;
  currency: string;
  status: "pending" | "verified" | "failed" | "rejected" | "cancelled";
  relatedOrderId?: ID;
  bankTransferProof?: { bankName: string; note?: string };
  verifiedByStaffId?: ID;
  verifiedAt?: number;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export interface Review extends Timestamped {
  id: ID;
  storeId: ID;
  productId: ID;
  userId: ID;
  userNameSnapshot: string;
  userPhotoSnapshot?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  media?: string[];
  verifiedPurchase: boolean;
  status: "published" | "pending" | "hidden";
  merchantResponse?: { body: string; respondedAt: number; staffId: ID };
  helpfulCount: number;
  viewCount: number;
}

// ---------------------------------------------------------------------------
// Affiliate / Referral
// ---------------------------------------------------------------------------

export interface Affiliate extends Timestamped {
  id: ID;
  storeId: ID;
  userId: ID;
  code: string;
  status: "active" | "suspended";
}

export type AffiliateEventStatus =
  | "clicked"
  | "converted"
  | "commission_pending"
  | "commission_approved"
  | "reversed";

export interface AffiliateEvent extends Timestamped {
  id: ID;
  storeId: ID;
  affiliateId: ID;
  productId?: ID;
  orderId?: ID;
  type: "click" | "conversion";
  commissionMinor?: number;
  status: AffiliateEventStatus;
}

export type ReferralStatus =
  | "pending"
  | "qualified"
  | "approved"
  | "withdrawable"
  | "reversed";

export interface Referral extends Timestamped {
  id: ID;
  storeId: ID;
  referrerId: ID;
  refereeId: ID;
  rewardMinor: number;
  status: ReferralStatus;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditLogEntry extends Timestamped {
  id: ID;
  storeId: ID;
  actorId: ID;
  action: string; // e.g. "wallet.adjustment", "order.override", "staff.permission_change"
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
}

export interface ExchangeRate extends Timestamped {
  fromCurrency: string;
  toCurrency: string; // doc ID: `${fromCurrency}_${toCurrency}`
  rate: number;
  source: "manual" | "provider";
  setByUid?: string;
}

export interface Conversation extends Timestamped {
  id: ID; // one per customer — doc ID == customerId
  storeId: ID;
  customerId: ID;
  customerName: string;
  customerPhotoUrl?: string | null;
  lastMessageBody: string;
  lastMessageSenderRole: "customer" | "staff";
  lastMessageAt: number;
  unreadForCustomer: number;
  unreadForStaff: number;
  status: "open" | "closed";
}

export interface ChatMessage extends Timestamped {
  id: ID;
  conversationId: ID;
  storeId: ID;
  senderId: ID;
  senderRole: "customer" | "staff";
  senderName: string;
  body: string;
  imageUrl?: string | null;
}

export interface StaffAttendanceEntry extends Timestamped {
  id: ID;
  storeId: ID;
  staffUid: ID;
  staffName: string;
  clockInAt: number;
  clockOutAt: number | null;
}

// ---------------------------------------------------------------------------
// Notifications, wishlist, money transfer
// ---------------------------------------------------------------------------

export type NotificationType =
  | "order_update"
  | "payment"
  | "affiliate"
  | "referral"
  | "review_response"
  | "community"
  | "system";

export interface AppNotification extends Timestamped {
  id: ID;
  storeId: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  readAt: number | null;
}

export interface WishlistItem extends Timestamped {
  id: ID; // == productId, one doc per product per user
  storeId: ID;
  userId: ID;
  productId: ID;
}
