"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, X, LocateFixed, Search, PawPrint, CheckCircle2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { LocationPicker } from "@/components/location-picker";
import { useGeolocation, type Coords } from "@/lib/use-geolocation";
import { fileToDataUrl } from "@/lib/image";
import { formatDistance } from "@/lib/geo";
import { useT } from "@/lib/i18n/react";
import type { MessageKey } from "@/lib/i18n/messages";
import { embedImages, embeddingSupported } from "@/lib/embed";

const MAX_PHOTOS = 4;
type Step = "capture" | "results" | "saved" | "matched";

export default function FoundDogPage() {
  const t = useT();
  const router = useRouter();
  const { loc, status: geoStatus, request } = useGeolocation(true);

  const [step, setStep] = useState<Step>("capture");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [where, setWhere] = useState<Coords | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [embeddings, setEmbeddings] = useState<number[][] | null>(null);
  const [embedding_busy, setEmbeddingBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const spot = where ?? loc;
  // Stable timestamp: a fresh `new Date()` each render would change the query
  // key every render and leave the request loading forever.
  const [seenAt] = useState(() => new Date());

  const nearby = trpc.match.findNearby.useQuery(
    { lat: spot?.lat ?? 0, lng: spot?.lng ?? 0, seenAt, embedding: embedding ?? undefined },
    { enabled: step === "results" && !!spot }
  );

  const saveUnmatched = trpc.match.createStreetSighting.useMutation({
    onSuccess: () => setStep("saved"),
    onError: (e) => setError(e.message),
  });
  const confirm = trpc.match.confirmMatch.useMutation({
    onSuccess: (res) => router.push(`/dogs/${res.dogId}`),
    onError: (e) => setError(e.message),
  });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const added = await Promise.all(files.slice(0, room).map((f) => fileToDataUrl(f)));
      setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
    } catch {
      setError("Couldn't process that image.");
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    request((c) => {
      setWhere(c);
      setFlyTo([c.lat, c.lng]);
    });
  }

  function findMatches() {
    setError(null);
    if (!spot) {
      setError(t("found.locationNeeded"));
      return;
    }
    // Show the nearby shortlist immediately — geography and time do the real
    // work. Visual matching is computed in the background and only re-ranks
    // the list once (and if) the on-device model is ready.
    setStep("results");

    if (embeddingSupported() && photos.length && !embedding) {
      setEmbeddingBusy(true);
      embedImages(photos)
        .then((vecs) => {
          if (vecs && vecs.length) {
            setEmbeddings(vecs);
            setEmbedding(vecs[0]);
          }
        })
        .finally(() => setEmbeddingBusy(false));
    }
  }

  const bandKey = (band: string | null) =>
    band ? (`found.band.${band}` as MessageKey) : null;

  if (step === "saved" || step === "matched") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--brand)]" />
          <p className="mt-3 font-semibold">{step === "saved" ? t("found.saved") : t("found.matched")}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/" className="btn-ghost">{t("dog.backHome")}</Link>
            <button
              className="btn-primary"
              onClick={() => {
                setPhotos([]);
                setNote("");
                setEmbedding(null);
                setEmbeddings(null);
                setStep("capture");
              }}
            >
              {t("found.startOver")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <PawPrint className="h-6 w-6 text-[var(--brand)]" /> {t("found.title")}
        </h1>
        <p className="text-sm text-[var(--muted)]">{t("found.subtitle")}</p>
      </div>

      {step === "capture" && (
        <>
          <div className="card space-y-4 p-5">
            <div>
              <label className="label">{t("found.photos")}</label>
              <div className="flex flex-wrap gap-3">
                {photos.map((src, i) => (
                  <div key={i} className="relative h-24 w-24 overflow-hidden rounded-xl border border-[var(--border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Dog ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
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
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onPick} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="label mb-0">{t("found.where")}</label>
                <button type="button" className="chip inline-flex items-center gap-1.5" onClick={useMyLocation} disabled={geoStatus === "locating"}>
                  <LocateFixed className="h-4 w-4" />
                  {geoStatus === "locating" ? t("report.locating") : t("report.useMyLocation")}
                </button>
              </div>
              <LocationPicker value={spot} onChange={setWhere} userLoc={loc} flyTo={flyTo} />
              {geoStatus === "denied" && (
                <p className="mt-1.5 text-xs text-[var(--muted)]">{t("report.locationBlocked")}</p>
              )}
              {geoStatus === "unavailable" && (
                <p className="mt-1.5 text-xs text-[var(--muted)]">{t("report.locationUnavailable")}</p>
              )}
            </div>

            <div>
              <label className="label">{t("found.note")}</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("found.notePlaceholder")} maxLength={500} />
            </div>

            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

            <div className="flex justify-end">
              <button
                className="btn-primary inline-flex items-center gap-1.5"
                onClick={findMatches}
                disabled={photos.length === 0 || !spot}
              >
                <Search className="h-4 w-4" />
                {t("found.findMatches")}
              </button>
            </div>
          </div>
        </>
      )}

      {step === "results" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold">{t("found.results")}</h2>
            <p className="text-xs text-[var(--muted)]">{t("found.resultsHint")}</p>
            {embedding_busy && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" /> {t("found.visualLoading")}
              </p>
            )}
            {!embedding_busy && nearby.data?.usedVisualMatching && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--brand-strong)]">
                <Sparkles className="h-3.5 w-3.5" /> {t("found.visualOn")}
              </p>
            )}
          </div>

          {nearby.isLoading ? (
            <div className="card h-40 animate-pulse" />
          ) : nearby.data && nearby.data.candidates.length > 0 ? (
            <ul className="space-y-3">
              {nearby.data.candidates.map((c) => (
                <li key={c.searchId} className="card card-interactive flex gap-3 overflow-hidden p-3">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--brand-soft)]">
                    {c.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photos[0]} alt={c.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <PawPrint className="h-8 w-8 text-[var(--brand)] opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <Link href={`/dogs/${c.dogId}`} className="font-semibold hover:underline">{c.name}</Link>
                    <p className="text-xs text-[var(--muted)]">
                      {[c.breed, c.color].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {c.distanceMeters != null ? t("found.away", { distance: formatDistance(c.distanceMeters) }) : ""}
                      {c.lastSeenAddress ? ` · ${c.lastSeenAddress}` : ""}
                    </p>
                    {c.band && (
                      <span className="mt-1 w-fit rounded-lg bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-strong)]">
                        {t(bandKey(c.band)!)}
                      </span>
                    )}
                    <div className="mt-auto pt-2">
                      <button
                        className="btn-primary !py-1.5 text-xs"
                        disabled={confirm.isPending}
                        onClick={() =>
                          confirm.mutate({
                            searchId: c.searchId,
                            photos,
                            lat: spot!.lat,
                            lng: spot!.lng,
                            seenAt,
                            note: note.trim() || undefined,
                          })
                        }
                      >
                        {t("found.thisIsIt")}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card p-8 text-center text-sm text-[var(--muted)]">{t("found.none")}</div>
          )}

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex flex-wrap justify-between gap-2">
            <button className="btn-ghost" onClick={() => setStep("capture")}>{t("common.back")}</button>
            <button
              className="btn-ghost"
              disabled={saveUnmatched.isPending}
              onClick={() =>
                saveUnmatched.mutate({
                  photos,
                  embeddings: embeddings ?? undefined,
                  lat: spot!.lat,
                  lng: spot!.lng,
                  seenAt,
                  note: note.trim() || undefined,
                })
              }
            >
              {t("found.noneMatch")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
