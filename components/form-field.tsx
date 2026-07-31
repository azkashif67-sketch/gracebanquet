"use client";

import { cloneElement, isValidElement, useId } from "react";
import { Label } from "@/components/ui/label";

// Shared label+input wrapper that wires `htmlFor`/`id` together so labels
// are programmatically associated with their control — required for
// accessibility (and for anything, including tests, that looks a field up
// by its label rather than by CSS selector).
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
    </div>
  );
}
