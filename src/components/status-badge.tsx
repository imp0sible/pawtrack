"use client";

import type { DogStatus } from "@/lib/constants";
import { useT } from "@/lib/i18n/react";
import type { MessageKey } from "@/lib/i18n/messages";

const STYLES: Record<string, string> = {
  LOST: "bg-[var(--danger)] text-white",
  FOUND: "bg-[var(--brand)] text-white",
  HOME: "bg-[var(--brand)] text-white",
  ACTIVE: "bg-[var(--danger)] text-white",
  ARCHIVED: "bg-[var(--muted)] text-white",
  // Review states for a submitted listing.
  PENDING: "bg-[var(--accent)] text-black",
  REJECTED: "bg-[var(--muted)] text-white",
};

export function StatusBadge({ status }: { status: DogStatus | string }) {
  const t = useT();
  const className = STYLES[status] ?? "bg-[var(--muted)] text-white";
  const key = `status.${status}` as MessageKey;
  const label = STYLES[status] ? t(key) : status;
  return <span className={`badge ${className}`}>{label}</span>;
}
