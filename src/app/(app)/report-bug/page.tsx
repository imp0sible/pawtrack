"use client";

import { useRef, useState } from "react";
import { Bug, ImagePlus, X, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { fileToDataUrl } from "@/lib/image";
import { useT } from "@/lib/i18n/react";

const MAX_SHOTS = 4;

export default function ReportBugPage() {
  const t = useT();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shots, setShots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = trpc.bug.create.useMutation({
    onSuccess: () => setDone(true),
    onError: (e) => setError(e.message),
  });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const room = MAX_SHOTS - shots.length;
      const added = await Promise.all(files.slice(0, room).map((f) => fileToDataUrl(f)));
      setShots((prev) => [...prev, ...added].slice(0, MAX_SHOTS));
    } catch {
      setError("Couldn't process that image.");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate({ title: title.trim(), description: description.trim(), screenshots: shots.length ? shots : undefined });
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--brand)]" />
          <p className="mt-3 font-semibold">{t("bug.submitted")}</p>
          <button
            className="btn-ghost mt-4"
            onClick={() => {
              setTitle("");
              setDescription("");
              setShots([]);
              setDone(false);
            }}
          >
            {t("bug.submitAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bug className="h-6 w-6 text-[var(--brand)]" /> {t("bug.title")}
        </h1>
        <p className="text-sm text-[var(--muted)]">{t("bug.subtitle")}</p>
      </div>

      <form className="card space-y-4 p-5" onSubmit={submit}>
        <div>
          <label className="label">{t("bug.titleLabel")}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("bug.titlePlaceholder")} maxLength={140} />
        </div>
        <div>
          <label className="label">{t("bug.descLabel")}</label>
          <textarea
            className="input min-h-32"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("bug.descPlaceholder")}
            maxLength={4000}
          />
        </div>
        <div>
          <label className="label">{t("bug.screenshots")}</label>
          <div className="flex flex-wrap gap-3">
            {shots.map((src, i) => (
              <div key={i} className="relative h-24 w-24 overflow-hidden rounded-xl border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setShots((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {shots.length < MAX_SHOTS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50"
              >
                <ImagePlus className="h-6 w-6" />
                {busy ? "…" : t("report.addPhoto")}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
        </div>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        <div className="flex justify-end">
          <button className="btn-primary" type="submit" disabled={create.isPending || title.trim().length < 3 || description.trim().length < 5}>
            {create.isPending ? t("bug.submitting") : t("bug.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
