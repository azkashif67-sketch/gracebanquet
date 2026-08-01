"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setQuotationStatus, deleteQuotation } from "@/app/(admin)/quotations/actions";

export function QuotationStatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function handle(next: "sent" | "accepted" | "declined") {
    setPending(next);
    const result = await setQuotationStatus(id, next);
    setPending(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Marked as ${next}.`);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {status === "draft" && (
        <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => handle("sent")}>
          Mark Sent
        </Button>
      )}
      {(status === "draft" || status === "sent") && (
        <>
          <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => handle("accepted")}>
            Mark Accepted
          </Button>
          <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => handle("declined")}>
            Mark Declined
          </Button>
        </>
      )}
    </div>
  );
}

export function DeleteQuotationButton({ id, quoteNo }: { id: string; quoteNo: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm(`Delete quotation ${quoteNo}?`)) return;
    setPending(true);
    const result = await deleteQuotation(id);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Quotation deleted.");
    router.push("/quotations");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      Delete
    </Button>
  );
}
