import { requireRole } from "@/lib/auth/require-role";
import { ServiceForm } from "@/components/services/service-form";

export default async function NewServicePage() {
  await requireRole("admin");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Add service</h1>
      <ServiceForm />
    </div>
  );
}
