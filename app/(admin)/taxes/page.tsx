import { requireRole } from "@/lib/auth/require-role";
import { listAllTaxes } from "@/lib/db/queries/taxes";
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
import { TaxFormDialog } from "@/components/taxes/tax-form-dialog";
import { DeleteTaxButton } from "@/components/taxes/delete-tax-button";

const TYPE_LABELS: Record<string, string> = {
  sales_tax: "Sales Tax",
  service_charge: "Service Charge",
  other: "Other",
};

export default async function TaxesPage() {
  const user = await requireRole("admin", "manager");
  const isAdmin = user.role === "admin";
  const rows = await listAllTaxes();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Taxes</h1>
        {isAdmin && (
          <TaxFormDialog trigger={<Button>Add tax</Button>} />
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Default</TableHead>
            <TableHead>Status</TableHead>
            {isAdmin && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((tax) => (
            <TableRow key={tax.id}>
              <TableCell>{tax.name}</TableCell>
              <TableCell>{TYPE_LABELS[tax.type] ?? tax.type}</TableCell>
              <TableCell>{(tax.rate / 100).toFixed(2)}%</TableCell>
              <TableCell>{tax.isDefault ? <Badge>Default</Badge> : null}</TableCell>
              <TableCell>
                <Badge variant={tax.active ? "default" : "secondary"}>
                  {tax.active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              {isAdmin && (
                <TableCell className="flex justify-end gap-2">
                  <TaxFormDialog
                    trigger={<Button variant="outline" size="sm">Edit</Button>}
                    taxId={tax.id}
                    initial={{
                      name: tax.name,
                      type: tax.type as "sales_tax" | "service_charge" | "other",
                      ratePercent: tax.rate / 100,
                      isDefault: tax.isDefault === 1,
                      active: tax.active === 1,
                    }}
                  />
                  <DeleteTaxButton id={tax.id} name={tax.name} />
                </TableCell>
              )}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground">
                No taxes yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
