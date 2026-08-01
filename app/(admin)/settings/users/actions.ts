"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/require-role";
import { audit, diff } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { invalidateAllUserSessions } from "@/lib/auth/session";

const passwordSchema = z.string().min(8).regex(/\d/, "Password must contain at least one number");

const createUserSchema = z.object({
  fullName: z.string().min(1),
  username: z.string().min(3),
  email: z.string().optional(),
  password: passwordSchema,
  role: z.enum(["admin", "manager", "staff"]),
  phone: z.string().optional(),
  active: z.boolean(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

const updateUserSchema = z.object({
  fullName: z.string().min(1),
  username: z.string().min(3),
  email: z.string().optional(),
  password: z.union([passwordSchema, z.literal("")]).optional(),
  role: z.enum(["admin", "manager", "staff"]),
  phone: z.string().optional(),
  active: z.boolean(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface ActionResult {
  error?: string;
}

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  const admin = await requireRole("admin");
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const id = nanoid();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id,
        username: data.username,
        email: data.email || null,
        passwordHash: await hashPassword(data.password),
        fullName: data.fullName,
        role: data.role,
        phone: data.phone || null,
        active: data.active ? 1 : 0,
        mustChangePassword: 1,
        createdAt: Math.floor(Date.now() / 1000),
      });
      await audit(tx, {
        userId: admin.id,
        action: "create",
        module: "user",
        recordId: id,
        summary: `Created user "${data.username}" (${data.role})`,
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return { error: "That username is already taken." };
    }
    throw err;
  }

  revalidatePath("/settings/users");
  redirect("/settings/users");
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<ActionResult> {
  const admin = await requireRole("admin");
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const before = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!before) return { error: "User not found." };

  // Guard: an admin cannot deactivate their own account.
  if (id === admin.id && !data.active) {
    return { error: "You cannot deactivate your own account." };
  }
  // Guard: an admin cannot demote themselves if they're the only active admin.
  if (id === admin.id && data.role !== "admin") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, 1), ne(users.id, id)));
    if (n === 0) return { error: "You are the only active admin — cannot change your own role." };
  }

  const passwordChanged = Boolean(data.password);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          username: data.username,
          email: data.email || null,
          fullName: data.fullName,
          role: data.role,
          phone: data.phone || null,
          active: data.active ? 1 : 0,
          ...(passwordChanged
            ? { passwordHash: await hashPassword(data.password!), mustChangePassword: 1 }
            : {}),
        })
        .where(eq(users.id, id));

      await audit(tx, {
        userId: admin.id,
        action: "update",
        module: "user",
        recordId: id,
        summary: passwordChanged
          ? `Updated user "${data.username}" and reset their password`
          : `Updated user "${data.username}"`,
        changes: diff(
          { fullName: before.fullName, role: before.role, active: before.active },
          { fullName: data.fullName, role: data.role, active: data.active ? 1 : 0 },
        ),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return { error: "That username is already taken." };
    }
    throw err;
  }

  if (passwordChanged || !data.active) {
    await invalidateAllUserSessions(id);
  }

  revalidatePath("/settings/users");
  redirect("/settings/users");
}
