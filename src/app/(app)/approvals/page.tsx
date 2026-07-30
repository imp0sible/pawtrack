"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Lock, ExternalLink, Check, X, ScanLine, Phone, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { timeAgo } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useT } from "@/lib/i18n/react";
import type { MessageKey } from "@/lib/i18n/messages";

type Tab = "PENDING" | "REJECTED";

export default function ApprovalsPage() {
  const t = useT();
  const me = trpc.user.me.useQuery();
  const [tab, setTab] = useState<Tab>("PENDING");
  const list = trpc.moderation.listPending.useQuery(
    { status: tab },
    { enabled: me.data?.isDeveloper === true }
  );
  const utils = trpc.useUtils();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const review = trpc.moderation.reviewSearch.useMutation({
    onSuccess: () => {
      utils.moderation.listPending.invalidate();
      utils.moderation.pendingCount.invalidate();
      utils.search.feed.invalidate();
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
          <ClipboardCheck className="h-6 w-6 text-[var(--brand)]" /> {t("review.title")}
        </h1>
        <p className="text-sm text-[var(--muted)]">{t("review.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["PENDING", "REJECTED"] as Tab[]).map((s) => (
          <button key={s} className={`chip ${tab === s ? "chip-active" : ""}`} onClick={() => setTab(s)}>
            {s === "PENDING" ? t("review.tabPending") : t("review.tabRejected")}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="card h-48 animate-pulse" />
      ) : list.data && list.data.length > 0 ? (
        list.data.map((s) => (
          <div key={s.searchId} className="card space-y-3 p-5">
            <div className="flex flex-wrap gap-4">
              {s.dog.photos[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.dog.photos[0]}
                  alt={s.dog.name}
                  className="h-28 w-28 shrink-0 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/dogs/${s.dogId}`} className="text-lg font-bold hover:underline">
                    {s.dog.name}
                  </Link>
                  <span className="badge bg-[var(--border)] text-[var(--muted)]">
                    {t(`status.${s.status}` as MessageKey)}
                  </span>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  {[s.dog.breed, s.dog.color, s.dog.size ? t(`report.size${s.dog.size}` as MessageKey) : null]
                    .filter(Boolean)
                    .join(" · ") || t("dog.unknown")}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {t("review.by", { name: s.owner.name })}
                  {s.owner.username ? ` (@${s.owner.username})` : ""} · {timeAgo(s.startedAt)}
                </p>
                {s.lastSeenAddress && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
                    <MapPin className="h-3.5 w-3.5" /> {s.lastSeenAddress}
                  </p>
                )}
                {s.dog.chipNumber && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
                    <ScanLine className="h-3.5 w-3.5" /> {t("review.chip")}: <span className="font-mono">{s.dog.chipNumber}</span>
                  </p>
                )}
                {s.dog.contactPhone && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
                    <Phone className="h-3.5 w-3.5" /> {formatPhone(s.dog.contactPhone)}
                  </p>
                )}
              </div>
              <Link href={`/dogs/${s.dogId}`} className="btn-ghost !py-1 inline-flex items-center gap-1.5 self-start text-xs">
                <ExternalLink className="h-3.5 w-3.5" /> {t("reports.viewListing")}
              </Link>
            </div>

            {s.dog.description && (
              <p className="whitespace-pre-wrap rounded-xl bg-[var(--background)] p-3 text-sm">{s.dog.description}</p>
            )}

            {s.reviewNote && (
              <p className="text-xs text-[var(--muted)]">
                <span className="font-medium">{t("pending.reviewNote")}:</span> {s.reviewNote}
              </p>
            )}

            {s.dog.photos.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {s.dog.photos.slice(1).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ))}
              </div>
            )}

            <div>
              <label className="label">{t("review.note")}</label>
              <input
                className="input"
                value={notes[s.searchId] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [s.searchId]: e.target.value }))}
                placeholder={t("review.notePlaceholder")}
                maxLength={500}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="btn-primary inline-flex items-center gap-1.5"
                disabled={review.isPending}
                onClick={() => review.mutate({ searchId: s.searchId, decision: "APPROVE", note: notes[s.searchId]?.trim() || undefined })}
              >
                <Check className="h-4 w-4" /> {review.isPending ? t("review.reviewing") : t("review.approve")}
              </button>
              {s.status !== "REJECTED" && (
                <button
                  className="btn-danger inline-flex items-center gap-1.5"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ searchId: s.searchId, decision: "REJECT", note: notes[s.searchId]?.trim() || undefined })}
                >
                  <X className="h-4 w-4" /> {t("review.reject")}
                </button>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="card p-10 text-center text-sm text-[var(--muted)]">{t("review.empty")}</div>
      )}
    </div>
  );
}
