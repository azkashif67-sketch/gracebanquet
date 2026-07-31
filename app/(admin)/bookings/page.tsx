import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-role";
import { listBookings } from "@/lib/db/queries/bookings";
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
  const rows = await listBookings();

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
            <TableHead>Hall</TableHead>
            <TableHead>Guests</TableHead>
            {showMoney && <TableHead>Total</TableHead>}
            {showMoney && <TableHead>Balance</TableHead>}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.id} className={b.balanceDue > 0 && showMoney ? "bg-red-50 dark:bg-red-950/20" : ""}>
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
              <TableCell>{b.hallSection}</TableCell>
              <TableCell>{b.guestCount}</TableCell>
              {showMoney && <TableCell>{formatPKR(b.grandTotal)}</TableCell>}
              {showMoney && <TableCell>{formatPKR(b.balanceDue)}</TableCell>}
              <TableCell>
                <Badge variant={STATUS_VARIANT[b.status] ?? "secondary"} className="capitalize">
                  {b.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={showMoney ? 9 : 7} className="text-center text-muted-foreground">
                No bookings yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
