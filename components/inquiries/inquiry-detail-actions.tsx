"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { markContacted, addInquiryNote, closeInquiry } from "@/app/(admin)/inquiries/actions";

const CLOSE_REASONS = ["Not Interested", "Date Unavailable", "Price", "No Response"] as const;

export function MarkContactedForm({ id }: { id: string }) {
  const router = useRouter();
  const [followUpDate, setFollowUpDate] = useState("");
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await markContacted(id, followUpDate || undefined);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Marked contacted.");
    router.refresh();
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Follow-up date</label>
        <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
      </div>
      <Button variant="outline" onClick={handleClick} disabled={pending}>
        Mark Contacted
      </Button>
    </div>
  );
}

export function AddNoteForm({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await addInquiryNote(id, note);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
      <Button type="submit" variant="outline" size="sm" className="self-start" disabled={pending}>
        Add Note
      </Button>
    </form>
  );
}

export function CloseInquiryForm({ id }: { id: string }) {
  const router = useRouter();
  const [reason, setReason] = useState<string>("");
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!reason) {
      toast.error("Pick a close reason.");
      return;
    }
    setPending(true);
    const result = await closeInquiry(id, reason);
    setPending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Inquiry closed.");
    router.refresh();
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Close reason</label>
        <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {CLOSE_REASONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" onClick={handleClick} disabled={pending}>
        Close
      </Button>
    </div>
  );
}
