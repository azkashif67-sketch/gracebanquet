import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { UserForm } from "@/components/settings/user-form";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Edit user</h1>
      <UserForm
        userId={user.id}
        initial={{
          fullName: user.fullName,
          username: user.username,
          email: user.email ?? undefined,
          role: user.role as "admin" | "manager" | "staff",
          phone: user.phone ?? undefined,
          active: user.active === 1,
        }}
      />
    </div>
  );
}
