import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getServiceWithMenu } from "@/lib/db/queries/services";
import { toRupees } from "@/lib/calculations";
import { ServiceForm } from "@/components/services/service-form";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const result = await getServiceWithMenu(id);
  if (!result) notFound();
  const { service, menuItems } = result;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Edit service</h1>
      <ServiceForm
        serviceId={service.id}
        initial={{
          name: service.name,
          category: service.category as never,
          description: service.description ?? "",
          pricingType: service.pricingType as never,
          rateRupees: toRupees(service.rate),
          taxable: service.taxable === 1,
          active: service.active === 1,
          menuItems: menuItems.map((m) => ({ name: m.name, type: m.type as never })),
        }}
      />
    </div>
  );
}
