"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteExpense } from "@/app/(admin)/expenses/actions";

export function DeleteExpenseButton({ id, description }: { id: string; description: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm(`Delete expense "${description}"?`)) return;
    setPending(true);
    const result = await deleteExpense(id);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Expense deleted.");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      Delete
    </Button>
  );
}
