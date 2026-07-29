"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, Lock, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { timeAgo } from "@/lib/format";
import { useT } from "@/lib/i18n/react";
import type { MessageKey } from "@/lib/i18n/messages";

type StatusFilter = "OPEN" | "REVIEWED" | "DISMISSED" | "ALL";

export default function ReportsPage() {
  const t = useT();
  const me = trpc.user.me.useQuery();
  const [filter, setFilter] = useState<StatusFilter>("OPEN");
  const list = trpc.moderation.listAll.useQuery({ status: filter }, { enabled: me.data?.isDeveloper === true });
  const utils = trpc.useUtils();
  const resolve = trpc.moderation.resolve.useMutation({
    onSuccess: () => {
      utils.moderation.listAll.invalidate();
      utils.moderation.openCount.invalidate();
    },
  });

  if (me.data && !me.data.isDeveloper) {
    return (
      <div className="card p-10 text-center">
        <Lock className="mx-auto h-10 w-10 text-[var(--muted)]" />
        <p className="mt-2 font-semibold">Developers only</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Flag className="h-6 w-6 text-[var(--brand)]" /> {t("reports.title")}
        </h1>
        <p className="text-sm text-[var(--muted)]">{t("reports.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["OPEN", "REVIEWED", "DISMISSED", "ALL"] as StatusFilter[]).map((f) => (
          <button key={f} className={`chip ${filter === f ? "chip-active" : ""}`} onClick={() => setFilter(f)}>
            {t(`reports.filter.${f}` as MessageKey)}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="card h-40 animate-pulse" />
      ) : list.data && list.data.length > 0 ? (
        list.data.map((r) => (
          <div key={r.id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="badge bg-[var(--danger)] text-white">
                    {t(`reportListing.reason.${r.reason}` as MessageKey)}
                  </span>
                  <Link href={`/dogs/${r.listing.dogId}`} className="font-semibold hover:underline">
                    {r.listing.dogName}
                  </Link>
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {t("reports.reportedBy", { name: r.reporter.name })}
                  {r.reporter.username ? ` (@${r.reporter.username})` : ""} · {timeAgo(r.createdAt)} · {r.status}
                </p>
              </div>
              <Link href={`/dogs/${r.listing.dogId}`} className="btn-ghost !py-1 text-xs inline-flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> {t("reports.viewListing")}
              </Link>
            </div>

            {r.note && <p className="whitespace-pre-wrap rounded-xl bg-[var(--background)] p-3 text-sm">{r.note}</p>}

            <div className="flex flex-wrap gap-2">
              {r.status !== "REVIEWED" && (
                <button className="btn-ghost !py-1 text-xs" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, status: "REVIEWED" })}>
                  {t("reports.markReviewed")}
                </button>
              )}
              {r.status !== "DISMISSED" && (
                <button className="btn-ghost !py-1 text-xs" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, status: "DISMISSED" })}>
                  {t("reports.dismiss")}
                </button>
              )}
              {r.status !== "OPEN" && (
                <button className="btn-ghost !py-1 text-xs" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, status: "OPEN" })}>
                  {t("reports.reopen")}
                </button>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="card p-10 text-center text-sm text-[var(--muted)]">{t("reports.empty")}</div>
      )}
    </div>
  );
}
