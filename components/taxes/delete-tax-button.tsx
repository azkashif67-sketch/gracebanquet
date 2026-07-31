"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteOrDeactivateTax } from "@/app/(admin)/taxes/actions";

export function DeleteTaxButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm(`Delete or deactivate "${name}"?`)) return;
    setPending(true);
    const result = await deleteOrDeactivateTax(id);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.deactivated ? `"${name}" deactivated (in use on past bookings)` : `"${name}" deleted`);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      Delete
    </Button>
  );
}
