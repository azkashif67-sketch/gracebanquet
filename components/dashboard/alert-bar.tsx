"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface AlertPill {
  id: string;
  color: "red" | "amber" | "blue" | "orange" | "grey";
  text: string;
  href: string;
}

const COLOR_CLASSES: Record<AlertPill["color"], string> = {
  red: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  blue: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  orange: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  grey: "bg-muted text-muted-foreground",
};

const STORAGE_KEY = "dashboard_dismissed_alerts";

export function AlertBar({ pills }: { pills: AlertPill[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setDismissed(new Set(JSON.parse(raw)));
    } catch {
      // ignore
    }
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const visible = pills.filter((p) => !dismissed.has(p.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${COLOR_CLASSES[p.color]}`}
        >
          <Link href={p.href} className="hover:underline">
            {p.text}
          </Link>
          <button
            type="button"
            onClick={() => dismiss(p.id)}
            className="text-xs opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
