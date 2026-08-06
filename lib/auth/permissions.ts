import type { Role } from "./require-role";

/**
 * Role model (spec §14.2, as amended during finalization):
 *
 *   Staff   — reception. Takes bookings and logs enquiries. Sees no money.
 *   Manager — the above, plus payments, expenses, editing their own bookings,
 *             and read-only sight of the tax rates being charged.
 *   Admin   — everything, including all reporting, the service catalogue,
 *             quotations, cancellations, deletions, and user management.
 *
 * The hierarchy is strict (staff ⊆ manager ⊆ admin) so a Manager is never
 * blocked from something a Staff user can do.
 */
export interface NavItem {
  label: string;
  href: string;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", roles: ["admin", "manager", "staff"] },
  { label: "Schedule", href: "/schedule", roles: ["admin", "manager", "staff"] },
  { label: "Bookings", href: "/bookings", roles: ["admin", "manager", "staff"] },
  { label: "Clients", href: "/clients", roles: ["admin", "manager", "staff"] },
  { label: "Inquiries", href: "/inquiries", roles: ["admin", "manager", "staff"] },
  { label: "Expenses", href: "/expenses", roles: ["admin", "manager"] },
  { label: "Taxes", href: "/taxes", roles: ["admin", "manager"] },
  { label: "Invoices", href: "/invoices", roles: ["admin"] },
  { label: "Quotations", href: "/quotations", roles: ["admin"] },
  { label: "Services", href: "/services", roles: ["admin"] },
  { label: "Reports", href: "/reports", roles: ["admin"] },
  { label: "Admin Settings", href: "/settings", roles: ["admin"] },
];

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

// Feature-level checks used inline in components (e.g. hide a discount field,
// disable a delete button) where a full requireRole() page/action gate isn't
// the right shape.
export const canApplyDiscount = (role: Role) => role === "admin" || role === "manager";
export const canOverrideAvailability = (role: Role) => role === "admin";
export const canRecordPayment = (role: Role) => role === "admin" || role === "manager";
export const canManageExpenses = (role: Role) => role === "admin" || role === "manager";
/** Editing is further restricted to your own bookings unless you're an admin. */
export const canEditBookings = (role: Role) => role === "admin" || role === "manager";
export const canCancelBooking = (role: Role) => role === "admin";
export const canDeleteBooking = (role: Role) => role === "admin";
export const canManageServices = (role: Role) => role === "admin";
export const canManageTaxes = (role: Role) => role === "admin";
export const canViewReports = (role: Role) => role === "admin";
