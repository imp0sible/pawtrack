"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";

// Developer-only top-bar button linking to the reported-listings queue, with an
// open-count badge.
export function DevReportsLink() {
  const t = useT();
  const open = trpc.moderation.openCount.useQuery(undefined, { refetchInterval: 60000 });
  const count = open.data ?? 0;

  return (
    <Link
      href="/reports"
      title={t("nav.reports")}
      aria-label={t("nav.reports")}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]"
    >
      <Flag className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
