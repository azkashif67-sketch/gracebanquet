import { requireRole } from "@/lib/auth/require-role";
import { canApplyDiscount, canOverrideAvailability } from "@/lib/auth/permissions";
import { listActiveServices, getCateringMenuByService } from "@/lib/db/queries/services";
import { listActiveTaxes } from "@/lib/db/queries/taxes";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { getQuotationDetail } from "@/lib/db/queries/quotations";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { BookingWizard } from "@/components/booking-wizard/booking-wizard";
import type { ExtraLineUI, ServiceLineUI } from "@/components/booking-wizard/types";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    slot?: string;
    hall?: string;
    phone?: string;
    name?: string;
    fromQuotationId?: string;
    fromInquiryId?: string;
  }>;
}) {
  const user = await requireRole("admin", "manager", "staff");
  const params = await searchParams;

  const [services, cateringMenus, taxesAvailable, settings] = await Promise.all([
    listActiveServices(),
    getCateringMenuByService(),
    listActiveTaxes(),
    getVenueSettings(),
  ]);

  let fromQuotation:
    | {
        id: string;
        lines: ServiceLineUI[];
        extras: ExtraLineUI[];
        discountAmountPaisa: number;
        taxIds: string[];
      }
    | undefined;
  let sourcePrefill: {
    clientName?: string;
    phone?: string;
    eventType?: string;
    guestCount?: number;
    eventDate?: string;
    eventSlot?: "day" | "night";
  } = {};

  if (params.fromQuotationId) {
    const detail = await getQuotationDetail(params.fromQuotationId);
    if (detail && detail.quotation.status !== "converted") {
      const { quotation, lines } = detail;
      const lineUIs: ServiceLineUI[] = [];
      const extraUIs: ExtraLineUI[] = [];
      for (const l of lines) {
        if (l.kind === "service" && l.serviceId) {
          const svc = services.find((s) => s.id === l.serviceId);
          lineUIs.push({
            serviceId: l.serviceId,
            serviceName: l.label,
            category: svc?.category ?? "misc",
            pricingType: svc?.pricingType ?? "fixed",
            qty: l.qty,
            ratePaisa: l.rate,
            taxable: l.taxable === 1,
          });
        } else {
          extraUIs.push({ label: l.label, qty: l.qty, ratePaisa: l.rate, taxable: l.taxable === 1 });
        }
      }
      fromQuotation = {
        id: quotation.id,
        lines: lineUIs,
        extras: extraUIs,
        discountAmountPaisa: quotation.discountAmount,
        taxIds: [], // quotations don't snapshot which tax IDs were used, just the total
      };
      sourcePrefill = {
        clientName: quotation.clientName,
        phone: quotation.phone,
        eventType: quotation.eventType ?? undefined,
        guestCount: quotation.guestCount ?? undefined,
      };
    }
  }

  let sourceInquiryId: string | undefined;
  if (params.fromInquiryId) {
    const inquiry = await db.query.inquiries.findFirst({ where: eq(inquiries.id, params.fromInquiryId) });
    if (inquiry && inquiry.status !== "converted") {
      sourceInquiryId = inquiry.id;
      sourcePrefill = {
        clientName: inquiry.name,
        phone: inquiry.phone,
        eventType: inquiry.eventType ?? undefined,
        guestCount: inquiry.guestEstimate ?? undefined,
        eventDate: inquiry.preferredDate ?? undefined,
        eventSlot: inquiry.preferredSlot === "day" || inquiry.preferredSlot === "night" ? inquiry.preferredSlot : undefined,
      };
    }
  }

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
          eventDate: params.date ?? sourcePrefill.eventDate,
          eventSlot:
            params.slot === "day" || params.slot === "night" ? params.slot : sourcePrefill.eventSlot,
          hallSection: params.hall,
          phone: params.phone ?? sourcePrefill.phone,
          clientName: params.name ?? sourcePrefill.clientName,
          eventType: sourcePrefill.eventType,
          guestCount: sourcePrefill.guestCount,
        }}
        fromQuotation={fromQuotation}
        sourceInquiryId={sourceInquiryId}
      />
    </div>
  );
}
