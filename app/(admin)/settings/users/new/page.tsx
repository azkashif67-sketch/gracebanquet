import { requireRole } from "@/lib/auth/require-role";
import { UserForm } from "@/components/settings/user-form";

export default async function NewUserPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Add user</h1>
      <UserForm />
    </div>
  );
}
