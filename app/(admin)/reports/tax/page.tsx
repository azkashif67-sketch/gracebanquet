import { requireRole } from "@/lib/auth/require-role";
import { getForfeitedAdvances, getTaxReport } from "@/lib/db/queries/reports";
import { getVenueSettings } from "@/lib/db/queries/settings";
import { formatPKR } from "@/lib/calculations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function TaxReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const [rows, forfeited, venue] = await Promise.all([
    getTaxReport(params.from, params.to),
    getForfeitedAdvances(params.from, params.to),
    getVenueSettings(),
  ]);

  const totalTaxable = new Set(rows.map((r) => r.invoiceNo)).size
    ? rows.reduce((acc, r, i, arr) => {
        // Sum taxable_amount once per invoice, not once per tax line.
        const firstIndexForInvoice = arr.findIndex((x) => x.invoiceNo === r.invoiceNo);
        return firstIndexForInvoice === i ? acc + r.taxableAmount : acc;
      }, 0)
    : 0;
  const totalTaxCollected = rows.reduce((s, r) => s + r.taxAmount, 0);
  const invoiceCount = new Set(rows.map((r) => r.invoiceNo)).size;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Monthly Tax Report</h1>
        <p className="text-sm text-muted-foreground">
          {venue.venueName || "Grace Banquet"} · NTN: {venue.ntn || "—"}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">From</label>
          <Input type="date" name="from" defaultValue={params.from} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted-foreground">To</label>
          <Input type="date" name="to" defaultValue={params.to} />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Taxable Value</p>
            <p className="text-lg font-semibold">{formatPKR(totalTaxable)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Tax Collected</p>
            <p className="text-lg font-semibold">{formatPKR(totalTaxCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Taxable Invoices</p>
            <p className="text-lg font-semibold">{invoiceCount}</p>
          </CardContent>
        </Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice No</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Client Name</TableHead>
            <TableHead>CNIC</TableHead>
            <TableHead>Tax</TableHead>
            <TableHead>Taxable Value</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Tax Amount</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.invoiceNo}-${i}`}>
              <TableCell>{r.invoiceNo}</TableCell>
              <TableCell>{new Date(r.createdAt * 1000).toLocaleDateString("en-PK")}</TableCell>
              <TableCell>{r.clientName}</TableCell>
              <TableCell>{r.cnic ?? "—"}</TableCell>
              <TableCell>{r.taxName}</TableCell>
              <TableCell>{formatPKR(r.taxableAmount)}</TableCell>
              <TableCell>{(r.rate / 100).toFixed(2)}%</TableCell>
              <TableCell>{formatPKR(r.taxAmount)}</TableCell>
              <TableCell>{formatPKR(r.grandTotal)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                No taxable invoices in this period.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {forfeited.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">Forfeited Advances (Other Income)</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount Forfeited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forfeited.map((f, i) => (
                <TableRow key={i}>
                  <TableCell>{f.invoiceNo}</TableCell>
                  <TableCell>{f.clientName}</TableCell>
                  <TableCell>{formatPKR(f.amountPaid)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ul className="list-inside list-disc text-xs text-muted-foreground">
        <li>Cancelled invoices excluded.</li>
        <li>Forfeited advances shown separately as other income.</li>
        <li>Figures are on an invoice-issued basis.</li>
      </ul>
    </div>
  );
}
