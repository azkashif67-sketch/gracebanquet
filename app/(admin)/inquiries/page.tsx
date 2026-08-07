import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-role";
import { listInquiries } from "@/lib/db/queries/inquiries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteInquiryButton } from "@/components/inquiries/delete-inquiry-button";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  new: "default",
  read: "secondary",
  contacted: "secondary",
  converted: "default",
  closed: "destructive",
};

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const rows = await listInquiries({ status: params.status });

  // Staff log and follow up on leads but don't remove them.
  const canDelete = user.role === "admin" || user.role === "manager";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inquiries</h1>
        <Button render={<Link href="/inquiries/new">Log Inquiry</Link>} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Received</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Preferred Date</TableHead>
            <TableHead>Est. Guests</TableHead>
            <TableHead>Status</TableHead>
            {canDelete && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{new Date(r.receivedAt * 1000).toLocaleDateString("en-PK")}</TableCell>
              <TableCell className={r.status === "new" ? "font-bold" : ""}>
                <Link href={`/inquiries/${r.id}`} className="text-primary hover:underline">
                  {r.name}
                </Link>
              </TableCell>
              <TableCell>{r.phone}</TableCell>
              <TableCell>{r.preferredDate ?? "—"}</TableCell>
              <TableCell>{r.guestEstimate ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"} className="capitalize">
                  {r.status}
                </Badge>
              </TableCell>
              {canDelete && (
                <TableCell>
                  <div className="flex justify-end">
                    <DeleteInquiryButton id={r.id} name={r.name} />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canDelete ? 7 : 6} className="text-center text-muted-foreground">
                No inquiries yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
