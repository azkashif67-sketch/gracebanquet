import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-role";
import { listClients } from "@/lib/db/queries/clients";
import { formatPKR } from "@/lib/calculations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ClientsPage() {
  await requireAuth();
  const rows = await listClients();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Clients</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Bookings</TableHead>
            <TableHead>Lifetime Value</TableHead>
            <TableHead>Last Event</TableHead>
            <TableHead>Outstanding</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.phone} className={c.outstanding > 0 ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
              <TableCell>
                <Link href={`/clients/${encodeURIComponent(c.phone)}`} className="text-primary hover:underline">
                  {c.clientName}
                </Link>
              </TableCell>
              <TableCell>{c.phone}</TableCell>
              <TableCell>{c.bookingCount}</TableCell>
              <TableCell>{formatPKR(c.lifetimeValue)}</TableCell>
              <TableCell>{c.lastEvent}</TableCell>
              <TableCell>{formatPKR(c.outstanding)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No clients yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
