import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-role";
import { listBookings } from "@/lib/db/queries/bookings";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { formatPKR } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteBookingDialog } from "@/components/bookings/delete-booking-dialog";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  confirmed: "default",
  tentative: "secondary",
  completed: "secondary",
  cancelled: "destructive",
  draft: "secondary",
};

export default async function BookingsPage() {
  const user = await requireAuth();
  const showMoney = user.role !== "staff";
  const isAdmin = user.role === "admin";
  const [rows, settings] = await Promise.all([listBookings(), getVenueSettings()]);

  // With a single hall the column is the same value on every row — noise.
  const showHall = settings.halls.length > 1;
  const showActions = user.role === "admin" || user.role === "manager";

  const columnCount =
    6 + (showHall ? 1 : 0) + (showMoney ? 2 : 0) + (showActions ? 1 : 0) - 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <Button render={<Link href="/bookings/new">New Booking</Link>} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Event Date</TableHead>
            <TableHead>Slot</TableHead>
            {showHall && <TableHead>Hall</TableHead>}
            <TableHead>Guests</TableHead>
            {showMoney && <TableHead>Total</TableHead>}
            {showMoney && <TableHead>Balance</TableHead>}
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => {
            const isCancelled = b.status === "cancelled";
            const canEdit =
              !isCancelled && (isAdmin || (user.role === "manager" && b.createdBy === user.id));
            return (
              <TableRow
                key={b.id}
                className={
                  b.balanceDue > 0 && showMoney && !isCancelled
                    ? "bg-red-50 dark:bg-red-950/20"
                    : ""
                }
              >
                <TableCell>
                  <Link href={`/bookings/${b.id}`} className="text-primary hover:underline">
                    {b.invoiceNo ?? "(draft)"}
                  </Link>
                </TableCell>
                <TableCell>
                  {b.clientName}
                  <div className="text-xs text-muted-foreground">{b.phone}</div>
                </TableCell>
                <TableCell>{b.eventDate}</TableCell>
                <TableCell className="capitalize">{b.eventSlot}</TableCell>
                {showHall && <TableCell>{b.hallSection}</TableCell>}
                <TableCell>{b.guestCount}</TableCell>
                {showMoney && <TableCell>{formatPKR(b.grandTotal)}</TableCell>}
                {showMoney && <TableCell>{formatPKR(b.balanceDue)}</TableCell>}
                <TableCell>
                  <Badge variant={STATUS_VARIANT[b.status] ?? "secondary"} className="capitalize">
                    {b.status}
                  </Badge>
                </TableCell>
                {showActions && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href={`/bookings/${b.id}/edit`}>Edit</Link>}
                        />
                      )}
                      {isAdmin && (
                        <DeleteBookingDialog bookingId={b.id} invoiceNo={b.invoiceNo} />
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columnCount} className="text-center text-muted-foreground">
                No bookings yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
