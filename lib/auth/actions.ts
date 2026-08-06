"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db";
import { taxes, users } from "../db/schema";
import { audit } from "../audit";
import { seedInitialData } from "../db/seed";
import {
  clearSessionCookie,
  createSession,
  invalidateSession,
  validateRequest,
} from "./session";
import { getDummyHash, hashPassword, verifyPassword } from "./password";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export interface LoginState {
  error?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Please enter your username and password." };
  }
  const { username, password } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.username, username) });

  if (!user) {
    // Run a dummy verify anyway so a nonexistent username takes the same
    // amount of time as a wrong password — closes the timing side channel.
    await verifyPassword(await getDummyHash(), password);
    return { error: "Invalid username or password." };
  }

  const now = Date.now();
  if (user.lockedUntil && user.lockedUntil > now) {
    const minutes = Math.ceil((user.lockedUntil - now) / 60000);
    return { error: `Account locked. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }

  if (user.active === 0) {
    return { error: "Account disabled. Contact your administrator." };
  }

  const valid = await verifyPassword(user.passwordHash, password);

  if (!valid) {
    const failedAttempts = user.failedAttempts + 1;
    const lockingNow = failedAttempts >= MAX_FAILED_ATTEMPTS;
    await db
      .update(users)
      .set({
        failedAttempts: lockingNow ? 0 : failedAttempts,
        lockedUntil: lockingNow ? now + LOCKOUT_MS : user.lockedUntil,
      })
      .where(eq(users.id, user.id));

    await db.transaction((tx) =>
      audit(tx, {
        userId: user.id,
        action: "login_fail",
        module: "auth",
        recordId: user.id,
        summary: `Failed login attempt for "${username}"`,
      }),
    );

    return { error: "Invalid username or password." };
  }

  await db
    .update(users)
    .set({ failedAttempts: 0, lockedUntil: null, lastLogin: Math.floor(now / 1000) })
    .where(eq(users.id, user.id));

  await createSession(user.id);

  await db.transaction((tx) =>
    audit(tx, {
      userId: user.id,
      action: "login",
      module: "auth",
      recordId: user.id,
      summary: `${user.fullName} logged in`,
    }),
  );

  if (user.mustChangePassword) {
    redirect("/account/change-password");
  }
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const { session, user } = await validateRequest();
  if (session) {
    await invalidateSession(session.id);
    if (user) {
      await db.transaction((tx) =>
        audit(tx, {
          userId: user.id,
          action: "update",
          module: "auth",
          recordId: user.id,
          summary: `${user.fullName} logged out`,
        }),
      );
    }
  }
  await clearSessionCookie();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// First-run setup wizard (spec §6.2)
// ---------------------------------------------------------------------------
const setupSchema = z.object({
  fullName: z.string().min(2),
  username: z.string().min(3),
  password: z.string().min(8).regex(/\d/, "Password must contain at least one number"),

  venueName: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  ntn: z.string().optional(),

  taxLabel: z.string().min(1),
  taxRatePercent: z.number().min(0).max(100),
  invoicePrefix: z.string().min(1),

  halls: z.array(z.object({ name: z.string().min(1), capacity: z.number().optional() })).min(1),
  daySlotStart: z.string(),
  daySlotEnd: z.string(),
  nightSlotStart: z.string(),
  nightSlotEnd: z.string(),

  recoveryKey: z.string().min(16),
});

export type SetupInput = z.infer<typeof setupSchema>;

export interface SetupState {
  error?: string;
}

export async function completeSetup(input: SetupInput): Promise<SetupState> {
  const existing = await db.query.users.findFirst();
  if (existing) {
    return { error: "Setup has already been completed." };
  }

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid setup data." };
  }
  const data = parsed.data;

  const adminId = nanoid();
  const passwordHash = await hashPassword(data.password);
  const recoveryKeyHash = await hashPassword(data.recoveryKey);
  const now = Math.floor(Date.now() / 1000);

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: adminId,
      username: data.username,
      email: data.email || null,
      passwordHash,
      fullName: data.fullName,
      role: "admin",
      active: 1,
      mustChangePassword: 0,
      createdAt: now,
    });

    await seedInitialData(tx, {
      extraSettings: {
        venue_name: JSON.stringify(data.venueName),
        address: JSON.stringify(data.address ?? ""),
        phone: JSON.stringify(data.phone ?? ""),
        email: JSON.stringify(data.email ?? ""),
        ntn: JSON.stringify(data.ntn ?? ""),
        invoice_prefix: JSON.stringify(data.invoicePrefix),
        // No synthetic "Full Venue" entry — the venue has a single hall, and
        // an extra pseudo-hall only creates a confusing second filter option.
        halls: JSON.stringify(data.halls.map((h) => h.name)),
        slots: JSON.stringify({
          day: { label: "Day", start: data.daySlotStart, end: data.daySlotEnd },
          night: { label: "Night", start: data.nightSlotStart, end: data.nightSlotEnd },
        }),
        recovery_key_hash: recoveryKeyHash,
      },
    });

    // Overwrite the seeded default tax's rate/name with the admin's chosen
    // values instead of leaving both a placeholder and a duplicate.
    const seededTax = await tx.query.taxes.findFirst();
    if (seededTax) {
      await tx
        .update(taxes)
        .set({ name: data.taxLabel, rate: Math.round(data.taxRatePercent * 100) })
        .where(eq(taxes.id, seededTax.id));
    }

    await audit(tx, {
      userId: adminId,
      action: "create",
      module: "settings",
      summary: "Completed first-run setup",
    });
  });

  await createSession(adminId);
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Change password (spec §15.1, and the forced-change path from §6.1)
// ---------------------------------------------------------------------------
const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/\d/, "Password must include a number."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export interface ChangePasswordState {
  error?: string;
}

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: (formData.get("currentPassword") as string) || undefined,
    newPassword: (formData.get("newPassword") as string) ?? "",
    confirmPassword: (formData.get("confirmPassword") as string) ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!row) redirect("/login");

  // A user who chose to change their password must prove they know the old
  // one. A user who is being *forced* to change it (admin reset, first login)
  // has already proven it by getting this far, and may not know it at all.
  if (!row.mustChangePassword) {
    if (!data.currentPassword) return { error: "Enter your current password." };
    const ok = await verifyPassword(row.passwordHash, data.currentPassword);
    if (!ok) return { error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(data.newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: 0 })
      .where(eq(users.id, user.id));
    await audit(tx, {
      userId: user.id,
      action: "update",
      module: "auth",
      recordId: user.id,
      summary: `${row.fullName} changed their password`,
    });
  });

  redirect("/dashboard");
}
