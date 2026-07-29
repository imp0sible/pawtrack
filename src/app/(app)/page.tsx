"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, PawPrint, Heart, Camera } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { SearchCard } from "@/components/search-card";
import { useGeolocation } from "@/lib/use-geolocation";
import { SORT_MODES, type SortMode } from "@/lib/constants";
import { SharedMap } from "@/components/shared-map";
import { useT } from "@/lib/i18n/react";
import type { MessageKey } from "@/lib/i18n/messages";

const HONEY_NOTE =
  'This app was initially supposed to be called "Honey", the same way my dog\'s name is, this whole app exists only because one day that same dog ran away. And I created this app because I know what\'s it like when the pet you spent years with and love with all of your heart just rans away and you have no knowledge of where they are or if they are fine, I truly wish that every person in this world never feels that feeling, or at least feel it for as short as possible. For those reason this app is free and until it stops existing it will continue being free.';

export default function HomePage() {
  const t = useT();
  const [sort, setSort] = useState<SortMode>("START_TIME");
  const { loc, status, request } = useGeolocation(true);

  const feed = trpc.search.feed.useQuery({ sort, loc: loc ?? undefined });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("home.title")}</h1>
          <p className="text-sm text-[var(--muted)]">{t("home.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/found" className="btn-ghost inline-flex items-center gap-1.5">
            <Camera className="h-4 w-4" /> {t("nav.found")}
          </Link>
          <Link href="/report" className="btn-primary inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> {t("home.reportCta")}
          </Link>
        </div>
      </div>

      <SharedMap loc={loc} onRequestLocation={request} locationStatus={status} />

      {/* Sort controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t("home.sortBy")}</span>
        {SORT_MODES.map((mode) => {
          const needsLoc = mode === "LOSS_LOCATION" && !loc;
          return (
            <button
              key={mode}
              className={`chip ${sort === mode ? "chip-active" : ""}`}
              onClick={() => {
                if (needsLoc) request();
                setSort(mode);
              }}
            >
              {t(`home.sort.${mode}` as MessageKey)}
            </button>
          );
        })}
      </div>

      {/* Feed */}
      {feed.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-64 animate-pulse" />
          ))}
        </div>
      ) : feed.data && feed.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {feed.data.map((card) => (
            <SearchCard key={card.id} card={card} />
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center">
          <PawPrint className="mx-auto h-10 w-10 text-[var(--muted)]" />
          <p className="mt-2 font-semibold">{t("home.empty")}</p>
        </div>
      )}

      {/* Founder's note */}
      <div className="mx-auto max-w-2xl border-t border-[var(--border)] pt-8 pb-2 text-center">
        <Heart className="mx-auto h-6 w-6 text-[var(--brand)]" fill="currentColor" />
        <p className="mt-3 text-sm italic leading-relaxed text-[var(--muted)]">{HONEY_NOTE}</p>
      </div>
    </div>
  );
}
