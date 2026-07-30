"use client";

import { useEffect, useState } from "react";
import { Link2, Check, Share2 } from "lucide-react";
import { useT } from "@/lib/i18n/react";

// The shareable link for a search. Works for any listing, and is the primary
// call to action while a listing is still unlisted (awaiting review).
export function ShareSearch({ url, dogName }: { url: string; dogName: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // navigator.share is mobile-mostly; only offer it when it exists.
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is visible for manual copying */
    }
  }

  async function share() {
    try {
      await navigator.share({ title: dogName, text: `Help find ${dogName}`, url });
    } catch {
      /* user dismissed the share sheet */
    }
  }

  return (
    <div className="card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Link2 className="h-4 w-4 text-[var(--brand)]" /> {t("share.title")}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
          {url}
        </code>
        <button className="btn-primary inline-flex items-center gap-1.5" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {copied ? t("share.copied") : t("share.copy")}
        </button>
        {canShare && (
          <button className="btn-ghost inline-flex items-center gap-1.5" onClick={share}>
            <Share2 className="h-4 w-4" /> {t("share.share")}
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-[var(--muted)]">{t("share.hint")}</p>
    </div>
  );
}
