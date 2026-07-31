import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // admin | manager | staff
  phone: text("phone"),
  active: integer("active").notNull().default(1),
  mustChangePassword: integer("must_change_password").notNull().default(0),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: integer("locked_until"),
  lastLogin: integer("last_login"),
  createdAt: integer("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // SHA-256 hash of the raw session token
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("idx_sessions_user").on(t.userId)],
);

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------
export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    pricingType: text("pricing_type").notNull(), // fixed | per_head | per_hour | per_unit
    rate: integer("rate").notNull(), // paisa
    taxable: integer("taxable").notNull().default(1),
    active: integer("active").notNull().default(1),
    deletedAt: integer("deleted_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("uq_services_name_category").on(t.name, t.category)],
);

// ---------------------------------------------------------------------------
// menu_items
// ---------------------------------------------------------------------------
export const menuItems = sqliteTable("menu_items", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // starter|main|rice|bbq|bread|side|dessert|drink
  perHeadPrice: integer("per_head_price"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---------------------------------------------------------------------------
// bookings
// ---------------------------------------------------------------------------
export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    invoiceNo: text("invoice_no").unique(), // null while status = draft
    clientName: text("client_name").notNull(),
    phone: text("phone").notNull(),
    altPhone: text("alt_phone"),
    cnic: text("cnic"),
    address: text("address"),

    eventType: text("event_type").notNull(),
    eventDate: text("event_date").notNull(), // YYYY-MM-DD
    eventSlot: text("event_slot").notNull(), // day | night
    hallSection: text("hall_section").notNull(),
    guestCount: integer("guest_count").notNull(),
    startTime: text("start_time"),
    endTime: text("end_time"),

    subtotal: integer("subtotal").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    discountReason: text("discount_reason"),
    taxableAmount: integer("taxable_amount").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    grandTotal: integer("grand_total").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),
    balanceDue: integer("balance_due").notNull().default(0),
    dueDate: text("due_date"),

    status: text("status").notNull().default("confirmed"),
    // draft|tentative|confirmed|completed|cancelled
    holdExpiresOn: text("hold_expires_on"),

    cancelledAt: integer("cancelled_at"),
    cancelReason: text("cancel_reason"),
    advanceHandling: text("advance_handling"),
    refundAmount: integer("refund_amount"),

    internalNotes: text("internal_notes"),
    clientNotes: text("client_notes"),
    specialInstructions: text("special_instructions"),

    googleEventId: text("google_event_id"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    index("idx_bookings_availability").on(
      t.eventDate,
      t.eventSlot,
      t.hallSection,
      t.status,
    ),
    index("idx_bookings_invoice").on(t.invoiceNo),
    index("idx_bookings_phone").on(t.phone),
    index("idx_bookings_dues").on(t.status, t.dueDate, t.balanceDue),
    index("idx_bookings_created").on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// booking_services
// ---------------------------------------------------------------------------
export const bookingServices = sqliteTable(
  "booking_services",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    serviceName: text("service_name").notNull(), // snapshot
    pricingType: text("pricing_type").notNull(), // snapshot
    qty: integer("qty").notNull(),
    rate: integer("rate").notNull(), // snapshot
    lineTotal: integer("line_total").notNull(),
    taxable: integer("taxable").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_bs_booking").on(t.bookingId)],
);

// ---------------------------------------------------------------------------
// booking_menu
// ---------------------------------------------------------------------------
export const bookingMenu = sqliteTable(
  "booking_menu",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    itemName: text("item_name").notNull(),
    type: text("type").notNull(),
  },
  (t) => [index("idx_menu_booking").on(t.bookingId)],
);

// ---------------------------------------------------------------------------
// booking_extras
// ---------------------------------------------------------------------------
export const bookingExtras = sqliteTable(
  "booking_extras",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    qty: integer("qty").notNull().default(1),
    rate: integer("rate").notNull(),
    lineTotal: integer("line_total").notNull(),
    taxable: integer("taxable").notNull().default(1),
  },
  (t) => [index("idx_extras_booking").on(t.bookingId)],
);

// ---------------------------------------------------------------------------
// payments
// Note: spec §4.1 also has `installment_id text REFERENCES installments(id)`
// — omitted here because the `installments` table (payment plans) is Phase 2
// scope; add the column + FK in a later migration alongside that table.
// ---------------------------------------------------------------------------
export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id),
    receiptNo: text("receipt_no").notNull().unique(),
    amount: integer("amount").notNull(), // negative for refunds
    method: text("method").notNull(), // cash|bank|cheque|easypaisa|jazzcash
    reference: text("reference"),
    paidOn: text("paid_on").notNull(),
    notes: text("notes"),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [index("idx_payments_booking").on(t.bookingId)],
);

// ---------------------------------------------------------------------------
// taxes
// ---------------------------------------------------------------------------
export const taxes = sqliteTable("taxes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // sales_tax | service_charge | other
  rate: integer("rate").notNull(), // basis points
  active: integer("active").notNull().default(1),
  isDefault: integer("is_default").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
});

// ---------------------------------------------------------------------------
// booking_taxes
// ---------------------------------------------------------------------------
export const bookingTaxes = sqliteTable(
  "booking_taxes",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    taxId: text("tax_id")
      .notNull()
      .references(() => taxes.id),
    taxName: text("tax_name").notNull(), // snapshot
    rate: integer("rate").notNull(), // snapshot, basis points
    taxAmount: integer("tax_amount").notNull(),
  },
  (t) => [index("idx_booking_taxes").on(t.bookingId)],
);

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON for structured values
});

// ---------------------------------------------------------------------------
// audit_log
// ---------------------------------------------------------------------------
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(), // create|update|delete|cancel|restore|login|login_fail|payment
    module: text("module").notNull(),
    recordId: text("record_id"),
    summary: text("summary").notNull(),
    changes: text("changes"), // JSON: { field: [old, new] }
    ip: text("ip"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_audit_created").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// counters
// ---------------------------------------------------------------------------
export const counters = sqliteTable("counters", {
  name: text("name").primaryKey(), // 'invoice_2026', 'receipt_2026'
  value: integer("value").notNull(),
});

// Re-export sql helper for callers that need raw SQL fragments (e.g. counters upsert).
export { sql };
