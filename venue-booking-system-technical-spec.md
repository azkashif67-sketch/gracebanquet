# Venue Booking & Management System
## Complete Project Context & Technical Documentation

**Version:** 1.0
**Target:** Single-venue event/marquee booking, invoicing, and accounting system
**Audience:** Web developer implementing this system

---

# 1. PROJECT CONTEXT

## 1.1 What This Is

A web-based management system for an event venue (marquee/banquet hall) operating in Pakistan. It replaces paper registers and Excel files with a single system that handles the full lifecycle of a booking: inquiry → quotation → booking → payments → event → reporting.

The system is **management-only** — there is no public-facing website. Everything sits behind authentication: staff create bookings, record payments and installments, log expenses, issue invoices and quotations, and run financial reports. Enquiries are entered by staff as they arrive by phone or walk-in, not through a public form.

## 1.2 Who Uses It

| Role | Who | What they do |
|---|---|---|
| **Admin** | Owner | Everything. Deletes, user management, tax reports, settings, audit log |
| **Manager** | Operations manager | Bookings, payments, expenses, discounts, most reports. No deletes |
| **Staff** | Reception | Create bookings, enter inquiries, view calendar. No financial data |

## 1.3 The Business Problem

A venue takes bookings months in advance. Each booking involves:

- A **date and time slot** that must not be double-booked (this is the single most costly error possible)
- A **set of services** — catering priced per head (with a menu chosen per event), plus fixed-price items like sound, lighting, entry decor
- **Money collected in installments** — an advance at booking, part payments over months, balance on or before the event day
- **Sales tax** that must be tracked separately for FBR filing
- **Expenses** tied to specific events, so profit per event is knowable

Currently these live in a register and the owner's memory. Missed balance collections and double-bookings are the two recurring failures the system exists to prevent.

## 1.4 Non-Goals

Explicitly out of scope for v1:

- Any public-facing website or client portal (this is an internal management tool only)
- Multi-venue / multi-tenant SaaS (architecture allows it later; don't build it now)
- Online payment collection (Pakistani gateway integration is a separate project)
- SMS/WhatsApp API sending (clipboard-copy composer only)
- Staff attendance, payroll, inventory
- Mobile apps (responsive web is sufficient)

---

# 2. TECHNOLOGY STACK

```
Framework       Next.js 15 (App Router, React Server Components)
Language        TypeScript (strict)
Database        Turso (libSQL / SQLite at the edge)
ORM             Drizzle ORM + drizzle-kit
Auth            Lucia (credentials provider, sessions in Turso)
Styling         Tailwind CSS
Components      shadcn/ui (copied into repo, not a dependency)
Tables          TanStack Table v8
Forms           react-hook-form + Zod
Charts          Recharts
Dates           date-fns
Calendar sync   googleapis (Google Calendar API, service account)
PDF output      Print CSS + browser print dialog (no server-side rendering)
Hosting         Vercel (region: sin1 — Singapore)
CDN / Security  Cloudflare (proxy, WAF, Access)
```

## 2.1 Why These Choices

**Next.js App Router.** Turso is accessed via an SDK with an auth token that cannot reach the browser. Server Components let you query the database directly inside the component that renders the data, and Server Actions handle form writes. This removes an entire API layer from the architecture — no REST endpoints to write for standard CRUD.

**Turso over Postgres.** Write volume is ~50 operations/day. SQLite handles this trivially, the free tier is generous enough that six months costs $0, and there's no connection-pool management. Set `PRAGMA foreign_keys = ON` explicitly — libSQL does not enable it by default.

**Drizzle over Prisma.** Turso's officially supported ORM, SQLite-native, lighter client for serverless, and generates readable SQL migrations you can inspect.

**shadcn/ui over a component library.** The booking wizard, calendar grid, and invoice layout all need heavy customization. Owning the component source beats fighting a library's API.

**Print CSS over jsPDF/Puppeteer.** A `@media print` stylesheet on a normal invoice page gives correct typography, selectable text, and a real PDF via the browser's "Save as PDF". Puppeteer needs 300MB+ RAM and won't run in a Vercel serverless function. jsPDF means manually positioning every element.

**Custom calendar, not FullCalendar.** Every calendar library is built around time-block scheduling. This system needs 2–3 discrete slots per date cell, colour-coded by status, filtered by hall. That's ~150 lines of CSS Grid and less work than bending a library.

## 2.2 Cost

| Service | Plan | Cost |
|---|---|---|
| Turso | Free (9GB storage, 1B reads/mo, 25M writes/mo) | $0 |
| Vercel | Hobby | $0 |
| Cloudflare | Free | $0 |
| Google Calendar API | Free tier | $0 |
| Domain | Registrar | ~$12/yr |

Projected usage at one venue is under 1% of every free-tier limit. Note: Vercel's Hobby plan prohibits commercial use in its terms. For a single owner-operated venue this is unenforced in practice, but if this becomes a product sold to other venues, budget $20/mo for Vercel Pro.

---

# 3. ARCHITECTURE

## 3.1 Request Flow

```
Browser
  ↓
Cloudflare (DNS proxy, WAF, rate limiting, Access on /admin)
  ↓
Vercel Edge (Next.js, region sin1)
  ↓
Server Component / Server Action
  ↓  (requireRole() check)
Drizzle ORM
  ↓
Turso (libSQL, Singapore region)
```

Side effects (Google Calendar sync) fire after the database write commits, in a try/catch that never blocks the response.

## 3.2 Directory Structure

```
/app
  /(admin)                     Management — auth required (no public side)
    layout.tsx                 Sidebar nav, header, notification bell, session guard
    /dashboard/page.tsx        Landing: alerts, KPIs, latest 5 bookings
    /schedule/page.tsx         Wide interactive calendar
    /bookings
      page.tsx                 List
      /new/page.tsx            4-step wizard
      /[id]/page.tsx           Details
      /[id]/edit/page.tsx
      /[id]/invoice/page.tsx   Print layout
      /[id]/receipt/[paymentId]/page.tsx
      /[id]/function-sheet/page.tsx
    /invoices/page.tsx         Searchable invoice list
    /quotations
      page.tsx                 List
      /new/page.tsx            Quotation builder
      /[id]/page.tsx           Details
      /[id]/print/page.tsx     Print layout
    /clients
      page.tsx                 Directory
      /[phone]/page.tsx        Client history
    /services/...
    /expenses/...
    /taxes/page.tsx            Tax catalogue CRUD
    /reports
      /revenue/page.tsx
      /tax/page.tsx
      /receivables/page.tsx
      /profit/page.tsx
      /occupancy/page.tsx
    /inquiries/...
    /settings
      page.tsx                 System settings tabs
      /users/...
      /audit/page.tsx
      /recycle-bin/page.tsx
      /backup/page.tsx
  /login/page.tsx
  /api                         Only where Server Actions won't do
    /cron/reminders/route.ts
    /cron/backup/route.ts

/lib
  /db
    schema.ts                  Drizzle table definitions
    index.ts                   Turso client
    queries/                   Reusable query functions
  /auth
    lucia.ts
    require-role.ts            THE permission gate
  /google-calendar.ts
  /invoice-number.ts
  /calculations.ts             Tax, totals, balances — pure functions
  /audit.ts

/components
  /ui                          shadcn primitives
  /booking-wizard/
  /schedule/                   Calendar grid, slot strips, views
  /print/                      Invoice, receipt, function sheet layouts

/drizzle                       Generated migrations
```

## 3.3 Core Architectural Rules

**1. The database is the only source of truth for availability.** Google Calendar is a downstream mirror. If the Calendar API fails, bookings still save. Never read availability from Google.

**2. Every Server Action starts with `requireRole()`.** There is no row-level security layer beneath the application. The app is the only guard on financial data.

**3. Money is stored as integers (paisa).** Never floats. `Rs 957,000.50` is stored as `95700050`. Format at the display layer only. Floating-point arithmetic on currency produces rounding errors that will eventually appear on an invoice.

**4. Historical records are immutable in their pricing.** `booking_services.rate` stores the rate at time of booking. Changing a service's price later must not alter past invoices.

**5. Delete is soft by default.** Records move to a recycle bin with a 30-day retention. Invoice numbers are never recycled.

**6. Every mutation writes an audit row.** Non-negotiable for financial data.

---

# 4. DATABASE SCHEMA

All monetary columns are `integer` storing paisa. All dates are `text` in `YYYY-MM-DD`. All timestamps are `integer` Unix epoch seconds.

## 4.1 Tables

### users
```sql
id                   text PRIMARY KEY          -- nanoid
username             text UNIQUE NOT NULL
email                text                      -- required for password-reset delivery
password_hash        text NOT NULL             -- argon2id
full_name            text NOT NULL
role                 text NOT NULL             -- admin | manager | staff
phone                text
active               integer NOT NULL DEFAULT 1
must_change_password integer NOT NULL DEFAULT 0 -- forces change-password screen on next login
failed_attempts      integer NOT NULL DEFAULT 0
locked_until         integer
last_login           integer
created_at           integer NOT NULL
```

### password_reset_tokens
```sql
id          text PRIMARY KEY
user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE
token_hash  text NOT NULL          -- SHA-256 of the token; raw token only in the emailed link
expires_at  integer NOT NULL       -- now + 30 minutes
used_at     integer                -- set once redeemed; single-use
created_at  integer NOT NULL
```

### sessions
```sql
id          text PRIMARY KEY
user_id     text NOT NULL REFERENCES users(id)
expires_at  integer NOT NULL
```

### services
```sql
id              text PRIMARY KEY
name            text NOT NULL
category        text NOT NULL     -- sound|lighting|entry|decor|catering|photography|furniture|misc
description     text
pricing_type    text NOT NULL     -- fixed | per_head | per_hour | per_unit
rate            integer NOT NULL  -- paisa
taxable         integer NOT NULL DEFAULT 1
active          integer NOT NULL DEFAULT 1
deleted_at      integer
created_at      integer NOT NULL

UNIQUE(name, category)
```

### menu_items
```sql
id           text PRIMARY KEY
service_id   text NOT NULL REFERENCES services(id) ON DELETE CASCADE
name         text NOT NULL
type         text NOT NULL   -- starter|main|rice|bbq|bread|side|dessert|drink
per_head_price integer       -- nullable; optional per-item pricing
sort_order   integer NOT NULL DEFAULT 0
```

Menu items belong to a catering service and act as its default dish list. When that service is added to a booking, its items copy into `booking_menu`, where staff adjust them per event. This drives the function sheet.

### bookings
```sql
id                    text PRIMARY KEY
invoice_no            text UNIQUE NOT NULL      -- INV-2026-0143
client_name           text NOT NULL
phone                 text NOT NULL
alt_phone             text
cnic                  text
address               text

event_type            text NOT NULL   -- wedding|mehndi|walima|barat|engagement|birthday|aqiqah|corporate|seminar|other
event_date            text NOT NULL   -- YYYY-MM-DD
event_slot            text NOT NULL   -- day | night  (max 2 bookings per date per hall)
hall_section          text NOT NULL
guest_count           integer NOT NULL
start_time            text
end_time              text

subtotal              integer NOT NULL DEFAULT 0
discount_amount       integer NOT NULL DEFAULT 0
discount_reason       text
taxable_amount        integer NOT NULL DEFAULT 0
tax_amount            integer NOT NULL DEFAULT 0      -- sum of all applied taxes (see booking_taxes)
grand_total           integer NOT NULL DEFAULT 0
amount_paid           integer NOT NULL DEFAULT 0      -- denormalised, recomputed on payment change
balance_due           integer NOT NULL DEFAULT 0      -- denormalised
due_date              text

status                text NOT NULL DEFAULT 'confirmed'
                      -- draft|tentative|confirmed|completed|cancelled
hold_expires_on       text            -- only when status = tentative

cancelled_at          integer
cancel_reason         text
advance_handling      text            -- refund_full | refund_partial | forfeit
refund_amount         integer

internal_notes        text
client_notes          text
special_instructions  text

google_event_id       text
created_by            text NOT NULL REFERENCES users(id)
created_at            integer NOT NULL
updated_at            integer NOT NULL
deleted_at            integer
```

### booking_services
```sql
id           text PRIMARY KEY
booking_id   text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE
service_id   text NOT NULL REFERENCES services(id)
service_name text NOT NULL      -- snapshot: survives service rename
pricing_type text NOT NULL      -- snapshot
qty          integer NOT NULL
rate         integer NOT NULL   -- snapshot of price at booking time
line_total   integer NOT NULL
sort_order   integer NOT NULL DEFAULT 0
```

### booking_menu
```sql
id            text PRIMARY KEY
booking_id    text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE
item_name     text NOT NULL     -- free text; may be custom, not from menu_items
type          text NOT NULL
```

### booking_extras
```sql
id           text PRIMARY KEY
booking_id   text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE
label        text NOT NULL
qty          integer NOT NULL DEFAULT 1
rate         integer NOT NULL
line_total   integer NOT NULL
taxable      integer NOT NULL DEFAULT 1
```

### payments
```sql
id            text PRIMARY KEY
booking_id    text NOT NULL REFERENCES bookings(id)
receipt_no    text UNIQUE NOT NULL    -- RCP-2026-0087
amount        integer NOT NULL        -- negative for refunds
method        text NOT NULL           -- cash|bank|cheque|easypaisa|jazzcash
reference     text                    -- cheque no, transaction id
paid_on       text NOT NULL
installment_id text REFERENCES installments(id)  -- nullable; links a payment to a plan step
notes         text
recorded_by   text NOT NULL REFERENCES users(id)
created_at    integer NOT NULL
deleted_at    integer
```

### taxes
The venue's tax catalogue, managed under the Taxes section. Venue-wide, not per-service.
```sql
id          text PRIMARY KEY
name        text NOT NULL          -- "Punjab Sales Tax", "Service Charge"
type        text NOT NULL          -- sales_tax | service_charge | other
rate        integer NOT NULL       -- basis points: 1600 = 16.00%
active      integer NOT NULL DEFAULT 1
is_default  integer NOT NULL DEFAULT 0   -- auto-applied to new bookings
sort_order  integer NOT NULL DEFAULT 0
created_at  integer NOT NULL
deleted_at  integer
```

### booking_taxes
Which taxes were applied to a booking, snapshotted so a later rate change never rewrites a past invoice.
```sql
id          text PRIMARY KEY
booking_id  text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE
tax_id      text NOT NULL REFERENCES taxes(id)
tax_name    text NOT NULL          -- snapshot
rate        integer NOT NULL       -- snapshot (basis points)
tax_amount  integer NOT NULL       -- computed on the booking's taxable amount
```

### installments
An optional payment plan attached to a booking. Each row is one scheduled step.
```sql
id           text PRIMARY KEY
booking_id   text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE
label        text NOT NULL          -- "Advance", "2nd instalment", "Balance on event day"
amount       integer NOT NULL       -- planned amount for this step
due_date     text NOT NULL
sort_order   integer NOT NULL
-- status is derived, not stored: compare payments linked to this id against amount
```

### quotations
A priced offer that has not yet become a booking. Mirrors the booking structure but issues no invoice number and holds no date.
```sql
id             text PRIMARY KEY
quote_no       text UNIQUE NOT NULL   -- QTN-2026-0034
client_name    text NOT NULL
phone          text NOT NULL
email          text
event_type     text
event_date_pref text                  -- non-binding; does not reserve a slot
event_slot_pref text
hall_pref      text
guest_count    integer
subtotal       integer NOT NULL DEFAULT 0
discount_amount integer NOT NULL DEFAULT 0
tax_amount     integer NOT NULL DEFAULT 0
grand_total    integer NOT NULL DEFAULT 0
valid_until    text NOT NULL          -- expiry date
status         text NOT NULL DEFAULT 'draft'  -- draft|sent|accepted|expired|declined|converted
converted_booking_id text REFERENCES bookings(id)
notes          text
created_by     text NOT NULL REFERENCES users(id)
created_at     integer NOT NULL
updated_at     integer NOT NULL
deleted_at     integer
```

### quotation_lines
```sql
id           text PRIMARY KEY
quotation_id text NOT NULL REFERENCES quotations(id) ON DELETE CASCADE
kind         text NOT NULL          -- service | extra
service_id   text REFERENCES services(id)
label        text NOT NULL
qty          integer NOT NULL
rate         integer NOT NULL
line_total   integer NOT NULL
taxable      integer NOT NULL DEFAULT 1
sort_order   integer NOT NULL DEFAULT 0
```

### notifications
Feeds the activity/notification centre. Rows are generated by the system and marked read per user.
```sql
id          text PRIMARY KEY
type        text NOT NULL          -- overdue|due_soon|event_tomorrow|hold_expiring
                                   -- |new_inquiry|sync_failed|installment_due|quote_expiring
title       text NOT NULL
body        text
link        text                   -- deep link into the relevant record
severity    text NOT NULL DEFAULT 'info'  -- info|warning|critical
entity_type text                   -- booking|inquiry|quotation|sync
entity_id   text
created_at  integer NOT NULL
```

### notification_reads
Read state is per user, so a shared notification can be dismissed independently.
```sql
notification_id text NOT NULL REFERENCES notifications(id) ON DELETE CASCADE
user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE
read_at         integer NOT NULL
PRIMARY KEY (notification_id, user_id)
```


### expenses
```sql
id             text PRIMARY KEY
expense_date   text NOT NULL
category       text NOT NULL
               -- salaries|utilities|food_raw|decor_material|maintenance|rent
               -- |fuel|transport|marketing|equipment|taxes_fees|misc
description    text NOT NULL
amount         integer NOT NULL
vendor         text
method         text
reference      text
booking_id     text REFERENCES bookings(id)   -- NULL = general overhead
receipt_path   text                            -- uploaded scan
is_recurring   integer NOT NULL DEFAULT 0
paid_by        text NOT NULL REFERENCES users(id)
created_at     integer NOT NULL
deleted_at     integer
```

### inquiries
```sql
id                text PRIMARY KEY
name              text NOT NULL
phone             text NOT NULL
email             text
event_type        text
preferred_date    text
guest_estimate    integer
message           text NOT NULL
status            text NOT NULL DEFAULT 'new'   -- new|read|contacted|converted|closed
close_reason      text
follow_up_date    text
converted_booking_id text REFERENCES bookings(id)
received_at       integer NOT NULL
deleted_at        integer
```

### inquiry_notes
```sql
id           text PRIMARY KEY
inquiry_id   text NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE
note         text NOT NULL
created_by   text NOT NULL REFERENCES users(id)
created_at   integer NOT NULL
```

### settings
```sql
key    text PRIMARY KEY
value  text NOT NULL     -- JSON for structured values
```

Keys: `venue_name`, `address`, `phone`, `email`, `ntn`, `logo_path`, `invoice_prefix`, `receipt_prefix`, `quote_prefix`, `terms_text`, `tax_on_discounted`, `due_date_offset_days`, `quote_validity_days`, `halls` (JSON array), `slots` (JSON — exactly two: day, night, with editable labels/times), `event_types` (JSON array), `expense_categories` (JSON array), `hold_default_days`, `idle_logout_minutes`, `recycle_retention_days`, `backup_folder`, `backup_retention`. (Individual taxes are rows in the `taxes` table, not settings keys. No public-site keys — the system is management-only.)

### audit_log
```sql
id          text PRIMARY KEY
user_id     text NOT NULL REFERENCES users(id)
action      text NOT NULL      -- create|update|delete|cancel|restore|login|login_fail|payment
module      text NOT NULL      -- booking|service|expense|payment|user|settings|auth
record_id   text
summary     text NOT NULL      -- human-readable one-liner
changes     text               -- JSON: { field: [old, new] }
ip          text
created_at  integer NOT NULL
```

### sync_queue
```sql
id           text PRIMARY KEY
booking_id   text NOT NULL REFERENCES bookings(id)
action       text NOT NULL     -- create | update | cancel | delete
attempts     integer NOT NULL DEFAULT 0
last_error   text
created_at   integer NOT NULL
```

### counters
```sql
name    text PRIMARY KEY     -- 'invoice_2026', 'receipt_2026'
value   integer NOT NULL
```

## 4.2 Indexes

These are not optional. Turso bills on rows *scanned*, and the availability query runs on every keystroke in the date picker.

```sql
CREATE INDEX idx_bookings_availability
  ON bookings(event_date, event_slot, hall_section, status);
CREATE INDEX idx_bookings_invoice   ON bookings(invoice_no);
CREATE INDEX idx_bookings_phone     ON bookings(phone);
CREATE INDEX idx_bookings_dues      ON bookings(status, due_date, balance_due);
CREATE INDEX idx_bookings_created   ON bookings(created_at);
CREATE INDEX idx_bs_booking         ON booking_services(booking_id);
CREATE INDEX idx_extras_booking     ON booking_extras(booking_id);
CREATE INDEX idx_menu_booking       ON booking_menu(booking_id);
CREATE INDEX idx_payments_booking   ON payments(booking_id);
CREATE INDEX idx_expenses_date      ON expenses(expense_date);
CREATE INDEX idx_expenses_booking   ON expenses(booking_id);
CREATE INDEX idx_inquiries_status   ON inquiries(status, received_at);
CREATE INDEX idx_audit_created      ON audit_log(created_at);
CREATE INDEX idx_sessions_user      ON sessions(user_id);
CREATE INDEX idx_reset_token        ON password_reset_tokens(token_hash);
CREATE INDEX idx_booking_taxes      ON booking_taxes(booking_id);
CREATE INDEX idx_installments_bkg   ON installments(booking_id, due_date);
CREATE INDEX idx_quotations_no      ON quotations(quote_no);
CREATE INDEX idx_quotations_status  ON quotations(status, valid_until);
CREATE INDEX idx_notif_created      ON notifications(created_at);
CREATE INDEX idx_notif_reads_user   ON notification_reads(user_id);
```

Never `SELECT *` on list pages. The bookings table has ~35 columns; the list view needs 12.

## 4.3 Seed Data

On first run, insert:

**Services**
| Name | Category | Pricing | Rate |
|---|---|---|---|
| Catering (per head) | catering | per_head | Rs 1,800 |
| Basic Sound System | sound | fixed | Rs 25,000 |
| Premium Sound System | sound | fixed | Rs 45,000 |
| Entry Lights | lighting | fixed | Rs 30,000 |
| Complete Entry Setup | entry | fixed | Rs 65,000 |
| Stage Decor | decor | fixed | Rs 55,000 |
| Flower Decoration | decor | fixed | Rs 35,000 |
| Photography | photography | fixed | Rs 60,000 |
| Videography | photography | fixed | Rs 80,000 |
| Extra AC Units | misc | per_unit | Rs 8,000 |
| Generator Backup | misc | fixed | Rs 20,000 |
| Valet Parking | misc | fixed | Rs 15,000 |

**Menu items** (attached to the Catering service as its default dish list)

| Type | Items |
|---|---|
| Starter | Chicken Boti, Malai Boti, Seekh Kebab, Chapli Kebab, Fish Tikka, Dahi Bhalla |
| Main | Chicken Karahi, Mutton Karahi, Chicken Handi, Nihari, Haleem, Mutton Qorma, Chicken Ginger, Daal Makhani |
| Rice | Chicken Biryani, Mutton Biryani, Beef Pulao, Kabuli Pulao, Zarda |
| BBQ | Malai Tikka, Reshmi Kebab, Bihari Boti, Tandoori Chicken, Gola Kebab |
| Bread | Naan, Roghni Naan, Kulcha, Sheermal, Roti, Taftan |
| Side | Raita, Salad, Mint Chutney, Achar, Kachumar, Papad |
| Dessert | Gulab Jamun, Kheer, Ras Malai, Gajar Halwa, Firni, Ice Cream, Shahi Tukray |
| Drink | Soft Drinks, Mineral Water, Kashmiri Chai, Sweet Lassi, Fresh Lime, Rooh Afza, Green Tea |

When the Catering service is added to a booking, this full list copies into `booking_menu`, where staff tick or edit dishes for that specific event. There are no fixed priced packages — catering is a single per-head service and the menu is chosen per booking.

**Taxes**
| Name | Type | Rate | Default |
|---|---|---|---|
| Punjab Sales Tax | sales_tax | 16.00% | yes |

Seed a single default tax so bookings compute correctly out of the box. The venue adds or edits taxes under the Taxes section.

**Settings defaults:** invoice prefix `INV`, receipt prefix `RCP`, quote prefix `QTN`, due date offset 2 days, hold duration 7 days, quote validity 14 days, idle logout 30 minutes, recycle retention 30 days.

---

# 5. CORE LOGIC

These are the pure functions that everything else depends on. Put them in `/lib/calculations.ts` and unit-test them. Bugs here surface as wrong invoices.

## 5.1 Money Handling

```ts
// All amounts are integers in paisa. 1 rupee = 100 paisa.
export const toPaisa  = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paisa: number)  => paisa / 100;

export const formatPKR = (paisa: number) =>
  'Rs ' + (paisa / 100).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
```

Tax rate is stored in basis points: `1600` = 16.00%. This keeps percentage arithmetic in integers too.

## 5.2 Booking Totals

```ts
interface TotalsInput {
  serviceLines: { qty: number; rate: number; taxable: boolean }[];
  extraLines:   { qty: number; rate: number; taxable: boolean }[];
  discountAmount: number;
  taxes: { id: string; name: string; rateBps: number }[];  // the taxes applied to this booking
  taxOnDiscounted: boolean;   // from settings
}

export function calculateTotals(input: TotalsInput) {
  const lineTotal = (l: { qty: number; rate: number }) => l.qty * l.rate;

  const subtotal =
    input.serviceLines.reduce((s, l) => s + lineTotal(l), 0) +
    input.extraLines.reduce((s, l) => s + lineTotal(l), 0);

  const discount = Math.min(input.discountAmount, subtotal);

  // Base on which tax is charged
  const taxableBase = input.taxOnDiscounted ? subtotal - discount : subtotal;

  // Only taxable lines contribute; compute their proportion of the base
  const taxableLineSum =
    input.serviceLines.filter(l => l.taxable).reduce((s, l) => s + lineTotal(l), 0) +
    input.extraLines.filter(l => l.taxable).reduce((s, l) => s + lineTotal(l), 0);

  const taxableProportion = subtotal === 0 ? 0 : taxableLineSum / subtotal;
  const taxableAmount = Math.round(taxableBase * taxableProportion);

  // Each applicable tax is computed on the same taxable amount, then summed.
  // Returned per-tax so booking_taxes can be written with a snapshot of each.
  const taxLines = input.taxes.map(t => ({
    id: t.id,
    name: t.name,
    rateBps: t.rateBps,
    amount: Math.round(taxableAmount * t.rateBps / 10000),
  }));
  const taxAmount = taxLines.reduce((s, t) => s + t.amount, 0);

  const grandTotal = subtotal - discount + taxAmount;

  return { subtotal, discount, taxableAmount, taxLines, taxAmount, grandTotal };
}
```

Taxes are venue-wide and additive: each applies to the same taxable amount (Punjab Sales Tax 16% *plus* a Service Charge 5% both compute off the taxable base, not compounding on each other). The per-tax breakdown is snapshotted into `booking_taxes` so a later rate change never alters a past invoice. Which taxes apply to a booking defaults to all `is_default = 1` taxes and is editable per booking.

**Balance** is always derived, never entered:

```ts
balance_due = grand_total - SUM(payments.amount WHERE deleted_at IS NULL)
```

Refunds are stored as negative payment rows, so the same SUM handles them.

`amount_paid` and `balance_due` on the bookings table are denormalised for query speed. They must be recomputed inside the same transaction as any payment insert, update, or delete. Never let them drift.

## 5.3 Invoice & Receipt Numbering

```ts
export async function nextInvoiceNo(tx: Transaction): Promise<string> {
  const year   = new Date().getFullYear();
  const key    = `invoice_${year}`;
  const prefix = await getSetting('invoice_prefix'); // 'INV'

  // Atomic increment inside the caller's transaction
  await tx.run(sql`
    INSERT INTO counters (name, value) VALUES (${key}, 1)
    ON CONFLICT(name) DO UPDATE SET value = value + 1
  `);
  const row = await tx.get(sql`SELECT value FROM counters WHERE name = ${key}`);

  return `${prefix}-${year}-${String(row.value).padStart(4, '0')}`;
}
```

Rules:
- The counter increment must be in the **same transaction** as the booking insert. Two concurrent bookings otherwise get the same number.
- Numbers are **never reused**, even after deletion. Gaps in the sequence are acceptable and expected.
- Sequence resets each January. `INV-2026-0001` follows `INV-2025-0847`.
- Receipts use an identical function with the `receipt_` counter prefix.

## 5.4 Availability

The single most important query in the system.

```ts
export async function checkAvailability(params: {
  eventDate: string;
  eventSlot: 'day' | 'night';
  hallSection: string;
  excludeBookingId?: string;   // set when editing
}) {
  const conflicts = await db
    .select({
      id: bookings.id,
      invoiceNo: bookings.invoiceNo,
      clientName: bookings.clientName,
      status: bookings.status,
    })
    .from(bookings)
    .where(and(
      eq(bookings.eventDate, params.eventDate),
      eq(bookings.eventSlot, params.eventSlot),
      inArray(bookings.status, ['confirmed', 'tentative']),
      isNull(bookings.deletedAt),
      params.excludeBookingId
        ? ne(bookings.id, params.excludeBookingId)
        : undefined,
      hallConflict(params.hallSection),
    ));

  return { available: conflicts.length === 0, conflicts };
}
```

**Hall conflict logic.** "Full Venue" blocks every section; any section blocks "Full Venue":

```ts
function hallConflict(requested: string) {
  if (requested === 'Full Venue') return undefined;          // conflicts with all
  return or(
    eq(bookings.hallSection, requested),
    eq(bookings.hallSection, 'Full Venue'),
  );
}
```

**Where this is called:**
1. Live in the wizard as the user picks a date (debounced 300ms) — informational
2. Again inside the save transaction — authoritative

Step 2 is mandatory. Two receptionists on two machines can select the same date within the same second. Only the transactional check prevents a real double-booking.

Cancelled bookings do **not** block. Completed bookings are in the past and do not block future dates.

## 5.5 Dues Detection

No cron needed. Compute on dashboard render:

```ts
export async function getDuesAlerts() {
  const today    = format(new Date(), 'yyyy-MM-dd');
  const in3Days  = format(addDays(new Date(), 3), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const open = and(
    inArray(bookings.status, ['confirmed', 'tentative']),
    gt(bookings.balanceDue, 0),
    isNull(bookings.deletedAt),
  );

  return {
    overdue:      await q(and(open, lt(bookings.dueDate, today))),
    dueSoon:      await q(and(open, gte(bookings.dueDate, today), lte(bookings.dueDate, in3Days))),
    eventTomorrow:await q(and(open, eq(bookings.eventDate, tomorrow))),
    expiringHolds:await q(and(
      eq(bookings.status, 'tentative'),
      lte(bookings.holdExpiresOn, in3Days),
      isNull(bookings.deletedAt),
    )),
  };
}
```

This is better than a cron job — it can never be stale, and there's no silent failure mode where the job stops firing and nobody notices.

## 5.6 Permission Gate

Every Server Action and protected page calls this first. There is no other layer of protection.

```ts
// /lib/auth/require-role.ts
type Role = 'admin' | 'manager' | 'staff';

export async function requireRole(...allowed: Role[]) {
  const { session, user } = await validateRequest();
  if (!session) redirect('/login');
  if (!user.active) { await invalidateSession(session.id); redirect('/login'); }
  if (!allowed.includes(user.role as Role)) {
    throw new Error('FORBIDDEN');
  }
  return user;
}
```

Usage:
```ts
export async function deleteBooking(id: string) {
  const user = await requireRole('admin');
  // ...
}

export async function recordPayment(input: PaymentInput) {
  const user = await requireRole('admin', 'manager');
  // ...
}
```

## 5.7 Audit Logging

```ts
export async function audit(tx, params: {
  userId: string;
  action: string;
  module: string;
  recordId?: string;
  summary: string;
  changes?: Record<string, [unknown, unknown]>;
}) {
  await tx.insert(auditLog).values({
    id: nanoid(),
    ...params,
    changes: params.changes ? JSON.stringify(params.changes) : null,
    createdAt: Math.floor(Date.now() / 1000),
  });
}
```

For updates, diff old and new before writing:

```ts
export function diff<T extends object>(before: T, after: T) {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(after) as (keyof T)[]) {
    if (before[k] !== after[k]) changes[k as string] = [before[k], after[k]];
  }
  return changes;
}
```

Audit writes go in the **same transaction** as the mutation. If the mutation rolls back, the audit row must too.

---

# 6. AUTHENTICATION

## 6.1 Login — End to End

**Route:** `/login`

> **Initial admin credentials (development / first boot only)**
> Username: `Hamza-admin!23`
> Password: `admin@1!2`
>
> These are temporary seed credentials for getting into the system the first time. **They must be changed on first login**, and the account's `password_hash` must be regenerated with Argon2id — never store or ship the plaintext. Do not commit these to a public repository. In production, prefer the first-run setup wizard (§6.2), which lets the admin set their own credentials and writes nothing down. Force a password change by setting a `must_change_password` flag on this seed account and redirecting to the change-password screen until it's cleared.

**UI:** Centred card. Venue logo, username field, password field, "Remember username" checkbox (stores username only in localStorage, never the password), Login button.

**Flow:**

1. User submits the form → Server Action `login(username, password)`.

2. Look up the user by username. If not found, run a dummy Argon2 verify against a constant hash anyway, then return the generic error. This prevents timing attacks that reveal which usernames exist.

3. If `locked_until > now`, return: *"Account locked. Try again in N minutes."*

4. If `active = 0`, return: *"Account disabled. Contact your administrator."*

5. Verify the password with Argon2id.

   **On failure:** increment `failed_attempts`. If it reaches 5, set `locked_until = now + 15 minutes` and reset the counter. Write an audit row with action `login_fail`. Return the generic error: *"Invalid username or password."* — never reveal which field was wrong.

   **On success:** reset `failed_attempts` to 0, clear `locked_until`, set `last_login`, create a Lucia session, set the session cookie, write an audit row, redirect to `/dashboard`.

6. Rate limiting is handled upstream by Cloudflare (5 requests per 10 minutes per IP on this path). The application-level lockout is the second layer.

**Session config:** 30-day cookie expiry, `httpOnly`, `secure`, `sameSite: 'lax'`. Idle timeout of 30 minutes (configurable) enforced client-side — a timer resets on any interaction, and on expiry it calls a logout action and redirects.

## 6.2 First-Run Setup Wizard

**Trigger:** `SELECT COUNT(*) FROM users` returns 0. Middleware redirects everything to `/setup`. Cannot be skipped or navigated away from.

**Steps:**
1. **Admin account** — full name, username, password, confirm password
2. **Venue details** — name, address, phone, email, NTN, logo upload
3. **Financial defaults** — tax rate, tax label, invoice prefix, starting invoice number
4. **Operations** — hall/section list with capacities, and the two slot labels (Day, Night) with default timings
5. **Recovery key** — a 32-character key is generated and displayed **once**, with a "I have saved this" confirmation checkbox. Its Argon2 hash is stored in settings. This is the only way to reset a lost sole-admin password.

On completion: seed services and menu items, write the settings, create the admin, log them in.

## 6.3 Password Reset

Three paths, in order of preference:

- **Admin resets another user (primary):** Users → Edit → set a new password, or click "Send reset link". Setting a password directly invalidates the user's sessions immediately and sets `must_change_password = 1` so they choose their own on next login. This is the recommended path for a small venue where the admin is reachable.
- **Self-service "Forgot password?" (optional, email-based):** a link on the login screen that emails a single-use reset link via Resend. Full flow in §6.5. Enable this only if you have users the admin cannot quickly reach; otherwise leave it off to reduce attack surface.
- **Sole admin locked out:** `/recover` accepts the recovery key generated at setup. On match, it allows setting a new admin password and generates a fresh recovery key. Every use is audited. This is the fallback when no other admin exists to reset the account and works without email.

## 6.4 Logout

Top-right user menu. If a form has unsaved changes, confirm first. Invalidates the session in Turso, clears the cookie, redirects to `/login`.

## 6.5 Email — Resend Integration

Transactional email is sent through **Resend** (free tier: 3,000 emails/month, 100/day — far beyond what staff resets and security notices require). It fits the stack cleanly from a Vercel Server Action and templates with React Email.

### Setup

1. Create a Resend account and add your sending domain (e.g. `mail.yourvenue.com`).
2. Resend shows the DNS records to add. In the **same Cloudflare DNS panel** you already use, add the SPF, DKIM, and DMARC records. Without these, mail lands in spam or is rejected outright — this is the step that determines whether reset emails actually arrive.
3. Verify the domain in Resend (usually minutes after the DNS propagates).
4. Create an API key.

### Environment

```env
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM="Al-Noor Marquee <no-reply@mail.yourvenue.com>"
APP_URL=https://yourvenue.com          # used to build reset links
```

### Client

```ts
// /lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, react: React.ReactElement) {
  if (!to) return;                       // users without an email simply get no mail
  try {
    await resend.emails.send({ from: process.env.EMAIL_FROM!, to, subject, react });
  } catch (err) {
    // Email is never allowed to block the security action that triggered it.
    // A password still changes even if the notice fails to send.
    console.error('Email send failed', err);
  }
}
```

**Rule:** email is a side effect, never a gate. A password change, reset, or lockout must complete and be audited even if Resend is down — exactly as Google Calendar sync is treated for bookings. Wrap every send in try/catch and never throw from it.

### Emails the system sends

| Trigger | Recipient | Purpose |
|---|---|---|
| Password changed (by self or admin) | The affected user | Security notice: *"Your password was changed on 27-Jul at 3:14pm. If this wasn't you, contact your administrator immediately."* |
| Admin sends a reset link | The affected user | Single-use link to set a new password (§6.6) |
| Self-service reset requested | The requesting user | Same single-use link |
| Account locked (5 failed attempts) | The affected user | *"Your account was locked after multiple failed sign-in attempts."* |
| New user created | The new user | Welcome with username and a first-login reset link (never the password in plaintext) |

The password-changed security notice is the highest-value one and should be sent even if you never enable self-service reset. It is how a user discovers an account takeover.

## 6.6 Self-Service Reset Flow (optional)

Enable only if needed. Every user account must have an `email` for this to function.

**Request — `/forgot-password`**

1. User enters their username or email.
2. **Always show the same confirmation** regardless of whether the account exists: *"If an account matches, a reset link has been sent."* Revealing whether a username exists is an enumeration vulnerability.
3. If it does exist and is active:
   - Generate a cryptographically random token (`crypto.randomBytes(32).toString('hex')`).
   - Store only its **SHA-256 hash** in `password_reset_tokens` with `expires_at = now + 30 min`. The raw token lives only in the emailed link — a database leak must not yield usable tokens.
   - Invalidate any prior unused tokens for that user.
   - Email the link: `${APP_URL}/reset-password?token=<raw>`.
4. Rate-limit this endpoint at Cloudflare (reuse the login rule pattern) so it can't be used to spray reset emails.

**Redeem — `/reset-password?token=...`**

```ts
export async function resetPassword(rawToken: string, newPassword: string) {
  const tokenHash = sha256(rawToken);
  const row = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, tokenHash),
  });

  if (!row || row.usedAt || row.expiresAt < nowSec()) {
    return { error: 'This reset link is invalid or has expired.' };
  }

  const pw = passwordSchema.parse(newPassword);   // min 8, ≥1 number

  await db.transaction(async (tx) => {
    await tx.update(users)
      .set({ passwordHash: await argon2.hash(pw), mustChangePassword: 0 })
      .where(eq(users.id, row.userId));
    await tx.update(passwordResetTokens)
      .set({ usedAt: nowSec() })                  // single-use
      .where(eq(passwordResetTokens.id, row.id));
    await tx.delete(sessions).where(eq(sessions.userId, row.userId)); // log out everywhere
    await audit(tx, { userId: row.userId, action: 'update', module: 'auth',
      recordId: row.userId, summary: 'Password reset via emailed link' });
  });

  // Side effect after commit — never blocks
  const u = await getUser(row.userId);
  await sendEmail(u.email, 'Your password was changed', PasswordChangedEmail({ when: new Date() }));

  return { success: true };
}
```

Security properties: tokens are single-use, expire in 30 minutes, are stored hashed, and redeeming one logs the user out of all existing sessions. The `must_change_password` flag from the seed-credential note (§6.1) is cleared here and by the admin-set-password path, and the login flow redirects any user with that flag set to the change-password screen before allowing access.

---

# 7. NAVIGATION & DASHBOARD

## 7.1 Slot Model

The venue schedules **exactly two slots per date per hall: Day and Night.** A single date+hall therefore holds at most two bookings. Every piece of availability, calendar, and occupancy logic in this document assumes this two-slot model. The slot labels and their default times are editable in settings, but the count is fixed at two.

## 7.2 Sidebar Navigation

The system is management-only — there is no public-facing side. It uses a persistent left sidebar. Every section is a top-level nav item. The sidebar renders only the items the current role may reach (see the permission matrix, §14.2), so Staff simply don't see Reports, Expenses, Taxes, or Admin Settings.

| Nav item | Route | Purpose |
|---|---|---|
| **Dashboard** | `/dashboard` | Landing page — at-a-glance overview (§7.4) |
| **Schedule** | `/schedule` | Wide interactive calendar with bookings under each date (§7.5) |
| **Bookings** | `/bookings` | Create, list, view, edit, cancel bookings |
| **Invoices** | `/invoices` | Every issued invoice as a searchable list (§9.10) |
| **Quotations** | `/quotations` | Priced offers with expiry, convert to booking (§9.11) |
| **Clients** | `/clients` | Client directory, history, lifetime value |
| **Services** | `/services` | Services and per-head catering with menu |
| **Expenses** | `/expenses` | Record and categorise expenses |
| **Taxes** | `/taxes` | Manage the venue's taxes and rates (§12) |
| **Reports** | `/reports` | Revenue, tax, receivables, profit, occupancy |
| **Inquiries** | `/inquiries` | Staff-entered enquiry pipeline |
| **Admin Settings** | `/settings` | Users, system settings, audit log, recycle bin, integrations, backup |

The sidebar shows a badge on **Inquiries** for the count of `status = 'new'`. A **notification bell** in the header (§9.12) aggregates dues, expiring holds, new inquiries, installments coming due, expiring quotations, and failed calendar syncs, with per-user read state.

A global header sits above the content area: venue logo, the global search trigger (Ctrl/Cmd+K, §9.9), the notification bell, and the user menu (account, logout).

## 7.3 Dashboard Data Loading

The dashboard is a Server Component. It fires its queries in parallel:

```ts
const [alerts, kpis, latestBookings, dueThisWeek, activity] =
  await Promise.all([
    getDuesAlerts(),
    getKpis(period),
    getLatestBookings(5),
    getBalancesDueThisWeek(),
    getRecentActivity(8),
  ]);
```

Each block is wrapped in `<Suspense>` with a skeleton so the page streams rather than blocking on the slowest query. Note the heavy calendar query is **gone from the dashboard** — the full calendar now lives on its own Schedule page, keeping the landing page light and fast.

## 7.4 Dashboard Main Page

Laid out top to bottom:

**1. Alert Bar** — coloured pills across the top, each linking to a filtered view. This is the highest-value element: it tells staff what needs doing today.

| Colour | Condition | Example text | Links to |
|---|---|---|---|
| 🔴 Red | `due_date < today AND balance > 0` | 3 bookings overdue — Rs 245,000 outstanding | `/reports/receivables?filter=overdue` |
| 🟡 Amber | `due_date` within 3 days | 2 payments due this week | `/bookings?payment=due_soon` |
| 🔵 Blue | Event tomorrow with balance | Event tomorrow: Ahmed Walima — Rs 80,000 pending | `/bookings/[id]` |
| 🟠 Orange | Tentative hold expiring ≤3 days | 1 hold expires in 2 days | `/bookings?status=tentative` |
| ⚪ Grey | `inquiries.status = 'new'` | 4 new inquiries | `/inquiries?status=new` |

Individually dismissible; dismissal is per-session (sessionStorage), so they return the next day.

**2. KPI Cards** — four cards for the selected period, each with a value and percentage change vs the previous equivalent period.

| Card | Query |
|---|---|
| Bookings | `COUNT(*) WHERE created_at IN period AND status != 'cancelled'` |
| Cash Collected | `SUM(payments.amount) WHERE paid_on IN period` |
| Outstanding | `SUM(balance_due) WHERE status IN ('confirmed','tentative')` — all time, not period-limited |
| Expenses | `SUM(expenses.amount) WHERE expense_date IN period` |

**Period selector** (top right of this row): This Month / Last Month / This Quarter / This Year / Custom. Stored in a URL search param so the view is shareable and survives refresh.

**3. Latest 5 Bookings** — the primary table on the page, showing the five most recently created bookings:

| Invoice | Client | Event Date | Slot | Total | Status |
|---|---|---|---|---|---|

Each row links to the booking detail. A "View all →" link sits in the card header, going to Bookings Management. This is the "what just happened" pulse of the business.

**4. Due This Week** — a compact list of bookings with a balance due in the next 7 days: client, phone, event date, balance, due date. This is the money-collection worklist, and it exists because uncollected balances are one of the two failures the whole system is built to prevent. Rows are tinted amber; overdue ones red.

**5. Recent Activity** — last 8 audit rows rendered as sentences: *"Ali created booking INV-2026-0142"*, *"Sara recorded payment Rs 50,000 on INV-2026-0138"*.

Charts (revenue trend, event-type mix, collected-vs-expenses) have moved to the **Reports** section, where the owner reviews them deliberately, rather than loading them on every dashboard visit.

## 7.5 Schedule Page

**Route:** `/schedule` · **Access:** all roles

A full-width, wide-spanning interactive calendar — the operational heart of daily use. This is the booking calendar previously described under §9.7, now promoted to its own top-level nav section.

Each date cell shows the date number and its two slot strips, with any booking listed **under the date reflecting client name and slot**:

```
┌────────────────────────┐
│ 14                     │
│ ☀ Day    Ahmed (350)   │  red — booked
│ 🌙 Night  — vacant —    │  green — free
└────────────────────────┘
```

Colour coding per strip: green vacant · red confirmed · amber tentative · blue completed · grey past.

**Interactions:**
- Click a booked strip → booking detail
- Click a vacant strip → new-booking wizard, pre-filled with that date, slot, and hall
- Hover a booked strip → tooltip (client, guests, phone, balance)
- Drag a booking to another date → confirmation → re-runs availability, updates, patches the calendar event

**Views** (tabs): Month (default), Week, List, Year. **Hall filter** when multiple halls exist. **Print** renders the month grid cleanly for the office wall.

Full query and interaction detail is in §9.7 — that section is the implementation reference; this nav entry is its home.

## 7.6 Role Variations

**Staff** landing page shows: the alert bar (event-tomorrow and inquiry pills only — nothing about money), the Latest 5 Bookings table (without the Total column), and the Schedule. No KPI cards, no Due This Week list, no activity feed. Their sidebar shows only Dashboard, Schedule, Bookings Management, Client Management, and Inquiries (view only).

---

# 8. SERVICE MANAGEMENT

**Routes:** `/services`, `/services/new`, `/services/[id]`, `/services/[id]/edit`
**Access:** Admin and Manager for writes; Staff read-only

## 8.1 Add New Service

**Form fields:** Name*, Category*, Description, Pricing Type*, Rate*, Taxable (default on), Active (default on).

**Conditional panel:** when Category = `catering`, a Menu Items builder appears. Rows of (Item Name, Type dropdown, optional per-head price), reorderable, with an "Add item" button. This is the service's default dish list; it copies onto any booking that uses the service, where staff adjust it per event.

**Validation (Zod):**
```ts
const serviceSchema = z.object({
  name: z.string().min(2).max(100),
  category: z.enum([...CATEGORIES]),
  pricingType: z.enum(['fixed','per_head','per_hour','per_unit']),
  rate: z.number().int().positive(),
  taxable: z.boolean(),
  menuItems: z.array(menuItemSchema).optional(),
});
```

Uniqueness on `(name, category)` is enforced by the DB constraint; catch the error and surface it on the name field.

**Server Action:**
```ts
export async function createService(input: ServiceInput) {
  const user = await requireRole('admin', 'manager');
  const data = serviceSchema.parse(input);

  return db.transaction(async (tx) => {
    const id = nanoid();
    await tx.insert(services).values({ id, ...data, createdAt: now() });
    if (data.menuItems?.length) {
      await tx.insert(menuItems).values(
        data.menuItems.map((m, i) => ({ id: nanoid(), serviceId: id, ...m, sortOrder: i }))
      );
    }
    await audit(tx, { userId: user.id, action: 'create', module: 'service',
                      recordId: id, summary: `Created service "${data.name}"` });
    revalidatePath('/services');
    return { id };
  });
}
```

## 8.2 List Services

TanStack Table: Name, Category, Pricing Type, Rate, Public, Status, Actions.

Controls: search (name), category filter, status filter, optional grouping by category. Sort on any column.

Inactive services remain in the database and on historical bookings, but are excluded from the new-booking service picker.

## 8.3 View Service Details

Read-only, plus **usage statistics** — a genuinely useful screen for pricing decisions:

```sql
SELECT COUNT(DISTINCT booking_id) AS times_booked,
       SUM(line_total)            AS total_revenue,
       MAX(b.event_date)          AS last_booked
FROM booking_services bs
JOIN bookings b ON b.id = bs.booking_id
WHERE bs.service_id = ? AND b.status != 'cancelled';
```

## 8.4 Update Service

Same form, pre-filled. A prominent notice states: *"Changing the rate does not affect existing bookings. They keep the price agreed at the time."* This is enforced by the `rate` snapshot in `booking_services`.

Editing a catering service's default menu likewise does not alter menus already saved onto bookings.

## 8.5 Delete Service

```ts
const usage = await db.select({ n: count() })
  .from(bookingServices).where(eq(bookingServices.serviceId, id));

if (usage[0].n > 0) {
  return {
    error: `This service appears in ${usage[0].n} bookings and cannot be deleted.`,
    suggestion: 'deactivate',
  };
}
```

Never used → soft delete after confirmation. Used → blocked, with a **Deactivate instead** button in the dialog. This protects the integrity of historical invoices.
---

# 9. BOOKINGS MODULE

The core of the system. Everything else supports this.

## 9.1 Add New Booking — Four-Step Wizard

**Route:** `/bookings/new` · **Access:** all roles

State lives in a single `react-hook-form` instance spanning all four steps. Steps are client-side; nothing is written until final submit (or an explicit Save as Draft). A **live summary panel** is fixed to the right edge across all steps, showing client, date, slot, guests, subtotal, tax, grand total, advance, and balance as they change.

---

### STEP 1 — Client & Event

**Client block**

Phone is the first field, deliberately. On blur (or after 3 digits, debounced), it queries existing bookings:

```ts
const previous = await db.select({
    clientName: bookings.clientName,
    cnic: bookings.cnic,
    address: bookings.address,
    count: count(),
  })
  .from(bookings)
  .where(and(eq(bookings.phone, phone), isNull(bookings.deletedAt)))
  .groupBy(bookings.clientName, bookings.cnic, bookings.address);
```

A match shows a yellow banner: *"Existing client: Muhammad Ahmed — 3 previous bookings. [Autofill]"*. One click fills name, CNIC, and address. A link opens the client history view.

Fields: Phone*, Client Name*, Alternate Phone, CNIC, Address.

**Event block**

Fields: Event Type*, Event Date*, Event Slot*, Hall Section*, Guest Count*, Start Time, End Time, Status* (Confirmed / Tentative).

Selecting **Tentative** reveals **Hold Expiry Date**, defaulting to today + `hold_default_days`.

**Live availability check.** Fires whenever date, slot, or hall changes (debounced 300ms):

```
✓ Available — Main Hall, Night, 22-Aug-2026
```
```
✗ Occupied — INV-2026-0098 · Khan Wedding · Confirmed  [View]
```

On a red result, **Next is disabled**. Admins get an **Override** button which requires a typed reason, logs it to audit, and permits continuing — for genuine cases like a hall subdivision the system doesn't model.

The date picker greys out dates where the currently-selected hall+slot combination is already taken, so the conflict is usually visible before it's selected.

---

### STEP 2 — Services

**Service picker.** A multi-select combobox grouped by category, listing only `active = 1` services. Each selection appends a row:

| Service | Type | Qty | Rate | Line Total | |
|---|---|---|---|---|---|
| Catering (per head) | Per Head | 350 | 1,800 | 630,000 | ✏️ 🗑️ |
| Premium Sound System | Fixed | 1 | 45,000 | 45,000 | ✏️ 🗑️ |
| Complete Entry Setup | Fixed | 1 | 65,000 | 65,000 | ✏️ 🗑️ |

**Qty behaviour:** auto-fills from `guest_count` for `per_head` services, defaults to 1 otherwise. Always editable — clients routinely pay for 350 heads while expecting 380 guests.

**Rate behaviour:** pre-filled from the service, always editable. Negotiated pricing is the norm, not the exception. The edited value is what gets snapshotted.

**Menu selection.** Adding a catering service expands a checklist of that service's default dishes, grouped by type. The user ticks or unticks items and can add custom ones via a free-text input ("Mutton Karahi instead of Chicken"). The final list writes to `booking_menu` and prints on the function sheet and optionally the invoice. There are no fixed packages — the menu is assembled per booking.

---

### STEP 3 — Extras & Charges

**Extras table** — free-text line items for anything outside the service catalogue:

| Description | Qty | Rate | Total | |
|---|---|---|---|---|
| Fireworks display | 1 | 25,000 | 25,000 | 🗑️ |
| Extra 50 chairs | 50 | 150 | 7,500 | 🗑️ |
| Bridal room decor | 1 | 15,000 | 15,000 | 🗑️ |

Each row has a taxable toggle.

**Charges panel** — all values recomputed by `calculateTotals()` on every keystroke:

```
Subtotal                             865,000
Discount   [amount|%] [40,000]       (40,000)
  Reason*  [Repeat client        ]
Taxable Amount                       825,000
Taxes applied  [✓ Punjab Sales Tax 16%] [✓ Service Charge 5%] [+ add]
  Punjab Sales Tax 16%               132,000
  Service Charge 5%                   41,250
─────────────────────────────────────────────
GRAND TOTAL                          998,250
```

The **Taxes applied** control lists every `active = 1` tax; those flagged `is_default` are pre-ticked. Untick to exclude one for this booking. Each applies to the same taxable amount. Rates and amounts are snapshotted into `booking_taxes` on save.

Discount reason is **required** when discount > 0 — this feeds the discount-leakage report. Applying a discount requires Admin or Manager; Staff see the field disabled.

---

### STEP 4 — Payment & Notes

Fields: Advance Amount, Payment Method*, Payment Date, Reference/Cheque No, **Balance Due** (computed, read-only, large), **Due Date*** (defaults to event date − `due_date_offset_days`), Internal Notes, Client Notes, Special Instructions.

Due Date is what drives the reminder system for single-balance bookings. It is required whenever balance > 0 and no installment plan is defined.

**Payment plan (optional).** A toggle reveals an installment scheduler. Instead of one balance and one due date, the user defines steps:

| Label | Amount | Due Date | |
|---|---|---|---|
| Advance | 300,000 | 15-Jul-2026 | 🗑️ |
| 2nd instalment | 350,000 | 15-Aug-2026 | 🗑️ |
| Balance on event day | 348,250 | 20-Aug-2026 | 🗑️ |

Rules: the plan's amounts must sum to the grand total — a live indicator shows the remainder and blocks save until it reconciles. A "Split evenly into N" helper and a "% of total" entry mode speed this up. Each step writes an `installments` row. When a payment is later recorded, it can be tagged to a step, and the step's status (Paid / Partial / Pending / Overdue) is derived by comparing linked payments to the planned amount. The notification centre and dues logic then track each installment's due date independently, not just one balance date.

The three note fields have distinct destinations:
- **Internal Notes** — never printed anywhere
- **Client Notes** — printed on the invoice
- **Special Instructions** — printed on the function sheet ("bride entry via side gate", "music stops at 11pm")

---

### Save Transaction

```ts
export async function createBooking(input: BookingInput) {
  const user = await requireRole('admin', 'manager', 'staff');
  const data = bookingSchema.parse(input);

  const result = await db.transaction(async (tx) => {
    // 1. AUTHORITATIVE availability re-check — the live check in step 1
    //    is only advisory; another user may have booked it since.
    const { available, conflicts } = await checkAvailability(data, tx);
    if (!available && !data.overrideReason) {
      throw new ConflictError(conflicts);
    }

    // 2. Recompute totals server-side. Never trust client arithmetic.
    const totals = calculateTotals(data);

    // 3. Invoice number — same transaction, atomic counter
    const invoiceNo = await nextInvoiceNo(tx);

    // 4. Booking row
    const id = nanoid();
    await tx.insert(bookings).values({
      id, invoiceNo, ...data, ...totals,
      amountPaid: data.advanceAmount ?? 0,
      balanceDue: totals.grandTotal - (data.advanceAmount ?? 0),
      createdBy: user.id, createdAt: now(), updatedAt: now(),
    });

    // 5. Child rows
    await tx.insert(bookingServices).values(data.services.map(snapshot));
    if (data.extras.length) await tx.insert(bookingExtras).values(...);
    if (data.menu.length)   await tx.insert(bookingMenu).values(...);

    // 6. Advance payment as a real ledger row
    if (data.advanceAmount > 0) {
      await tx.insert(payments).values({
        id: nanoid(), bookingId: id,
        receiptNo: await nextReceiptNo(tx),
        amount: data.advanceAmount,
        method: data.paymentMethod,
        paidOn: data.paymentDate,
        recordedBy: user.id, createdAt: now(),
      });
    }

    // 7. Audit
    await audit(tx, { userId: user.id, action: 'create', module: 'booking',
      recordId: id, summary: `Created booking ${invoiceNo} for ${data.clientName}` });

    return { id, invoiceNo };
  });

  // 8. Side effect — AFTER commit, never blocking
  syncToGoogleCalendar(result.id).catch(() => queueSync(result.id, 'create'));

  revalidatePath('/bookings');
  revalidatePath('/schedule');
  return result;
}
```

**Success screen:** *"Booking INV-2026-0143 created"* with buttons — Print Invoice · Print Receipt · Print Function Sheet · View Booking · New Booking.

**Save as Draft** is available from any step. Drafts get `status = 'draft'`, **no invoice number**, no availability enforcement, and appear in a separate filtered view. They don't block dates and don't appear in reports.

---

## 9.2 List Bookings

**Route:** `/bookings`

Columns: Invoice No · Client · Phone · Event Date · Slot · Type · Hall · Guests · Grand Total · Paid · Balance · Status · Actions.

Status pills: 🟢 Confirmed · 🟡 Tentative · 🔵 Completed · 🔴 Cancelled · ⚪ Draft

**Filters** (all in URL search params, so views are shareable and bookmarkable):
- Date range — toggled between event date and booking date
- Status (multi)
- Event type, hall, slot
- Payment status: Paid in Full / Partial / Unpaid / Overdue
- Created by

**Search:** one box matching invoice number, client name, or phone.

**Row tinting:** red for overdue balance, amber for events within 7 days.

**Footer totals** recompute with the active filters:
> Showing 47 bookings · Total Rs 8,450,000 · Collected Rs 6,200,000 · Outstanding Rs 2,250,000

**Bulk actions:** export selection to CSV, print multiple invoices.

Pagination is server-side (`LIMIT`/`OFFSET`) with a default of 50 rows. Staff role does not see the Grand Total, Paid, or Balance columns.

---

## 9.3 View Booking Details

**Route:** `/bookings/[id]`

**Header** — invoice number, status pill, and action buttons: Edit · Record Payment · Print Invoice · Print Function Sheet · Cancel · Delete (admin only).

**Cards:**

| Card | Contents |
|---|---|
| Client | Name, phone, alt phone, CNIC, address, link to full client history |
| Event | Type, date, slot, hall, guests, timings, special instructions |
| Services | Line-item table with snapshot rates; catering rows expand to show the agreed menu |
| Extras | The extras table |
| Charges | Subtotal, discount + reason, taxable amount, tax rate, tax amount, grand total |
| Payments | Full ledger: date, receipt no, amount, method, reference, recorded by, print-receipt link. Footer: Total Paid / Balance Due / Due Date. Red banner if overdue: *"Overdue by 6 days"* |
| Notes | Internal notes, client notes |
| Activity | Audit history for this record, with field-level diffs |

**Record Payment modal** — Amount*, Method*, Date*, Reference, Notes.

```ts
export async function recordPayment(input: PaymentInput) {
  const user = await requireRole('admin', 'manager');
  return db.transaction(async (tx) => {
    const receiptNo = await nextReceiptNo(tx);
    await tx.insert(payments).values({ ...input, receiptNo, recordedBy: user.id });

    // Recompute denormalised fields IN THE SAME TRANSACTION
    const paid = await tx.get(sql`
      SELECT COALESCE(SUM(amount),0) AS total FROM payments
      WHERE booking_id = ${input.bookingId} AND deleted_at IS NULL`);

    await tx.update(bookings).set({
      amountPaid: paid.total,
      balanceDue: sql`grand_total - ${paid.total}`,
      updatedAt: now(),
    }).where(eq(bookings.id, input.bookingId));

    await audit(tx, { /* ... */ });
  });
}
```

Overpayment is warned about but permitted (a client may pre-pay for extras added later). A negative balance displays as **Credit**.

---

## 9.4 Update Booking

**Route:** `/bookings/[id]/edit`

Same fields as the wizard but rendered as one scrollable page with anchored sections rather than forced steps — editors usually want one field, not a four-step walk.

**Rules:**
- Changing date, slot, or hall re-runs the authoritative availability check
- The invoice number **never** changes
- If payments exist and the grand total is being reduced below `amount_paid`, warn explicitly
- Every changed field is diffed and written to `audit_log.changes`
- Editing a `completed` booking requires Admin
- `cancelled` bookings are read-only until reinstated
- On save, patch the Google Calendar event rather than creating a new one

---

## 9.5 Cancel Booking

A modal, not a deletion. Cancellation is a business event with financial consequences.

**Fields:** Cancellation Reason* (Client Cancelled / Date Changed / Payment Not Received / Venue Issue / Other + free text), Advance Handling* (Refund Full / Refund Partial + amount / Forfeit), Cancellation Date, Notes.

**Effects:**

```ts
await db.transaction(async (tx) => {
  await tx.update(bookings).set({
    status: 'cancelled',
    cancelledAt: now(),
    cancelReason: reason,
    advanceHandling: handling,
    refundAmount: refund,
  }).where(eq(bookings.id, id));

  // Refunds are negative payment rows — same SUM keeps working
  if (handling !== 'forfeit' && refund > 0) {
    await tx.insert(payments).values({
      id: nanoid(), bookingId: id,
      receiptNo: await nextReceiptNo(tx),
      amount: -refund,
      method: refundMethod,
      paidOn: today(),
      notes: 'Refund on cancellation',
      recordedBy: user.id,
    });
  }
  await audit(tx, { /* ... */ });
});
```

- The calendar slot is **released immediately** — cancelled bookings do not block availability
- A **forfeited advance is income** and must appear in revenue reports as such
- The Google Calendar event is patched to grey with a `CANCELLED —` prefix rather than deleted, so staff phones show the history
- Admins can **Reinstate** if the slot is still free — this re-runs the availability check

---

## 9.6 Delete Booking

Admin only. Confirmation requires typing the exact invoice number — this is deliberate friction against deleting a Rs 900,000 record by reflex.

Sets `deleted_at`. The record vanishes from every list, report, and calendar view but remains in the database, recoverable from the recycle bin for 30 days. **The invoice number is not returned to the counter.** Gaps in the sequence are expected and correct.

Permanent purge from the recycle bin requires a second confirmation, deletes the Google Calendar event, and is itself audited.

---

## 9.7 Booking Calendar (Schedule page)

**Route:** `/schedule` — this is the implementation reference for the Schedule nav section (§7.5).

### Month View (default)

CSS Grid, 7 columns. Each date cell contains the date number and its two slot strips, each showing the client name if booked:

```
┌────────────────────────┐
│ 14                     │
│ ☀ Day    Ahmed (350)   │  red — confirmed
│ 🌙 Night  Khan ⚠        │  amber — tentative
└────────────────────────┘
```

**Colours:** green vacant · red confirmed · amber tentative · blue completed · grey past date.

**Query** — one round trip for the whole month, not one per day:

```ts
const monthBookings = await db.select({
    id, invoiceNo, clientName, eventDate, eventSlot,
    hallSection, guestCount, status, balanceDue, phone,
  })
  .from(bookings)
  .where(and(
    gte(bookings.eventDate, monthStart),
    lte(bookings.eventDate, monthEnd),
    ne(bookings.status, 'cancelled'),
    isNull(bookings.deletedAt),
    hallFilter ? eq(bookings.hallSection, hallFilter) : undefined,
  ));

// Group into a Map<'YYYY-MM-DD', Booking[]> client-side
```

**Interactions:**
- Hover a booked strip → tooltip with client, guests, phone, balance
- Click a booked strip → `/bookings/[id]`
- Click a vacant strip → `/bookings/new?date=...&slot=...&hall=...` with the wizard pre-filled
- Drag a booking to another date → confirmation dialog → re-runs availability, updates, patches Google Calendar, audits the reschedule

**Hall filter:** tabs when multiple halls exist. An "All halls" mode stacks a row per hall inside each cell.

### Other Views

**Week** — columns are days, rows are slots, showing more per-booking detail.

**List** — chronological upcoming events, essentially a pre-filtered booking list.

**Year** — twelve mini-months, each date a coloured dot. Answers *"what's free next winter?"* in one glance and is the view most used when a client calls asking about availability.

**Print** — a `@media print` stylesheet renders the month grid cleanly for the office wall.

---

## 9.8 Printing — Invoice, Receipt, Function Sheet

**Approach:** dedicated routes rendering print-optimised HTML. The user presses the Print button, which calls `window.print()`. The browser's own dialog offers a physical printer or "Save as PDF". No server-side PDF generation, no library.

```css
@media print {
  @page { size: A4; margin: 15mm; }
  body { font-size: 11pt; color: #000; }
  .no-print { display: none !important; }
  .page-break { page-break-after: always; }
  thead { display: table-header-group; }   /* repeat headers across pages */
  tr { page-break-inside: avoid; }
}
```

`thead { display: table-header-group }` is the one non-obvious rule — without it, a services table spanning two pages loses its column headers on page two.

### Invoice — `/bookings/[id]/invoice`

```
        [LOGO]        AL-NOOR MARQUEE
              123 Ferozepur Road, Lahore
           Ph: 042-35xxxxxx | NTN: 1234567-8

INVOICE                          Invoice #: INV-2026-0143
                                 Date: 15-Jul-2026

BILL TO                          EVENT DETAILS
Muhammad Ahmed                   Type: Walima
0300-1234567                     Date: 22-Aug-2026
CNIC: 35202-xxxxxxx-x            Slot: Night (7:00 PM – 12:00 AM)
                                 Hall: Main Hall
                                 Guests: 350
──────────────────────────────────────────────────────
DESCRIPTION              QTY    RATE      AMOUNT
──────────────────────────────────────────────────────
Catering (per head)      350    1,800     630,000
Premium Sound System       1   45,000      45,000
Complete Entry Setup       1   65,000      65,000
Stage & Flower Decor       1   85,000      85,000
──────────────────────────────────────────────────────
EXTRAS
Fireworks Display          1   25,000      25,000
Bridal Room Decor          1   15,000      15,000
──────────────────────────────────────────────────────
                          Subtotal:       865,000
                  Discount (Repeat):      (40,000)
                    Taxable Amount:       825,000
               Punjab Sales Tax 16%:      132,000
                 Service Charge 5%:        41,250
                       GRAND TOTAL:       998,250
──────────────────────────────────────────────────────
PAYMENTS
15-Jul-2026  RCP-2026-0088  Advance (Cash)    (300,000)
02-Aug-2026  RCP-2026-0104  Part Pmt (Bank)   (200,000)
──────────────────────────────────────────────────────
                       BALANCE DUE:       498,250
                     Due By: 20-Aug-2026
──────────────────────────────────────────────────────

MENU: Chicken Boti, Seekh Kebab, Chicken Karahi, Mutton
Qorma, Chicken Biryani, Kabuli Pulao, Naan, Roghni Naan,
Raita, Salad, Gulab Jamun, Ras Malai, Soft Drinks,
Mineral Water, Kashmiri Chai

TERMS & CONDITIONS
[settings.terms_text]

_______________              _______________
Client Signature             Authorized Signature
```

Query param `?copy=office|client` adds a watermark. Menu inclusion is toggled by a setting.

### Receipt — `/bookings/[id]/receipt/[paymentId]`

Half-page. Receipt number, date, client name, invoice reference, **amount in figures and in words** (Pakistani convention — implement a `numberToWords` helper handling lakh and crore), method, reference number, balance remaining after this payment, received-by name and signature line.

### Function Sheet — `/bookings/[id]/function-sheet`

**No prices anywhere.** This is the operations document the floor manager carries.

Contents: event date and timings, client name and contact, guest count, hall and section, full menu list grouped by course, services with setup notes, special instructions in a prominent box, staff assignments, emergency contact numbers.

### Quotation — `/quotations/[id]/print`

Identical layout to the invoice, headed **QUOTATION**, marked *"Valid until [date]"*, with no invoice number and no payments section. The full Quotations section is §9.11.

---

## 9.9 Search & Lookup

### Global Search

**Trigger:** `Ctrl/Cmd + K` from anywhere.

Overlay with a single input. Debounced 200ms, results grouped by type:

```
Invoices (2)
  INV-2026-0143 · Muhammad Ahmed · 22-Aug-2026 · Rs 998,250 · Partial
  INV-2025-0087 · Muhammad Ahmed · 14-Dec-2025 · Paid
Bookings (1)
  INV-2026-0143 · Walima · Main Hall · Night
Quotations (1)
  QTN-2026-0034 · Ahmed Raza · valid to 10-Aug
Clients (1)
  Muhammad Ahmed · 0300-1234567 · 3 bookings
Inquiries (1)
  Ahmed Raza · 0321-9876543 · received 12-Jul
```

Searches `invoice_no`, `quote_no`, `client_name`, `phone`, `cnic` across bookings, invoices, quotations, clients, and inquiries. Arrow keys navigate, Enter opens, Escape closes. This exists because phone calls arrive mid-task and the answer is needed in three seconds.

### Per-Section Lookup

Every list view carries its own filter/search bar scoped to that section. All filters live in URL search params, so any filtered view is shareable and survives refresh.

| Section | Search fields | Filters |
|---|---|---|
| **Invoices** | invoice no, client, phone | date range, payment status (paid/partial/unpaid/overdue), amount range |
| **Bookings** | invoice no, client, phone, CNIC | event-date range, status, event type, hall, slot, created-by, payment status |
| **Quotations** | quote no, client, phone | status (draft/sent/accepted/expired/declined/converted), validity range |
| **Clients** | name, phone, CNIC | outstanding-balance-only, repeat-clients-only |
| **Services** | name | category, active/inactive |
| **Expenses** | description, vendor | category, date range, linked/unlinked booking, amount range |
| **Taxes** | name | type, active/inactive |
| **Inquiries** | name, phone | status, preferred-date range |
| **Schedule** | jump-to-date | hall, status |
| **Reports** | — | period + entity filters per report (§13) |

An **Advanced Search** page offers combined cross-entity filters (date range, amount range, status, event type, hall, payment status, created-by) with CSV export.

---

## 9.10 Invoices

**Route:** `/invoices` · **Access:** Admin, Manager

Every confirmed booking issues an invoice number, and this section is the dedicated lens over all of them — the "find me an invoice" workflow, distinct from "manage a booking." It reads from the same `bookings` data; there is no separate invoice table.

**List columns:** Invoice No · Date Issued · Client · Event Date · Grand Total · Paid · Balance · Payment Status.

**Payment status** is derived: Paid in Full · Partial · Unpaid · Overdue (balance > 0 and past due date / earliest overdue installment). Overdue rows tinted red, partial amber.

**Search & filters:** as in the lookup table above — invoice number, client, phone, date range, payment status, amount range.

**Row actions:** View invoice (print layout), Print / Save PDF, Record Payment, open the parent booking.

**Footer totals** track the active filter: total invoiced, total collected, total outstanding.

Drafts and cancelled bookings do not appear here (no invoice number / excluded). This section is read-and-collect oriented; structural edits happen in Bookings.

---

## 9.11 Quotations

**Route:** `/quotations` · **Access:** Admin, Manager · Staff may view

A quotation is a priced offer that hasn't become a booking. It follows the **same builder as a new booking** (client, services with per-head catering and menu, extras, discount, taxes) but issues no invoice number, reserves no slot, and carries a **validity/expiry date** instead of an event commitment.

**New Quotation — `/quotations/new`**

The booking wizard's Steps 1–3 reused, with differences:
- Event date/slot/hall are captured as **preferences** (`event_date_pref`), clearly labelled non-binding. No availability check runs and no slot is held — a quote does not block the calendar.
- No payment or installment step. Instead: **Valid Until** date, defaulting to today + `quote_validity_days` (14).
- Quote number generated on save: `QTN-2026-0034`, from its own counter.

**List columns:** Quote No · Client · Event Pref · Guests · Grand Total · Valid Until · Status.

**Status lifecycle:** draft → sent → accepted / declined / expired → converted. Quotes past `valid_until` are shown as **expired** (computed) and surface in the notification centre a few days before expiry.

**Convert to Booking** — one click opens the booking wizard pre-filled with every line item, discount, and tax from the quote. At this point the real availability check runs (the preferred date may have gone), an invoice number is issued, and the quote's status becomes `converted` with `converted_booking_id` set. No re-entry.

**Print — `/quotations/[id]/print`** — invoice-style layout headed QUOTATION, marked "Valid until [date]", no invoice number, no payments.

---

## 9.12 Activity & Notification Centre

**Surface:** a bell icon in the global header, with an unread count badge, opening a dropdown panel. A full `/notifications` page lists history.

**What generates a notification** (rows in `notifications`, deep-linked):

| Type | Trigger |
|---|---|
| `overdue` | A booking balance or installment is past its due date |
| `due_soon` | Balance or installment due within 3 days |
| `installment_due` | A specific plan step reaches its due date |
| `event_tomorrow` | An event is tomorrow with a balance outstanding |
| `hold_expiring` | A tentative hold expires within 3 days |
| `quote_expiring` | A quotation's `valid_until` is within 3 days |
| `new_inquiry` | A staff-entered inquiry is created |
| `sync_failed` | A Google Calendar sync landed in the retry queue |

**Generation model.** Like dues detection (§5.5), the time-based notifications are computed rather than cron-pushed: on dashboard load and on notification-panel open, a query builds the current set and upserts rows that don't already exist for today (deduplicated by type + entity + date). Event-based ones (new inquiry, sync failure) are written inline when they happen. This keeps the panel accurate with no scheduled job that can silently die.

**Read state** is per user via `notification_reads` — one user dismissing an alert doesn't clear it for everyone. The panel shows unread first, with "mark all read." Severity (info/warning/critical) drives colour and sort.

Each item links straight to the record that needs attention: an overdue notification opens that invoice, an expiring quote opens the quotation, a sync failure opens Settings → Integrations.

# 10. EXPENSE MANAGEMENT

**Routes:** `/expenses`, `/expenses/new`, `/expenses/[id]/edit`
**Access:** Admin and Manager. Staff have no access.

## 10.1 Add Expense

**Fields:** Date*, Category*, Description*, Amount*, Vendor / Paid To, Payment Method, Reference / Bill No, **Link to Booking** (searchable dropdown, optional), Receipt scan upload, Recurring monthly (checkbox), Paid By (auto = current user).

The **Link to Booking** field is what makes profit-per-event possible. Without it you only ever see gross revenue. Train staff to use it for anything event-specific — raw food, extra decor, hired staff for a particular night. Leave it blank for rent, salaries, and utilities.

**Recurring expenses:** when checked, a draft entry is generated on the 1st of each subsequent month, appearing in a "Pending confirmation" filter. Staff confirm and adjust the amount rather than re-entering rent every month.

**Receipt uploads:** store in Vercel Blob or a Cloudflare R2 bucket; save the path in `receipt_path`. Keep the bucket private and serve via signed URLs — these are financial documents.

## 10.2 List Expenses

Columns: Date · Category · Description · Vendor · Amount · Linked Booking · Paid By · Actions.

Filters: date range, category, vendor, linked/unlinked, paid-by. Footer total updates with the active filters. CSV export.

## 10.3 Update / Delete

Update uses the same form; changes are diffed into the audit log. Editing an expense dated before the current month raises a warning about affecting already-filed reports.

Delete is soft, Admin and Manager only, with confirmation.

## 10.4 Expense Reports

- **By Category** — pie chart plus table for the selected period
- **By Month** — 12-month trend line
- **By Vendor** — total spend per supplier, sorted descending. Useful leverage at renegotiation time
- **Event-linked vs Overhead** — splits variable from fixed costs

---

# 11. INQUIRIES MANAGEMENT

**Routes:** `/inquiries`, `/inquiries/new`, `/inquiries/[id]`
**Access:** all roles (Staff can enter, read, and note; only Manager+ can convert)

Inquiries are **staff-entered** — reception logs a walk-in or phone enquiry as it comes in. There is no public form (the system has no public side). The value is the pipeline: capture a lead, check availability, follow up, and convert to a quotation or booking without losing track.

## 11.1 Add Inquiry — `/inquiries/new`

A short form: Name*, Phone*, Email, Event Type, Preferred Date, Preferred Slot, Estimated Guests, Message/Notes*. Saved with `status = 'new'`. This is what a receptionist fills while on the call.

## 11.2 List

Columns: Received · Name · Phone · Preferred Date · Est. Guests · Status · Actions.

Unread rows render bold with a dot marker. The sidebar nav item carries a badge count of `status = 'new'`.

Filters: status, date range, event type. Search: name, phone.

## 11.3 View Inquiry

Opening the record sets `status = 'read'` if it was `new`.

The panel shows the message, contact details, preferred date and slot, guest estimate, and received timestamp.

**Availability check.** If a preferred date and slot were given, the panel immediately shows whether it's free:

> 22-Aug-2026, Night — **Available**

or

> 22-Aug-2026, Night — **Occupied** (INV-2026-0098)

This is the first thing anyone wants to know when returning the call.

**Actions:**

| Action | Effect |
|---|---|
| **Convert to Booking** | Opens `/bookings/new` pre-filled with name, phone, event type, date, guest estimate. On successful save, sets inquiry `status = 'converted'` and stores `converted_booking_id` |
| **Convert to Quotation** | Same, but produces a quotation (§9.11) instead |
| **Mark Contacted** | Sets status, records a follow-up date, prompts for a note |
| **Add Note** | Appends to `inquiry_notes` — the conversation log |
| **Close** | Requires a reason: Not Interested / Date Unavailable / Price / No Response |

## 11.4 Delete

Soft delete with confirmation, into the recycle bin.

---

# 12. TAXES

**Route:** `/taxes` · **Access:** Admin only (Manager can view)

The venue's tax catalogue. Everything tax-related is managed here — not in Settings. Taxes defined here are offered on every new booking and quotation, with `is_default` ones pre-applied.

## 12.1 List

A single-page table — the catalogue is small:

| Name | Type | Rate | Default | Status | Actions |
|---|---|---|---|---|---|
| Punjab Sales Tax | sales_tax | 16.00% | ✓ | Active | ✏️ 🗑️ |
| Service Charge | service_charge | 5.00% | ✓ | Active | ✏️ 🗑️ |

Search by name; filter by type and active/inactive.

## 12.2 Add / Update Tax

Modal form: Name*, Type* (Sales Tax / Service Charge / Other), Rate* (%), Applied by default (toggle), Active (toggle).

Rate is stored in basis points (16.00% → 1600). Validation: rate > 0 and ≤ 100%; name unique among active taxes.

**Critical rule:** editing a rate affects **future bookings only**. Every booking snapshots its applied taxes into `booking_taxes` (name, rate, computed amount) at save time. Changing Punjab Sales Tax from 16% to 15% must never alter an issued invoice — the tax report has to match what was actually printed and filed. A notice on the edit form states this.

## 12.3 Delete / Deactivate Tax

Same pattern as services (§8.5): a tax referenced by any `booking_taxes` row cannot be hard-deleted — the dialog offers **Deactivate** instead, which removes it from new bookings while preserving history. A never-used tax soft-deletes to the recycle bin.

## 12.4 How Taxes Apply

- New booking/quotation → all `active = 1, is_default = 1` taxes pre-ticked in the charges panel; staff may untick per booking
- Each tax computes on the same taxable amount (additive, not compounding) — see `calculateTotals()` (§5.2)
- Per-line `taxable` flags on services and extras decide what enters the taxable amount at all
- The Monthly Tax Report (§13.2) groups by tax name, so a venue charging both sales tax and service charge files each correctly

---

# 13. REPORTS

All reports share a common shell: a period selector (month / quarter / year / custom), filters specific to the report, a summary strip, a detail table, and export buttons (CSV, Print).

Reports **always exclude** `deleted_at IS NOT NULL`. Cancelled bookings are excluded from revenue but appear in a dedicated cancellation report.

**Reports landing — `/reports`.** The section index doubles as the analytics overview. The three charts that previously sat on the dashboard live here, since they're for deliberate review rather than every-visit glancing: a bar chart of revenue by month (trailing 12), a donut of bookings by event type, and a line of collected vs expenses. Below the charts, cards link into each detailed report.

## 13.1 Monthly Booking Revenue — `/reports/revenue`

**Access:** Admin, Manager

**Filters:** period, event type, hall, status.

**Summary strip:** Total Bookings · Gross Revenue · Discounts Given · Net Revenue · Collected · Outstanding · Average Booking Value.

**Detail table:** Invoice No · Booking Date · Event Date · Client · Event Type · Guests · Gross · Discount · Tax · Total · Paid · Balance — with column totals in the footer.

**Breakdowns:** revenue by event type, by hall, by slot (day vs night). A month-on-month bar chart with percentage change.

**Recognition note:** this report is *booking-based* (revenue attributed to when the event is booked). A separate toggle switches to *event-based* (attributed to the event month), which is what an accountant will usually want. Implement both; label them clearly.

## 13.2 Monthly Tax Report — `/reports/tax`

**Access:** Admin only

Built specifically for FBR sales tax filing.

**Header:** venue name, NTN, period covered.

**Summary:** Total Taxable Value · Total Tax Collected · Number of Taxable Invoices · Exempt / zero-rated amount.

**Detail table** — one row per invoice, matching what a sales tax return requires:

| Invoice No | Date | Client Name | CNIC/NTN | Taxable Value | Rate | Tax Amount | Total |
|---|---|---|---|---|---|---|---|

**Footnotes rendered on the report:**
- Cancelled invoices excluded
- Forfeited advances shown separately as other income
- Figures are on an invoice-issued basis

**Export:** CSV with a column layout matching FBR's return format, plus print.

## 13.3 Outstanding Receivables — `/reports/receivables`

All bookings with `balance_due > 0` and status in (confirmed, tentative), aged into buckets: Not yet due · 1–7 days overdue · 8–30 days · 30+ days.

Sorted by days overdue descending. Shows client name and phone prominently — this report exists to be worked through with a telephone.

Footer: total receivable, and total overdue.

## 13.4 Profit per Event — `/reports/profit`

**Access:** Admin, Manager

For each completed booking in the period:

```sql
SELECT b.invoice_no, b.client_name, b.event_date, b.event_type,
       b.grand_total AS revenue,
       COALESCE(e.total, 0) AS direct_cost,
       b.grand_total - COALESCE(e.total, 0) AS gross_margin
FROM bookings b
LEFT JOIN (
  SELECT booking_id, SUM(amount) AS total
  FROM expenses WHERE deleted_at IS NULL GROUP BY booking_id
) e ON e.booking_id = b.id
WHERE b.status = 'completed' AND b.event_date BETWEEN ? AND ?
  AND b.deleted_at IS NULL;
```

Adds a margin-percentage column and sorts ascending so the worst performers surface first. Also breaks down average margin by event type — this is the report that reveals corporate events are more profitable than weddings, or vice versa.

Caveat to display on the report: margin is only as accurate as expense linking. Show the count of unlinked expenses in the period as a data-quality warning.

## 13.5 Occupancy Rate — `/reports/occupancy`

```
capacity = days_in_period × 2 × halls        -- 2 slots/day: day + night
booked   = COUNT(bookings WHERE status IN ('confirmed','completed'))
rate     = booked / capacity
```

Displayed per month with a 12-month trend. Broken down by slot, so you can see that day events run at 15% while nights run at 70% — which is a pricing decision waiting to be made.

## 13.6 Client Management — `/clients`

Client Management is a top-level nav section (§7.2). There is no separate `clients` table — the client key is the **phone number**, derived from bookings. This keeps data entry simple (no "create client" step) while still giving a full client view.

**Directory — `/clients`**

A searchable list, one row per distinct phone number:

| Client | Phone | Bookings | Lifetime Value | Last Event | Outstanding |
|---|---|---|---|---|---|

Built by grouping bookings on phone:

```sql
SELECT phone,
       MAX(client_name)                    AS client_name,
       COUNT(*)                            AS booking_count,
       SUM(grand_total)                    AS lifetime_value,
       MAX(event_date)                     AS last_event,
       SUM(balance_due)                    AS outstanding
FROM bookings
WHERE status != 'cancelled' AND deleted_at IS NULL
GROUP BY phone
ORDER BY last_event DESC;
```

Search matches name or phone. A row with any outstanding balance is tinted amber. Click → client detail.

**Client Detail — `/clients/[phone]`**

Everything about one client:

- Header: name, phone, alt phone, CNIC, address (from their most recent booking)
- Summary cards: total bookings, lifetime value, average booking value, total outstanding, payment behaviour (average days late), cancellation count
- Bookings table: every booking ever made, newest first, each linking to its detail
- A **late-payer flag** if their average days-late exceeds a threshold — a quiet warning before you extend credit terms again
- A "New booking for this client" button that opens the wizard with contact details pre-filled

This is the screen a manager opens before offering a repeat client a discount, and the one reception opens when a familiar number calls.

## 13.7 Cancellation Log — `/reports/cancellations`

Every cancelled booking with reason, date, who cancelled, advance handling, and amount forfeited or refunded. Footer totals for forfeited income and refunds paid.

## 13.8 Discount Report

Total discounts by period, grouped by reason and by approving user. Shows discount as a percentage of gross revenue — the leakage metric.

---

# 14. USER MANAGEMENT

**Route:** `/settings/users` · **Access:** Admin only

User management, system settings, the audit log, and the recycle bin are all reached under the **Admin Settings** nav section (§7.2), not as separate top-level items.

## 14.1 CRUD

**List:** Full Name · Username · Role · Status · Last Login · Created · Actions.

**Add:** Full Name*, Username* (unique), Email, Password* + Confirm*, Role*, Phone, Active toggle. Password minimum 8 characters with at least one number; strength meter displayed. Hash with Argon2id. Email is required if self-service reset (§6.6) is enabled, and is where security notices are sent. On creation the user can optionally be sent a welcome email with a first-login reset link instead of being given a plaintext password.

**Edit:** Same form with the password field blank — filling it changes the password, invalidates that user's sessions immediately, sets `must_change_password = 1`, and emails a security notice (§6.5). A **Send reset link** button emails a single-use link rather than setting a password directly.

**Guards:**
- An admin cannot deactivate their own account
- An admin cannot demote themselves if they are the only active admin
- Deleting a user who has created bookings is **blocked** — deactivate instead, preserving audit trail integrity

## 14.2 Permission Matrix

Implement this as a single lookup consulted by `requireRole()` and by the navigation renderer, so the sidebar hides what the user cannot reach.

| Feature | Admin | Manager | Staff |
|---|:-:|:-:|:-:|
| Dashboard (full) | ✓ | ✓ | partial |
| Schedule (calendar) | ✓ | ✓ | ✓ |
| Create / Edit bookings | ✓ | ✓ | ✓ |
| Cancel booking | ✓ | ✓ | ✗ |
| Delete booking | ✓ | ✗ | ✗ |
| Record payment | ✓ | ✓ | ✗ |
| Payment plan / installments | ✓ | ✓ | ✗ |
| Apply discount | ✓ | ✓ | ✗ |
| Availability override | ✓ | ✗ | ✗ |
| Invoices | ✓ | ✓ | ✗ |
| Quotations | ✓ | ✓ | view |
| Client Management | ✓ | ✓ | view |
| Services CRUD | ✓ | ✓ | view |
| Expenses | ✓ | ✓ | ✗ |
| Taxes | ✓ | view | ✗ |
| Inquiries | ✓ | ✓ | enter + note |
| Revenue / profit reports | ✓ | ✓ | ✗ |
| Tax report | ✓ | ✗ | ✗ |
| User management | ✓ | ✗ | ✗ |
| Settings | ✓ | ✗ | ✗ |
| Audit log | ✓ | ✗ | ✗ |
| Recycle bin | ✓ | ✗ | ✗ |
| Backup / export / month-end close | ✓ | ✗ | ✗ |
| Notification centre | ✓ | ✓ | ✓ (own scope) |

---

# 15. SETTINGS & SYSTEM

## 15.1 My Account — `/account`

Any logged-in user: view profile, edit full name and phone, change password (requires current password), view own recent activity.

## 15.2 System Settings — `/settings` (Admin only)

**Venue tab** — name, address, phone(s), email, NTN/STRN, logo upload, website.

**Invoice tab** — invoice prefix, receipt prefix, quote prefix, starting sequences, terms & conditions text, footer note, currency symbol, paper size (A4/Letter), show menu on invoice (toggle).

**Financial tab** — tax charged before or after discount (`tax_on_discounted`), default due-date offset in days, default quote validity in days. Individual taxes and rates are **not** here — they live in the Taxes section (§12).

**Operations tab** — hall/section list with capacities, the two slots (Day, Night) with their default start and end times, event type list, expense category list, tentative hold default duration. The system supports exactly two slots per date per hall; the labels and times are editable but the count is fixed at two.

**System tab** — idle logout minutes, date format, theme (light/dark), font scale, recycle bin retention days.

**Integrations tab** — Google Calendar connection status, calendar ID, last successful sync, pending sync queue count, "Retry failed syncs" button. Email (Resend): sending domain, verification status, whether self-service password reset is enabled (§6.6), and a "Send test email" button.

## 15.3 Audit Log — `/settings/audit` (Admin only)

Columns: Timestamp · User · Action · Module · Record · Summary · Details.

The Details column expands to show field-level diffs rendered readably:

> Grand Total: Rs 957,000 → Rs 917,000
> Discount: Rs 40,000 → Rs 80,000

Filters: user, module, action, date range. CSV export. **Read-only, with no delete path at any permission level.**

## 15.4 Recycle Bin — `/settings/recycle-bin` (Admin only)

Soft-deleted bookings, expenses, services, and inquiries with deletion date and the user who deleted them. Restore or Permanently Delete.

Auto-purge runs on dashboard load: anything past `recycle_retention_days` is hard-deleted.

## 15.5 Audit-Safe Data Export & Scheduled Backup — `/settings/backup` (Admin only)

Turso handles point-in-time recovery on its own infrastructure, but you should not rely solely on the provider. This page owns three capabilities:

### Manual export

One-click **Export All Data**, producing a timestamped bundle for download:
- `venue-export-2026-07-27.zip` containing one CSV per table plus a `manifest.json` (export time, row counts per table, app version, exporting user)
- Alternatively a single SQLite file for full-fidelity restore

The manifest's row counts let anyone verify the export is complete. Every export writes an audit row (`action: 'export'`) — knowing *who took a full copy of the business data and when* is itself a security control.

A dashboard reminder nags if no export has been taken in 30 days.

### Scheduled backup

A Vercel cron route (`/api/cron/backup`) running weekly (Sunday 02:00 PKT), writing the same bundle to Cloudflare R2 or Vercel Blob. Protect the route with a bearer token — Vercel cron passes `CRON_SECRET` in the Authorization header; reject anything without it. Keep the last `backup_retention` copies (default 12) and delete older ones.

The Backup page shows: last successful backup timestamp, size, destination, and a red banner if the latest is older than 8 days — a silent cron failure must be loud somewhere.

### Month-end close (audit-safe snapshot)

A **Close Month** action for accounting integrity:

1. Admin picks a month that has fully ended.
2. The system computes and stores an immutable summary row: total invoiced, tax collected per tax name, payments received, expenses, and the row-count/sum checksums of that month's bookings and payments.
3. The month is marked closed. Editing or deleting any booking, payment, or expense dated inside a closed month now requires an admin override with a typed reason, and the override is prominently audited.
4. A closed month's tax report renders from the snapshot figures with a "CLOSED — figures locked on [date]" stamp, so what you filed with FBR provably matches what the system still says.

Reopening a month is possible (admin, typed confirmation, audited) but the original snapshot is retained alongside the new one — the history of what the figures *were* is never overwritten.

```sql
### period_closes
id            text PRIMARY KEY
period        text NOT NULL          -- '2026-07'
closed_at     integer NOT NULL
closed_by     text NOT NULL REFERENCES users(id)
snapshot      text NOT NULL          -- JSON: totals + checksums
reopened_at   integer
superseded_by text                   -- id of the re-close snapshot, if any
```

---

# 16. GOOGLE CALENDAR INTEGRATION

**Model:** service account, not OAuth. The calendar belongs to the venue, not to individual staff Google accounts. No consent screen, no refresh-token storage, no per-user flow.

## 16.1 One-Time Setup

1. Google Cloud Console → create project → **Enable Google Calendar API**
2. Credentials → **Create Service Account** → skip IAM role grants (Calendar permission comes from calendar sharing, not IAM)
3. Service account → Keys → **Create new JSON key**. Downloads once.
4. In Google Calendar as the venue account, create a calendar: *"Al-Noor Marquee — Bookings"*
5. Calendar Settings → **Share with specific people** → add the service account email (`...@project-id.iam.gserviceaccount.com`) with **"Make changes to events"**
6. Settings → Integrate calendar → copy the **Calendar ID**

Step 5 is the one people miss. Without it the service account authenticates successfully and sees nothing.

## 16.2 Environment

```env
GOOGLE_CLIENT_EMAIL=venue-booking@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=abc123@group.calendar.google.com
```

On Vercel, paste the key with literal `\n` and unescape at runtime. This is the single most common integration failure:

```ts
key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n')
```

## 16.3 Client

```ts
// /lib/google-calendar.ts
import { google } from 'googleapis';

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

export const calendar = google.calendar({ version: 'v3', auth });
```

## 16.4 Slot → Datetime Mapping

Bookings store a slot, not a timestamp. Google needs RFC3339. Map from settings:

```ts
const SLOT_TIMES = {
  day:   { start: '12:00', end: '17:00' },
  night: { start: '19:00', end: '00:00' },   // spans midnight
};
```

Always pass `timeZone: 'Asia/Karachi'`. Pakistan observes no DST, which removes an entire bug class — but be explicit anyway, because the Vercel runtime is UTC.

**Night events end after midnight.** Increment the end date:

```ts
const isOvernight = times.end <= times.start;
const endDate = isOvernight ? addDays(eventDate, 1) : eventDate;
```

## 16.5 Event Payload

```ts
{
  summary: `${event_type} — ${client_name} (${guest_count} guests)`,
  location: hall_section,
  description: [
    `Invoice: ${invoice_no}`,
    `Phone: ${phone}`,
    `Guests: ${guest_count}`,
    `Balance Due: ${formatPKR(balance_due)}`,
    special_instructions ?? '',
  ].join('\n'),
  start: { dateTime: `${event_date}T${times.start}:00`, timeZone: 'Asia/Karachi' },
  end:   { dateTime: `${endDate}T${times.end}:00`,      timeZone: 'Asia/Karachi' },
  colorId: status === 'tentative' ? '5' : '10',   // yellow | green
  reminders: {
    useDefault: false,
    overrides: [
      { method: 'popup', minutes: 1440 },
      { method: 'popup', minutes: 60 },
    ],
  },
}
```

Store the returned `res.data.id` in `bookings.google_event_id`.

## 16.6 Lifecycle

| System event | Calendar action |
|---|---|
| Booking created | `events.insert`, store returned ID |
| Booking updated | `events.patch` with changed fields only |
| Booking cancelled | `events.patch` → grey colour, `CANCELLED —` prefix (not deleted, so history remains on staff phones) |
| Booking deleted | `events.delete` |
| Tentative → Confirmed | `events.patch` → green |

## 16.7 Failure Handling

**Rule: Google Calendar is a mirror, never a source of truth.** Availability is decided by the Turso query alone. Never read from Google to determine whether a date is free.

```ts
try {
  await createCalendarEvent(booking);
} catch (err) {
  console.error('Calendar sync failed', err);
  await db.insert(syncQueue).values({
    id: nanoid(), bookingId: booking.id, action: 'create',
    attempts: 0, lastError: String(err), createdAt: now(),
  });
  // Booking already committed — do NOT throw
}
```

A retry runs on dashboard load, processing up to 10 queued items with exponential backoff, giving up after 5 attempts. The Settings → Integrations tab shows the pending count and a manual retry button, so nobody assumes phone calendars are complete when they aren't.

**Quotas:** 1M requests/day, 600/minute. Not a constraint at this scale.

---

# 17. CLOUDFLARE SECURITY

## 17.1 DNS & TLS

```
CNAME  @    cname.vercel-dns.com   Proxied (orange cloud)
CNAME  www  cname.vercel-dns.com   Proxied
```

SSL/TLS mode: **Full (strict)**. Not Flexible — Flexible creates a redirect loop with Vercel and leaves the Cloudflare→Vercel hop unencrypted.

Also enable: Always Use HTTPS, Automatic HTTPS Rewrites, Minimum TLS 1.2, HSTS (start with a short max-age).

## 17.2 Rules

**Geo-lock the admin area.** WAF → Custom rule:
```
If  URI Path starts with "/admin" or "/dashboard" or "/bookings"
AND Country is not Pakistan
Then Managed Challenge
```
Use Managed Challenge rather than Block so the owner can still get in while travelling, via captcha.

**Rate-limit login.** The free plan allows one rate-limiting rule — spend it here:
```
If  URI Path equals "/login"
Rate 5 requests per 10 minutes per IP
Then Block for 1 hour
```

**Managed WAF ruleset** — enable Cloudflare's OWASP core rules at Medium sensitivity. High produces false positives on rich-text fields like the About Us editor.

**Bot Fight Mode** — on. Free, blocks obvious scrapers.

**Cache bypass on admin routes.** Cloudflare will otherwise happily cache a page containing one user's data and serve it to another:
```
URL: yourvenue.com/admin/*  →  Cache Level: Bypass
```
Next.js sets correct `Cache-Control` headers on dynamic routes, but set this explicitly regardless. Cache aggressively on `/`, `/services`, `/about`.

## 17.3 Cloudflare Access (highest value item)

Zero Trust → Access. Free for up to 50 users. It authenticates **before** requests reach Vercel.

Create an Access application covering `/dashboard*`, `/bookings*`, `/reports*`, `/settings*`. Policy: allow specific email addresses. Identity method: One-Time PIN.

Staff then pass through two independent layers — Cloudflare's PIN, then the application's own login. An attacker cannot even reach the login form to attack it. For a system holding client CNICs, phone numbers, and financial records, this is worth the ten minutes it takes.

## 17.4 What Cloudflare Does Not Fix

This hardens the perimeter, not the application. It does nothing about a weak staff password, a `requireRole()` call you forgot on a Server Action, or SQL built by string concatenation. The WAF catches generic attack patterns; it will not catch a logic flaw that lets a Staff user open the tax report.

Application-layer discipline remains primary. Cloudflare is the second lock, not the first.

---

# 18. DEPLOYMENT

## 18.1 Environment Variables

```env
# Database
TURSO_DATABASE_URL=libsql://venue-xxx.turso.io
TURSO_AUTH_TOKEN=

# Auth
AUTH_SECRET=                  # openssl rand -base64 32

# Google Calendar
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CALENDAR_ID=

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM="Al-Noor Marquee <no-reply@mail.yourvenue.com>"
APP_URL=https://yourvenue.com

# Cron protection (reminders + scheduled backup)
CRON_SECRET=

# File storage (receipt scans, backups)
BLOB_READ_WRITE_TOKEN=
```

## 18.2 Vercel Configuration

```json
{
  "regions": ["sin1"],
  "crons": [
    { "path": "/api/cron/backup", "schedule": "0 2 * * 0" }
  ]
}
```

Set the Turso database region to **Singapore** to match. Same-region matters far more than which region — a cross-region query adds 200ms to every page load.

## 18.3 Migrations

```bash
npx drizzle-kit generate    # writes SQL to /drizzle
npx drizzle-kit migrate     # applies to Turso
```

Never edit generated migrations after they've been applied. Never use `drizzle-kit push` against production — it can silently drop columns.

## 18.4 Pre-Launch Checklist

**Data integrity**
- [ ] `PRAGMA foreign_keys = ON` set on the libSQL client
- [ ] All indexes from §4.2 created and verified with `EXPLAIN QUERY PLAN`
- [ ] Invoice counter increments atomically under concurrent load (test with parallel requests)
- [ ] Money stored as integers everywhere; no float columns
- [ ] `amount_paid` / `balance_due` recomputed inside the payment transaction

**Availability**
- [ ] Double-booking blocked when two sessions submit the same slot simultaneously
- [ ] Cancelled bookings release their slot
- [ ] "Full Venue" blocks all sections and vice versa
- [ ] Editing a booking excludes itself from the conflict check

**Permissions**
- [ ] Every Server Action calls `requireRole()` — grep the codebase to confirm none are missed
- [ ] Staff cannot reach financial routes by typing the URL directly
- [ ] Deactivated users are logged out on their next request

**Printing**
- [ ] Invoice renders correctly on A4 in Chrome and Edge
- [ ] Multi-page service tables repeat their header row
- [ ] Amount-in-words handles lakh and crore correctly
- [ ] Function sheet shows no prices

**Integration**
- [ ] Calendar event created, updated, and cancelled correctly
- [ ] Night event spanning midnight ends on the correct date
- [ ] Booking still saves when the Calendar API is unreachable
- [ ] Sync queue retries and surfaces failures in Settings

**Security**
- [ ] Cloudflare Full (strict), HSTS on
- [ ] Access policy live on admin routes (entire app is behind auth — no public routes)
- [ ] Admin routes bypass cache
- [ ] Receipt uploads and backups in a private bucket behind signed URLs
- [ ] Resend sending domain verified; SPF, DKIM, DMARC records live in Cloudflare DNS
- [ ] Reset tokens stored hashed, single-use, 30-min expiry; redeeming logs out all sessions
- [ ] Forgot-password shows an identical response whether or not the account exists
- [ ] Password change still completes and audits when Resend is unreachable
- [ ] `must_change_password` redirect enforced before dashboard access
- [ ] Seed admin credentials from §6.1 changed before go-live

**Data integrity (taxes, invoices, backups)**
- [ ] `booking_taxes` snapshots name + rate + amount; changing a tax rate never alters an issued invoice
- [ ] Multiple taxes are additive on the same taxable amount, not compounding
- [ ] Installment amounts must reconcile to the grand total before a plan saves
- [ ] Quote numbers and invoice numbers draw from separate counters; neither is reused
- [ ] Converting a quotation re-runs the availability check before issuing an invoice
- [ ] Scheduled backup cron rejects requests without the correct `CRON_SECRET`
- [ ] Month-end close locks edits to that period behind an audited admin override

---

# 19. BUILD SEQUENCE

**Phase 1 — Foundation (weeks 1–4)**
Drizzle schema and migrations · seed data · Lucia auth and setup wizard · `requireRole()` · sidebar nav shell · Taxes CRUD · Services CRUD (per-head catering + menu) · Booking wizard · availability logic (two slots/day) · multi-tax totals · invoice numbering · invoice print layout · basic Schedule month view.

*Milestone: a booking can be created with taxes, saved without double-booking, and printed.*

**Phase 2 — Money (weeks 5–7)**
Payment ledger and receipts · installment scheduler · dues detection · Invoices section with search · expenses CRUD · revenue report · tax report (grouped by tax) · receivables report.

*Milestone: the venue can stop using the paper register.*

**Phase 3 — Operations (weeks 8–10)**
Dashboard (alerts, KPIs, latest-5 bookings, due-this-week) · Quotations (builder + convert) · Client Management directory and detail · staff-entered inquiries · notification centre · user management and roles · Resend integration and password-change security notices · optional self-service reset · audit log · global + per-section search · function sheet · full Schedule views (week/list/year). Charts live under Reports.

*Milestone: all staff can use it in their own roles.*

**Phase 4 — Polish (weeks 11–12)**
Google Calendar sync · profit and occupancy reports · recycle bin · audit-safe export and month-end close · scheduled backup cron · CSV exports · Cloudflare hardening · dark mode.

*Milestone: production-ready.*

---

# 20. THINGS THAT WILL BITE YOU

Collected failure modes, in rough order of likelihood.

1. **Float arithmetic on money.** Rs 1,800 × 350 in floating point eventually produces `629999.9999999999`. Integers only.

2. **Invoice number collisions.** Generating the number outside the transaction means two simultaneous bookings get the same one. The counter increment and the booking insert must share a transaction.

3. **Availability checked only on the client.** The live check in the wizard is a courtesy. The transactional check is the guarantee. Ship without the second one and you will double-book.

4. **Denormalised balances drifting.** Any code path that touches payments must recompute `amount_paid` and `balance_due` in the same transaction. A payment deleted without recomputation leaves a booking permanently showing the wrong balance.

5. **Service rate changes rewriting history.** If `booking_services` joins to `services` for the rate instead of storing a snapshot, raising a price retroactively alters every past invoice. Snapshot the rate and the name.

6. **`GOOGLE_PRIVATE_KEY` newlines.** On Vercel the key arrives with literal `\n`. Unescape it or every Calendar call fails with an opaque error.

7. **Midnight-spanning events.** A night event 19:00–00:00 ends on the *following* date. Without the date increment, Google rejects the event or renders it as five minutes long.

8. **Cloudflare caching admin pages.** Set the bypass rule. One user seeing another's dashboard is a serious incident.

9. **Missing `requireRole()`.** One un-gated Server Action exposes financial data to anyone who can read the network tab. Grep for `'use server'` and check every one.

10. **`SELECT *` on list pages.** Turso bills rows scanned. It works fine at 200 bookings and becomes a bill at 20,000.

11. **Timezone drift.** The server runs UTC. A booking created at 2am PKT on the 15th saves as the 14th if you use `new Date()` without zone handling. Store dates as `YYYY-MM-DD` strings and do date arithmetic in `Asia/Karachi`.

12. **Amount in words.** Pakistani receipts use lakh and crore, not million. "Rs 957,000" is "Nine Lakh Fifty-Seven Thousand Rupees Only", not "Nine Hundred Fifty-Seven Thousand".

13. **Deleting a service that's in use.** Block it. Historical invoices must remain printable.

14. **Trusting client-side totals.** Recompute `calculateTotals()` server-side inside the transaction. A modified request body should never be able to set its own grand total.

15. **Email blocking a security action.** If a password reset throws because Resend is down, the user is locked out of their own reset. Email is a side effect wrapped in try/catch — the password change commits regardless, exactly like calendar sync.

16. **Reset tokens stored in plaintext.** Store the SHA-256 hash; put the raw token only in the emailed link. A database leak must not hand an attacker working reset tokens.

17. **Username enumeration on forgot-password.** Return the same "if an account matches, we've sent a link" message whether or not the account exists. Differing responses let an attacker discover valid usernames.

18. **Skipping SPF/DKIM/DMARC.** Without the DNS records, reset emails silently land in spam and users think the feature is broken. Verify the domain before relying on delivery.

19. **Tax rate changes rewriting history.** If a booking computes tax by joining live to the `taxes` table instead of reading its `booking_taxes` snapshot, editing a rate silently alters every past invoice — and your filed tax reports no longer match. Snapshot name, rate, and amount at save time.

20. **Compounding taxes by accident.** Two taxes (16% + 5%) must each compute on the taxable amount and sum to 21% of it — not 16% then 5% of the already-taxed total. The `calculateTotals()` structure enforces this; don't "optimise" it into sequential application.

21. **Installments that don't reconcile.** A plan whose steps sum to more or less than the grand total produces a booking that can never read as fully paid or shows a phantom balance. Block save until the remainder is zero.

22. **Quotation slots being treated as reservations.** A quote's preferred date must not block the calendar or pass an availability check on save — only on *conversion*. Otherwise unconverted quotes silently sterilise dates.

23. **Editing a closed month.** Once a month is closed for accounting, an unguarded edit to a booking or payment inside it desyncs the system from what was filed. Route all such edits through the audited admin override, and render closed-period reports from the snapshot, not live data.
