import { requireRole } from "@/lib/auth/require-role";
import { canApplyDiscount, canOverrideAvailability } from "@/lib/auth/permissions";
import { listActiveServices, getCateringMenuByService } from "@/lib/db/queries/services";
import { listActiveTaxes } from "@/lib/db/queries/taxes";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { BookingWizard } from "@/components/booking-wizard/booking-wizard";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; slot?: string; hall?: string }>;
}) {
  const user = await requireRole("admin", "manager", "staff");
  const params = await searchParams;

  const [services, cateringMenus, taxesAvailable, settings] = await Promise.all([
    listActiveServices(),
    getCateringMenuByService(),
    listActiveTaxes(),
    getVenueSettings(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New Booking</h1>
      <BookingWizard
        services={services}
        cateringMenus={cateringMenus}
        taxesAvailable={taxesAvailable}
        settings={settings}
        canApplyDiscount={canApplyDiscount(user.role)}
        canOverride={canOverrideAvailability(user.role)}
        prefill={{
          eventDate: params.date,
          eventSlot: params.slot === "day" || params.slot === "night" ? params.slot : undefined,
          hallSection: params.hall,
        }}
      />
    </div>
  );
}
