"use client";

import { useState } from "react";
import { Flag, X, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";
import { USER_REPORT_REASONS } from "@/lib/constants";
import type { MessageKey } from "@/lib/i18n/messages";

type Reason = (typeof USER_REPORT_REASONS)[number];

export function ReportUser({ userId }: { userId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("HARASSMENT");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const report = trpc.moderation.reportUser.useMutation({ onSuccess: () => setDone(true) });

  function close() {
    setOpen(false);
    setTimeout(() => {
      setDone(false);
      setReason("HARASSMENT");
      setNote("");
      report.reset();
    }, 200);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--danger)]"
      >
        <Flag className="h-3.5 w-3.5" /> {t("reportUser.button")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">{t("reportUser.title")}</h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{t("reportUser.subtitle")}</p>
              </div>
              <button onClick={close} className="text-[var(--muted)] hover:text-[var(--foreground)]" aria-label={t("common.cancel")}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {done ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--brand)]" />
                <p className="mt-2 text-sm">{t("reportUser.submitted")}</p>
                <button className="btn-primary mt-4" onClick={close}>{t("common.back")}</button>
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  report.mutate({ userId, reason, note: note.trim() || undefined });
                }}
              >
                <div>
                  <label className="label">{t("reportUser.reason")}</label>
                  <div className="space-y-1.5">
                    {USER_REPORT_REASONS.map((r) => (
                      <label key={r} className="flex cursor-pointer items-center gap-2.5 text-sm">
                        <input
                          type="radio"
                          name="user-reason"
                          value={r}
                          checked={reason === r}
                          onChange={() => setReason(r)}
                          className="accent-[var(--brand)]"
                        />
                        {t(`reportUser.reason.${r}` as MessageKey)}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">{t("reportUser.note")}</label>
                  <textarea
                    className="input min-h-20 resize-y"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("reportUser.notePlaceholder")}
                    maxLength={1000}
                  />
                </div>
                {report.error && <p className="text-sm text-[var(--danger)]">{report.error.message}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-ghost" onClick={close}>{t("common.cancel")}</button>
                  <button type="submit" className="btn-danger" disabled={report.isPending}>
                    {report.isPending ? t("reportListing.submitting") : t("reportUser.submit")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
