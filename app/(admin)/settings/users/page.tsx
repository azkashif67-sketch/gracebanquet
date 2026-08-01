import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db";
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

export default async function UsersPage() {
  await requireRole("admin");
  const rows = await db.query.users.findMany({ orderBy: (u, { asc }) => [asc(u.fullName)] });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button render={<Link href="/settings/users/new">Add user</Link>} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Full Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.fullName}</TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell className="capitalize">{u.role}</TableCell>
              <TableCell>
                <Badge variant={u.active ? "default" : "secondary"}>{u.active ? "Active" : "Inactive"}</Badge>
              </TableCell>
              <TableCell>{u.lastLogin ? new Date(u.lastLogin * 1000).toLocaleString("en-PK") : "—"}</TableCell>
              <TableCell>{new Date(u.createdAt * 1000).toLocaleDateString("en-PK")}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" render={<Link href={`/settings/users/${u.id}/edit`}>Edit</Link>} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
