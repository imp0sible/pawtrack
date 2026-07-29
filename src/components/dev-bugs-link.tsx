"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";

// Developer-only top-bar button linking to the bug inbox, with an open-count badge.
export function DevBugsLink() {
  const t = useT();
  const open = trpc.bug.openCount.useQuery(undefined, { refetchInterval: 60000 });
  const count = open.data ?? 0;

  return (
    <Link
      href="/bugs"
      title={t("nav.reportedBugs")}
      aria-label={t("nav.reportedBugs")}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]"
    >
      <ListChecks className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
