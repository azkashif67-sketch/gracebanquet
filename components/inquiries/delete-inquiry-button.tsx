"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteInquiry } from "@/app/(admin)/inquiries/actions";

export function DeleteInquiryButton({
  id,
  name,
  redirectTo,
}: {
  id: string;
  name: string;
  /** Where to go afterwards — the detail page must navigate away. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm(`Delete the inquiry from ${name}? Use Close instead if this was a real lead.`)) {
      return;
    }
    setPending(true);
    const result = await deleteInquiry(id);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Inquiry deleted.");
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      Delete
    </Button>
  );
}
