import { requireRole } from "@/lib/auth/require-role";
import { listActiveServices } from "@/lib/db/queries/services";
import { listActiveTaxes } from "@/lib/db/queries/taxes";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { QuotationForm } from "@/components/quotations/quotation-form";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ fromInquiryId?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const [services, taxesAvailable, settings] = await Promise.all([
    listActiveServices(),
    listActiveTaxes(),
    getVenueSettings(),
  ]);

  let sourceInquiryId: string | undefined;
  let initial: React.ComponentProps<typeof QuotationForm>["initial"];
  if (params.fromInquiryId) {
    const inquiry = await db.query.inquiries.findFirst({ where: eq(inquiries.id, params.fromInquiryId) });
    if (inquiry && inquiry.status !== "converted") {
      sourceInquiryId = inquiry.id;
      initial = {
        clientName: inquiry.name,
        phone: inquiry.phone,
        email: inquiry.email ?? undefined,
        eventType: inquiry.eventType ?? undefined,
        eventDatePref: inquiry.preferredDate ?? undefined,
        eventSlotPref: inquiry.preferredSlot === "day" || inquiry.preferredSlot === "night" ? inquiry.preferredSlot : undefined,
        guestCount: inquiry.guestEstimate ?? undefined,
      };
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New Quotation</h1>
      <QuotationForm
        services={services}
        taxesAvailable={taxesAvailable}
        settings={settings}
        sourceInquiryId={sourceInquiryId}
        initial={initial}
      />
    </div>
  );
}
