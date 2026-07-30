"use client";

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";

// Developer-only top-bar button linking to the listing review queue, badged with
// how many listings are waiting.
export function DevApprovalsLink() {
  const t = useT();
  const pending = trpc.moderation.pendingCount.useQuery(undefined, { refetchInterval: 60000 });
  const count = pending.data ?? 0;

  return (
    <Link
      href="/approvals"
      title={t("nav.approvals")}
      aria-label={t("nav.approvals")}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]"
    >
      <ClipboardCheck className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-black">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
