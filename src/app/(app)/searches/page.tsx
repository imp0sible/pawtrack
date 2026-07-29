"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { SearchCard } from "@/components/search-card";
import { useT } from "@/lib/i18n/react";

export default function MySearchesPage() {
  const t = useT();
  const q = trpc.search.mySearches.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("searches.title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("searches.subtitle")}</p>
      </div>

      {q.isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="card h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t("searches.active", { count: q.data?.active.length ?? 0 })}
            </h2>
            {q.data && q.data.active.length > 0 ? (
              q.data.active.map((card) => <SearchCard key={card.id} card={card} expanded />)
            ) : (
              <div className="card p-8 text-center text-sm text-[var(--muted)]">
                {t("searches.emptyActive")}{" "}
                <Link href="/" className="font-semibold text-[var(--brand-strong)] hover:underline">
                  {t("searches.browse")}
                </Link>
              </div>
            )}
          </section>

          {q.data && q.data.archived.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t("searches.archive", { count: q.data.archived.length })}
              </h2>
              <p className="-mt-2 flex items-center gap-1 text-xs text-[var(--muted)]">
                <Lock className="h-3.5 w-3.5" /> {t("searches.archiveNote")}
              </p>
              {q.data.archived.map((card) => (
                <SearchCard key={card.id} card={card} expanded />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
