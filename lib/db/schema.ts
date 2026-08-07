import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  primaryKey,
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
    // A system service exists to configure the venue itself rather than to be
    // picked per booking — currently only Hall Rent, which supplies the default
    // rate for the pinned first line of every booking. Never offered in the
    // service picker (it would double-count against bookings.hall_rent) and
    // cannot be deleted or deactivated.
    isSystem: integer("is_system").notNull().default(0),
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

    // The venue rental charge. This is the sole base for sales tax, which is
    // quoted inclusive — see calculateTotals() in lib/calculations.ts.
    hallRent: integer("hall_rent").notNull().default(0),
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
// installments
// An optional payment plan attached to a booking. Each row is one scheduled
// step; status is derived (not stored) by comparing linked `payments` rows
// against `amount`.
// ---------------------------------------------------------------------------
export const installments = sqliteTable(
  "installments",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // "Advance", "2nd instalment", "Balance on event day"
    amount: integer("amount").notNull(), // planned amount for this step, paisa
    dueDate: text("due_date").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_installments_bkg").on(t.bookingId, t.dueDate)],
);

// ---------------------------------------------------------------------------
// payments
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
    installmentId: text("installment_id").references(() => installments.id),
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
// expenses
// ---------------------------------------------------------------------------
export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    expenseDate: text("expense_date").notNull(),
    category: text("category").notNull(),
    // salaries|utilities|food_raw|decor_material|maintenance|rent
    // |fuel|transport|marketing|equipment|taxes_fees|misc
    description: text("description").notNull(),
    amount: integer("amount").notNull(), // paisa
    vendor: text("vendor"),
    method: text("method"),
    reference: text("reference"),
    bookingId: text("booking_id").references(() => bookings.id), // NULL = general overhead
    receiptPath: text("receipt_path"),
    isRecurring: integer("is_recurring").notNull().default(0),
    paidBy: text("paid_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    index("idx_expenses_date").on(t.expenseDate),
    index("idx_expenses_booking").on(t.bookingId),
  ],
);

// ---------------------------------------------------------------------------
// quotations
// A priced offer that hasn't become a booking. Mirrors the booking structure
// but issues no invoice number and holds no date — event_date_pref does not
// reserve a slot; only converting to a booking runs the availability check.
// ---------------------------------------------------------------------------
export const quotations = sqliteTable(
  "quotations",
  {
    id: text("id").primaryKey(),
    quoteNo: text("quote_no").notNull().unique(),
    clientName: text("client_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    eventType: text("event_type"),
    eventDatePref: text("event_date_pref"),
    eventSlotPref: text("event_slot_pref"),
    hallPref: text("hall_pref"),
    guestCount: integer("guest_count"),
    hallRent: integer("hall_rent").notNull().default(0),
    subtotal: integer("subtotal").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    grandTotal: integer("grand_total").notNull().default(0),
    validUntil: text("valid_until").notNull(),
    status: text("status").notNull().default("draft"),
    // draft|sent|accepted|expired|declined|converted
    convertedBookingId: text("converted_booking_id").references(() => bookings.id),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    index("idx_quotations_no").on(t.quoteNo),
    index("idx_quotations_status").on(t.status, t.validUntil),
  ],
);

// ---------------------------------------------------------------------------
// quotation_lines
// ---------------------------------------------------------------------------
export const quotationLines = sqliteTable(
  "quotation_lines",
  {
    id: text("id").primaryKey(),
    quotationId: text("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // service | extra
    serviceId: text("service_id").references(() => services.id),
    label: text("label").notNull(),
    qty: integer("qty").notNull(),
    rate: integer("rate").notNull(),
    lineTotal: integer("line_total").notNull(),
    taxable: integer("taxable").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_quotation_lines_quotation").on(t.quotationId)],
);

// ---------------------------------------------------------------------------
// inquiries
// Staff-entered enquiry pipeline — there is no public form (spec §11).
// `preferredSlot` isn't in the spec's raw §4.1 listing but is required by
// the described UI (the inquiry detail view checks date+slot availability).
// ---------------------------------------------------------------------------
export const inquiries = sqliteTable(
  "inquiries",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    eventType: text("event_type"),
    preferredDate: text("preferred_date"),
    preferredSlot: text("preferred_slot"),
    guestEstimate: integer("guest_estimate"),
    message: text("message").notNull(),
    status: text("status").notNull().default("new"),
    // new|read|contacted|converted|closed
    closeReason: text("close_reason"),
    followUpDate: text("follow_up_date"),
    convertedBookingId: text("converted_booking_id").references(() => bookings.id),
    receivedAt: integer("received_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [index("idx_inquiries_status").on(t.status, t.receivedAt)],
);

// ---------------------------------------------------------------------------
// inquiry_notes
// ---------------------------------------------------------------------------
export const inquiryNotes = sqliteTable(
  "inquiry_notes",
  {
    id: text("id").primaryKey(),
    inquiryId: text("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_inquiry_notes_inquiry").on(t.inquiryId)],
);

// ---------------------------------------------------------------------------
// notifications
// Generated on render (dashboard load / panel open), not pushed by a cron —
// see getDuesAlerts()-style computation (spec §5.5, §9.12).
// ---------------------------------------------------------------------------
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    // overdue|due_soon|event_tomorrow|hold_expiring|new_inquiry|sync_failed
    // |installment_due|quote_expiring
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    severity: text("severity").notNull().default("info"), // info|warning|critical
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_notif_created").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// notification_reads
// ---------------------------------------------------------------------------
export const notificationReads = sqliteTable(
  "notification_reads",
  {
    notificationId: text("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: integer("read_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.notificationId, t.userId] }),
    index("idx_notif_reads_user").on(t.userId),
  ],
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
