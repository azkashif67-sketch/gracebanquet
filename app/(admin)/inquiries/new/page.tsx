import { requireAuth } from "@/lib/auth/require-role";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { InquiryForm } from "@/components/inquiries/inquiry-form";

export default async function NewInquiryPage() {
  await requireAuth();
  const settings = await getVenueSettings();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Log Inquiry</h1>
      <InquiryForm settings={settings} />
    </div>
  );
}
