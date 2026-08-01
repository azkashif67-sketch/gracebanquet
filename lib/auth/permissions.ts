import type { Role } from "./require-role";

// Subset of the full permission matrix (spec §14.2). Extend as later phases
// add Quotations, Clients, Inquiries, etc.
export interface NavItem {
  label: string;
  href: string;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", roles: ["admin", "manager", "staff"] },
  { label: "Schedule", href: "/schedule", roles: ["admin", "manager", "staff"] },
  { label: "Bookings", href: "/bookings", roles: ["admin", "manager", "staff"] },
  { label: "Invoices", href: "/invoices", roles: ["admin", "manager"] },
  { label: "Quotations", href: "/quotations", roles: ["admin", "manager", "staff"] },
  { label: "Clients", href: "/clients", roles: ["admin", "manager", "staff"] },
  { label: "Services", href: "/services", roles: ["admin", "manager", "staff"] },
  { label: "Expenses", href: "/expenses", roles: ["admin", "manager"] },
  { label: "Taxes", href: "/taxes", roles: ["admin", "manager"] },
  { label: "Reports", href: "/reports", roles: ["admin", "manager"] },
  { label: "Inquiries", href: "/inquiries", roles: ["admin", "manager", "staff"] },
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
export const canManageServices = (role: Role) => role === "admin" || role === "manager";
export const canManageExpenses = (role: Role) => role === "admin" || role === "manager";
