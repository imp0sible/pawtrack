"use client";

import Link from "next/link";
import { MapPin, Users, Eye, Navigation, Clock, Phone, PawPrint } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { StatusBadge } from "@/components/status-badge";
import { formatDistance } from "@/lib/geo";
import { timeAgo } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useT } from "@/lib/i18n/react";

export interface SearchCardData {
  id: string;
  status: string;
  startedAt: Date;
  lastSeenAt: Date | null;
  lastSeenAddress: string | null;
  participantCount: number;
  sightingCount: number;
  isParticipant: boolean;
  distanceMeters: number | null;
  dog: {
    id: string;
    name: string;
    breed: string | null;
    color: string | null;
    size: string | null;
    status: string;
    description: string | null;
    photos: string[];
    contactPhone: string | null;
    ownerName: string;
    ownerUsername: string | null;
  };
}

export function SearchCard({ card, expanded = false }: { card: SearchCardData; expanded?: boolean }) {
  const t = useT();
  const utils = trpc.useUtils();
  const join = trpc.search.join.useMutation({
    onSuccess: () => {
      utils.search.feed.invalidate();
      utils.search.mySearches.invalidate();
    },
  });

  const photo = card.dog.photos[0];

  return (
    <div className="card card-interactive overflow-hidden">
      <div className={expanded ? "sm:flex" : ""}>
        <Link
          href={`/dogs/${card.dog.id}`}
          className={`block shrink-0 bg-[var(--brand-soft)] ${expanded ? "sm:w-56" : ""}`}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={card.dog.name}
              className={`w-full object-cover ${expanded ? "h-full max-h-56 sm:max-h-none" : "h-44"}`}
            />
          ) : (
            <div className={`flex items-center justify-center ${expanded ? "h-full min-h-44" : "h-44"}`}>
              <PawPrint className="h-12 w-12 text-[var(--brand)] opacity-40" />
            </div>
          )}
        </Link>

        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link href={`/dogs/${card.dog.id}`} className="text-lg font-bold hover:underline">
                {card.dog.name}
              </Link>
              <p className="text-sm text-[var(--muted)]">
                {[card.dog.breed, card.dog.color].filter(Boolean).join(" · ") || t("dog.unknown")}
              </p>
            </div>
            <StatusBadge status={card.dog.status} />
          </div>

          {card.dog.description && (
            <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{card.dog.description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {card.lastSeenAddress ?? t("dog.locationOnMap")}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t("card.searching", { count: card.participantCount })}</span>
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {t("card.sightings", { count: card.sightingCount })}</span>
            {card.distanceMeters != null && <span className="flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> {formatDistance(card.distanceMeters)}</span>}
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {timeAgo(card.lastSeenAt ?? card.startedAt)}</span>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Link href={`/dogs/${card.dog.id}`} className="btn-primary flex-1 text-center">
              {t("card.open")}
            </Link>
            {card.dog.contactPhone && (
              <a href={`tel:${card.dog.contactPhone}`} className="btn-ghost inline-flex items-center" title={formatPhone(card.dog.contactPhone)}>
                <Phone className="h-4 w-4" />
              </a>
            )}
            {card.status === "ACTIVE" &&
              (card.isParticipant ? (
                <span className="chip chip-active">✓</span>
              ) : (
                <button
                  className="btn-ghost"
                  onClick={() => join.mutate({ searchId: card.id })}
                  disabled={join.isPending}
                >
                  {join.isPending ? t("dog.joining") : t("dog.join")}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
