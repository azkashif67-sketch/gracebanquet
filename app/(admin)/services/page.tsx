import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { canManageServices } from "@/lib/auth/permissions";
import { listServices } from "@/lib/db/queries/services";
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
import { DeleteServiceButton } from "@/components/services/delete-service-button";

export default async function ServicesPage() {
  const user = await requireRole("admin");
  const canManage = canManageServices(user.role);
  const rows = await listServices();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Services</h1>
        {canManage && <Button render={<Link href="/services/new">Add service</Link>} />}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Pricing</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((svc) => (
            <TableRow key={svc.id}>
              <TableCell>
                {svc.name}
                {svc.isSystem === 1 && (
                  <div className="text-xs text-muted-foreground">
                    Charged on every booking — this rate is the default.
                  </div>
                )}
              </TableCell>
              <TableCell className="capitalize">{svc.category}</TableCell>
              <TableCell className="capitalize">{svc.pricingType.replace("_", " ")}</TableCell>
              <TableCell>{formatPKR(svc.rate)}</TableCell>
              <TableCell>
                <Badge variant={svc.active ? "default" : "secondary"}>
                  {svc.active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              {canManage && (
                <TableCell className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/services/${svc.id}/edit`}>Edit</Link>}
                  />
                  {/* Hall Rent can't be removed — see deleteOrDeactivateService. */}
                  {svc.isSystem !== 1 && <DeleteServiceButton id={svc.id} name={svc.name} />}
                </TableCell>
              )}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground">
                No services yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
