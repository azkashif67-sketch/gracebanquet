import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/require-role";
import { getInquiryDetail } from "@/lib/db/queries/inquiries";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { checkAvailability } from "@/lib/db/operations";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { DeleteInquiryButton } from "@/components/inquiries/delete-inquiry-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MarkContactedForm,
  AddNoteForm,
  CloseInquiryForm,
} from "@/components/inquiries/inquiry-detail-actions";

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const detail = await getInquiryDetail(id);
  if (!detail) notFound();

  // Opening the record marks it read (spec §11.3).
  if (detail.inquiry.status === "new") {
    await db.update(inquiries).set({ status: "read" }).where(eq(inquiries.id, id));
    detail.inquiry.status = "read";
  }

  const { inquiry, notes } = detail;
  const canConvert = user.role === "admin" || user.role === "manager";

  const settings = await getVenueSettings();

  let availability: Awaited<ReturnType<typeof checkAvailability>> | null = null;
  if (inquiry.preferredDate && (inquiry.preferredSlot === "day" || inquiry.preferredSlot === "night")) {
    availability = await checkAvailability({
      eventDate: inquiry.preferredDate,
      eventSlot: inquiry.preferredSlot,
      hallSection: settings.halls[0] ?? "Main Hall",
    });
  }

  const canAct = inquiry.status !== "converted" && inquiry.status !== "closed";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{inquiry.name}</h1>
          <Badge className="capitalize">{inquiry.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {canConvert && canAct && (
            <>
              <Button
                variant="outline"
                render={<Link href={`/quotations/new?fromInquiryId=${id}`}>Convert to Quotation</Link>}
              />
              <Button render={<Link href={`/bookings/new?fromInquiryId=${id}`}>Convert to Booking</Link>} />
            </>
          )}
          {canConvert && (
            <DeleteInquiryButton id={id} name={inquiry.name} redirectTo="/inquiries" />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p>{inquiry.phone}</p>
          {inquiry.email && <p>{inquiry.email}</p>}
          {inquiry.eventType && <p className="capitalize">Type: {inquiry.eventType}</p>}
          <p>
            Preferred: {inquiry.preferredDate ?? "no date given"}
            {inquiry.preferredSlot ? ` · ${inquiry.preferredSlot}` : ""}
          </p>
          {inquiry.guestEstimate && <p>Est. guests: {inquiry.guestEstimate}</p>}
          <p className="mt-2 whitespace-pre-wrap">{inquiry.message}</p>
          {inquiry.closeReason && (
            <p className="text-muted-foreground">Closed: {inquiry.closeReason}</p>
          )}
        </CardContent>
      </Card>

      {availability && (
        <div
          className={`rounded-md border p-3 text-sm ${
            availability.available
              ? "border-green-400 bg-green-50 dark:bg-green-950"
              : "border-destructive bg-red-50 dark:bg-red-950/30"
          }`}
        >
          {availability.available ? (
            <>✓ {inquiry.preferredDate}, {inquiry.preferredSlot} — Available</>
          ) : (
            <>
              ✗ {inquiry.preferredDate}, {inquiry.preferredSlot} — Occupied (
              {availability.conflicts.map((c) => c.invoiceNo).join(", ")})
            </>
          )}
        </div>
      )}

      {canAct && (
        <div className="flex flex-wrap items-end gap-4">
          <MarkContactedForm id={id} />
          <CloseInquiryForm id={id} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {notes.map((n) => (
            <div key={n.id} className="border-b pb-2 text-sm last:border-0">
              <p>{n.note}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(n.createdAt * 1000).toLocaleString("en-PK")}
              </p>
            </div>
          ))}
          {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          <AddNoteForm id={id} />
        </CardContent>
      </Card>
    </div>
  );
}
