import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { canApplyDiscount, canOverrideAvailability } from "@/lib/auth/permissions";
import {
  listActiveServices,
  getCateringMenuByService,
  getHallRentService,
} from "@/lib/db/queries/services";
import { listActiveTaxes } from "@/lib/db/queries/taxes";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { getBookingDetail } from "@/lib/db/queries/bookings";
import { BookingWizard } from "@/components/booking-wizard/booking-wizard";
import type { ServiceLineUI } from "@/components/booking-wizard/types";

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("admin", "manager");
  const { id } = await params;

  const [detail, services, hallRentService, cateringMenus, taxesAvailable, settings] =
    await Promise.all([
      getBookingDetail(id),
      listActiveServices(),
      getHallRentService(),
      getCateringMenuByService(),
      listActiveTaxes(),
      getVenueSettings(),
    ]);

  if (!detail || detail.booking.deletedAt) notFound();
  const { booking, serviceLines, extras, menu, taxLines } = detail;

  // A cancelled booking is a historical record — reinstating is a separate
  // decision, not something an edit form should quietly do.
  if (booking.status === "cancelled") redirect(`/bookings/${id}`);

  // Managers may only edit what they created themselves; the action enforces
  // this too, but bouncing here avoids showing a form that cannot be saved.
  if (user.role === "manager" && booking.createdBy !== user.id) {
    redirect(`/bookings/${id}`);
  }

  const lines: ServiceLineUI[] = serviceLines.map((l) => {
    const svc = services.find((s) => s.id === l.serviceId);
    return {
      serviceId: l.serviceId,
      serviceName: l.serviceName,
      category: svc?.category ?? "misc",
      pricingType: (svc?.pricingType ?? l.pricingType) as ServiceLineUI["pricingType"],
      qty: l.qty,
      ratePaisa: l.rate,
      taxable: l.taxable === 1,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit {booking.invoiceNo}</h1>
        <p className="text-sm text-muted-foreground">
          The invoice number stays the same. Changing the date or slot re-checks availability.
        </p>
      </div>
      <BookingWizard
        services={services}
        cateringMenus={cateringMenus}
        taxesAvailable={taxesAvailable}
        settings={settings}
        canApplyDiscount={canApplyDiscount(user.role)}
        canOverride={canOverrideAvailability(user.role)}
        hallRentService={hallRentService}
        editing={{
          bookingId: booking.id,
          invoiceNo: booking.invoiceNo,
          amountPaidPaisa: booking.amountPaid,
          clientName: booking.clientName,
          phone: booking.phone,
          altPhone: booking.altPhone ?? "",
          cnic: booking.cnic ?? "",
          address: booking.address ?? "",
          eventType: booking.eventType,
          eventDate: booking.eventDate,
          eventSlot: booking.eventSlot as "day" | "night",
          hallSection: booking.hallSection,
          guestCount: booking.guestCount,
          startTime: booking.startTime ?? "",
          endTime: booking.endTime ?? "",
          status: (booking.status === "tentative" ? "tentative" : "confirmed") as
            | "confirmed"
            | "tentative",
          holdExpiresOn: booking.holdExpiresOn ?? "",
          hallRentPaisa: booking.hallRent,
          discountAmountPaisa: booking.discountAmount,
          discountReason: booking.discountReason ?? "",
          taxIds: taxLines.map((t) => t.taxId),
          lines,
          extras: extras.map((e) => ({
            label: e.label,
            qty: e.qty,
            ratePaisa: e.rate,
            taxable: e.taxable === 1,
          })),
          menu: menu.map((m) => ({ itemName: m.itemName, type: m.type })),
          dueDate: booking.dueDate ?? "",
          internalNotes: booking.internalNotes ?? "",
          clientNotes: booking.clientNotes ?? "",
          specialInstructions: booking.specialInstructions ?? "",
        }}
      />
    </div>
  );
}
