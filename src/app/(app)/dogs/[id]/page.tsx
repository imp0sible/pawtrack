"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  MapPin, Clock, Users, Phone, MessageCircle, Printer, PartyPopper,
  Eye, Lock, PawPrint, ArrowLeft, Trash2, ScanLine, Languages, ShieldAlert,
} from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { SearchMap } from "@/components/search-map";
import { DogPoster } from "@/components/dog-poster";
import { ReportListing } from "@/components/report-listing";
import { StatusBadge } from "@/components/status-badge";
import { Avatar } from "@/components/avatar";
import { timeAgo, formatDuration } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { formatPhone } from "@/lib/phone";
import { useT, useI18n } from "@/lib/i18n/react";
import type { MessageKey } from "@/lib/i18n/messages";
import { LOCALE_NAMES, type Locale } from "@/lib/i18n/locales";
import { useAutoTranslate } from "@/lib/use-auto-translate";
import { embedImages, embeddingSupported } from "@/lib/embed";

const langName = (code: string | null) =>
  code ? (LOCALE_NAMES[code as Locale] ?? code) : "";

export default function DogDetailPage() {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const dogId = params.id;
  const [posterOpen, setPosterOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const utils = trpc.useUtils();
  const q = trpc.search.detail.useQuery({ dogId }, { retry: false });
  const me = trpc.user.me.useQuery();

  const join = trpc.search.join.useMutation({ onSuccess: () => utils.search.detail.invalidate() });
  const leave = trpc.search.leave.useMutation({ onSuccess: () => utils.search.detail.invalidate() });
  const archive = trpc.search.archive.useMutation({ onSuccess: () => utils.search.detail.invalidate() });
  const del = trpc.search.deleteDog.useMutation({ onSuccess: () => router.push("/") });

  // Backfill image embeddings in the background, once, when the owner opens
  // their own dog's page. Keeps reporting instant while still making the
  // listing matchable against street photos.
  const setEmbeddings = trpc.search.setDogEmbeddings.useMutation();
  const backfilled = useRef(false);
  useEffect(() => {
    const dog = q.data?.dog;
    if (!dog || backfilled.current) return;
    if (!q.data?.isOwner || dog.hasEmbeddings || dog.photos.length === 0) return;
    if (!embeddingSupported()) return;
    backfilled.current = true;
    embedImages(dog.photos).then((vecs) => {
      if (vecs?.length) setEmbeddings.mutate({ dogId: dog.id, embeddings: vecs });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.dog?.id, q.data?.isOwner, q.data?.dog?.hasEmbeddings]);

  // Auto-translate the reporter's free text into the reader's language.
  // (Name, address and microchip are deliberately left as written.)
  const d = q.data?.dog;
  const tr = useAutoTranslate(
    { breed: d?.breed, color: d?.color, description: d?.description },
    d?.contentLang
  );

  if (q.isLoading) {
    return <div className="card h-96 animate-pulse" />;
  }
  if (q.error) {
    const forbidden = q.error.data?.code === "FORBIDDEN";
    return (
      <div className="card p-10 text-center">
        {forbidden ? <Lock className="mx-auto h-10 w-10 text-[var(--muted)]" /> : <PawPrint className="mx-auto h-10 w-10 text-[var(--muted)]" />}
        <p className="mt-2 font-semibold">{forbidden ? t("dog.private") : t("dog.notFound")}</p>
        <p className="text-sm text-[var(--muted)]">
          {forbidden ? t("dog.privateSub") : t("dog.notFoundSub")}
        </p>
        <Link href="/" className="btn-primary mt-4 inline-flex">{t("dog.backHome")}</Link>
      </div>
    );
  }

  const s = q.data!;
  const dog = s.dog;
  const dmUrl = dog.owner.username ? `https://t.me/${dog.owner.username}` : null;
  const phone = dog.contactPhone;
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  async function copyPhone() {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t("dog.backAll")}
      </Link>

      {/* Header */}
      <div className="card overflow-hidden md:flex">
        <div className="bg-[var(--brand-soft)] md:w-2/5">
          {dog.photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dog.photos[0]} alt={dog.name} className="h-64 w-full object-cover md:h-full" />
          ) : (
            <div className="flex h-64 items-center justify-center md:h-full">
              <PawPrint className="h-20 w-20 text-[var(--brand)] opacity-40" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{dog.name}</h1>
              <p className="text-sm text-[var(--muted)]">
                {[tr.values.breed, tr.values.color, dog.size ? t(`report.size${dog.size}` as MessageKey) : null]
                  .filter(Boolean)
                  .join(" · ") || t("dog.unknown")}
              </p>
            </div>
            <StatusBadge status={dog.status} />
          </div>

          {tr.values.description && <p className="mt-3 text-sm">{tr.values.description}</p>}

          {/* On-device translation status */}
          {tr.status === "offer" && (
            <button
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand-strong)] hover:underline"
              onClick={tr.translate}
            >
              <Languages className="h-3.5 w-3.5" /> {t("translate.offer", { lang: langName(locale) })}
            </button>
          )}
          {(tr.status === "working" || tr.status === "checking") && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <Languages className="h-3.5 w-3.5" /> {t("translate.working")}
            </p>
          )}
          {tr.status === "unavailable" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <Languages className="h-3.5 w-3.5" /> {t("translate.originalIn", { lang: langName(tr.sourceLang) })}
            </p>
          )}
          {tr.status === "translated" && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" />
                {tr.showOriginal
                  ? t("translate.originalIn", { lang: langName(tr.sourceLang) })
                  : t("translate.translatedFrom", { lang: langName(tr.sourceLang) })}
              </span>
              <button
                className="font-medium text-[var(--brand-strong)] hover:underline"
                onClick={() => tr.setShowOriginal(!tr.showOriginal)}
              >
                {tr.showOriginal ? t("translate.showTranslation") : t("translate.showOriginal")}
              </button>
            </p>
          )}

          {dog.chipNumber && (
            <p className="mt-3 flex items-center gap-1.5 text-sm">
              <ScanLine className="h-4 w-4 text-[var(--muted)]" />
              <span className="text-[var(--muted)]">{t("dog.chip")}:</span>
              <span className="font-mono font-medium">{dog.chipNumber}</span>
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.lastSeenAddress ?? t("dog.locationOnMap")}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t("dog.reportedAt", { time: timeAgo(s.startedAt) })}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t("dog.searchingCount", { count: s.participants.length })}</span>
          </div>

          {/* Owner + contact */}
          <div className="mt-4 rounded-xl bg-[var(--background)] p-3">
            <div className="flex items-center gap-3">
              <Avatar name={dog.owner.name} src={dog.owner.photoUrl} size={40} />
              <div className="flex-1">
                <p className="text-xs text-[var(--muted)]">{t("dog.owner")}</p>
                <p className="text-sm font-semibold">{dog.owner.name}</p>
                {phone && showPhone && (
                  <p className="flex items-center gap-1 text-xs text-[var(--muted)]">
                    <Phone className="h-3.5 w-3.5" /> {formatPhone(phone)}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {/* The number is revealed on tap — it isn't rendered into the page
                  until then, so it can't be scraped from a passing crawler. */}
              {phone && !showPhone && (
                <button className="btn-primary inline-flex items-center gap-1.5" onClick={() => setShowPhone(true)}>
                  <Phone className="h-4 w-4" /> {t("dog.showNumber")}
                </button>
              )}
              {phone && showPhone && (
                <a href={`tel:${phone}`} className="btn-primary inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4" /> {t("dog.call")}
                </a>
              )}
              {phone && showPhone && (
                <button className="btn-ghost" onClick={copyPhone}>
                  {copied ? t("common.copied") : t("dog.copyNumber")}
                </button>
              )}
              {dmUrl && (
                <a href={dmUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4" /> {t("dog.message")}
                </a>
              )}
              {!phone && !dmUrl && <span className="text-xs text-[var(--muted)]">{t("dog.noContact")}</span>}
            </div>

            {/* Safety note when arranging to meet a stranger. */}
            {(phone || dmUrl) && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--muted)]">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                <span><span className="font-medium text-[var(--foreground)]">{t("safety.title")}:</span> {t("safety.meeting")}</span>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {s.status === "ACTIVE" &&
              (s.isParticipant ? (
                !s.isOwner && (
                  <button className="btn-ghost" onClick={() => leave.mutate({ searchId: s.id })} disabled={leave.isPending}>
                    {t("dog.leave")}
                  </button>
                )
              ) : (
                <button className="btn-primary" onClick={() => join.mutate({ searchId: s.id })} disabled={join.isPending}>
                  {join.isPending ? t("dog.joining") : t("dog.join")}
                </button>
              ))}

            {s.telegramGroupLink && (
              <a href={s.telegramGroupLink} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" /> {t("dog.telegramGroup")}
              </a>
            )}

            <button className="btn-ghost inline-flex items-center gap-1.5" onClick={() => setPosterOpen(true)}>
              <Printer className="h-4 w-4" /> {t("dog.printPoster")}
            </button>

            {s.isOwner && s.status === "ACTIVE" && (
              <button
                className="btn-ghost inline-flex items-center gap-1.5"
                onClick={() => {
                  if (confirm(t("dog.markHomeConfirm", { name: dog.name }))) {
                    archive.mutate({ searchId: s.id, outcome: "HOME" });
                  }
                }}
                disabled={archive.isPending}
              >
                <PartyPopper className="h-4 w-4" /> {t("dog.markHome")}
              </button>
            )}

            {me.data?.isDeveloper && (
              <button
                className="btn-ghost inline-flex items-center gap-1.5 text-[var(--danger)]"
                onClick={() => {
                  if (confirm(t("dog.deleteConfirm", { name: dog.name }))) del.mutate({ dogId: dog.id });
                }}
                disabled={del.isPending}
              >
                <Trash2 className="h-4 w-4" /> {t("dog.delete")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive map */}
      <SearchMap
        searchId={s.id}
        dogId={dog.id}
        active={s.status === "ACTIVE"}
        dogName={dog.name}
        homeLat={dog.homeLat}
        homeLng={dog.homeLng}
        lastSeen={{ lat: s.lastSeenLat, lng: s.lastSeenLng, address: s.lastSeenAddress }}
        sightings={s.sightings}
        pois={s.pois}
        coverage={s.coverage}
        onChanged={() => utils.search.detail.invalidate()}
      />

      <div className="grid gap-5 md:grid-cols-2">
        {/* Sightings */}
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">{t("dog.sightings", { count: s.sightings.length })}</h2>
          {s.sightings.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("dog.noSightings")}</p>
          ) : (
            <ul className="space-y-3">
              {s.sightings.map((sight) => (
                <li key={sight.id} className="flex gap-3 text-sm">
                  <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                  <div>
                    <p>{sight.note ?? t("dog.possibleSighting")}</p>
                    <p className="text-xs text-[var(--muted)]">{sight.by} · {timeAgo(sight.seenAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Participants */}
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">{t("dog.searchers", { count: s.participants.length })}</h2>
          <ul className="space-y-3">
            {s.participants.map((p) => {
              const inner = (
                <>
                  <Avatar name={p.user.name} src={p.user.photoUrl} size={36} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {p.user.name}
                      {p.role === "OWNER" && <span className="ml-2 badge bg-[var(--accent)] text-black">{t("dog.ownerBadge")}</span>}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {t("dog.covered", { distance: formatDistance(p.metersCovered) })} · {formatDuration(p.secondsSpent)}
                    </p>
                  </div>
                </>
              );
              return (
                <li key={p.id}>
                  {p.user.username ? (
                    <Link href={`/profile/${p.user.username}`} className="flex items-center gap-3 hover:opacity-80">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Any signed-in user who doesn't own this listing can flag it. */}
      {!s.isOwner && (
        <div className="flex justify-end pt-1">
          <ReportListing searchId={s.id} />
        </div>
      )}

      <DogPoster
        open={posterOpen}
        onClose={() => setPosterOpen(false)}
        dog={{
          name: dog.name,
          breed: dog.breed,
          color: dog.color,
          size: dog.size,
          description: dog.description,
          chipNumber: dog.chipNumber,
          photo: dog.photos[0],
        }}
        lastSeenAddress={s.lastSeenAddress}
        ownerName={dog.owner.name}
        ownerUsername={dog.owner.username}
        contactPhone={phone}
        url={pageUrl}
      />
    </div>
  );
}
