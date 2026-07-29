"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, ImagePlus, X } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { LocationPicker } from "@/components/location-picker";
import { useGeolocation, type Coords } from "@/lib/use-geolocation";
import { fileToDataUrl } from "@/lib/image";
import { DOG_SIZES } from "@/lib/constants";
import { useT, useI18n } from "@/lib/i18n/react";
import type { MessageKey } from "@/lib/i18n/messages";

const MAX_PHOTOS = 4;

export default function ReportPage() {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const { loc, status, request } = useGeolocation(true);
  const me = trpc.user.me.useQuery();

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [chipNumber, setChipNumber] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [phonePrefilled, setPhonePrefilled] = useState(false);
  const [groupLink, setGroupLink] = useState("");
  const [lastSeen, setLastSeen] = useState<Coords | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefill the contact phone from the user's profile number (once).
  useEffect(() => {
    if (!phonePrefilled && me.data?.phone) {
      setContactPhone(me.data.phone);
      setPhonePrefilled(true);
    }
  }, [me.data?.phone, phonePrefilled]);

  const create = trpc.search.create.useMutation({
    onSuccess: (res) => router.push(`/dogs/${res.dogId}`),
    onError: (e) => setError(e.message),
  });

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setPhotoBusy(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const added = await Promise.all(files.slice(0, room).map((f) => fileToDataUrl(f)));
      setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
    } catch {
      setError("Couldn't process that image. Try a different file.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function useMyLocation() {
    // On success, drop the pin at the current location and recenter the map.
    request((c) => {
      setLastSeen(c);
      setFlyTo([c.lat, c.lng]);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t("report.nameRequired"));
      return;
    }
    // Reporting a lost dog is time-critical: submit immediately and never wait
    // on the image model. Embeddings are attached later from the dog's page.
    create.mutate({
      name: name.trim(),
      breed: breed.trim() || undefined,
      color: color.trim() || undefined,
      size: (size || undefined) as (typeof DOG_SIZES)[number] | undefined,
      description: description.trim() || undefined,
      chipNumber: chipNumber.trim() || undefined,
      contentLang: locale,
      contactPhone: contactPhone.trim() || undefined,
      photos: photos.length ? photos : undefined,
      lastSeenAddress: address.trim() || undefined,
      lastSeenLat: lastSeen?.lat,
      lastSeenLng: lastSeen?.lng,
      telegramGroupLink: groupLink.trim() || undefined,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("report.title")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("report.subtitle")}</p>
      </div>

      <form className="space-y-5" onSubmit={submit}>
        <div className="card space-y-4 p-5">
          <div>
            <label className="label">{t("report.dogName")} *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("report.dogNamePlaceholder")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">{t("report.breed")}</label>
              <input className="input" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder={t("report.breedPlaceholder")} />
            </div>
            <div>
              <label className="label">{t("report.color")}</label>
              <input className="input" value={color} onChange={(e) => setColor(e.target.value)} placeholder={t("report.colorPlaceholder")} />
            </div>
            <div>
              <label className="label">{t("report.size")}</label>
              <select className="input" value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="">—</option>
                {DOG_SIZES.map((sz) => (
                  <option key={sz} value={sz}>{t(`report.size${sz}` as MessageKey)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t("report.chipNumber")}</label>
            <input
              className="input"
              value={chipNumber}
              onChange={(e) => setChipNumber(e.target.value)}
              placeholder={t("report.chipPlaceholder")}
              maxLength={40}
            />
          </div>
          <div>
            <label className="label">{t("report.description")}</label>
            <textarea
              className="input min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("report.descriptionPlaceholder")}
            />
          </div>
          <div>
            <label className="label">{t("report.photos")}</label>
            <div className="flex flex-wrap gap-3">
              {photos.map((src, i) => (
                <div key={i} className="relative h-24 w-24 overflow-hidden rounded-xl border border-[var(--border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Dog photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                    title={t("profile.removePhoto")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={photoBusy}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50"
                >
                  <ImagePlus className="h-6 w-6" />
                  {photoBusy ? t("report.adding") : t("report.addPhoto")}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickPhotos} />
            <p className="mt-1 text-xs text-[var(--muted)]">{t("report.photosHint", { max: MAX_PHOTOS })}</p>
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <label className="label mb-0">{t("report.lastSeenLocation")}</label>
            <button type="button" className="chip inline-flex items-center gap-1.5" onClick={useMyLocation} disabled={status === "locating"}>
              <LocateFixed className="h-4 w-4" /> {status === "locating" ? t("report.locating") : t("report.useMyLocation")}
            </button>
          </div>
          {status === "denied" && <p className="text-xs text-[var(--danger)]">{t("report.locationBlocked")}</p>}
          {status === "unavailable" && <p className="text-xs text-[var(--danger)]">{t("report.locationUnavailable")}</p>}
          <LocationPicker value={lastSeen} onChange={setLastSeen} userLoc={loc} flyTo={flyTo} />
          <div>
            <label className="label">{t("report.nearestAddress")}</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("report.addressPlaceholder")} />
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <div>
            <label className="label">{t("report.contactPhone")}</label>
            <input
              className="input"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder={t("auth.phonePlaceholder")}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{t("report.contactPhoneHint")}</p>
          </div>
          <div>
            <label className="label">{t("report.telegramGroupLink")}</label>
            <input className="input" value={groupLink} onChange={(e) => setGroupLink(e.target.value)} placeholder="https://t.me/+…" />
            <p className="mt-1 text-xs text-[var(--muted)]">{t("report.telegramGroupHint")}</p>
          </div>
        </div>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => router.push("/")}>{t("common.cancel")}</button>
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? t("report.starting") : t("report.startSearch")}
          </button>
        </div>
      </form>
    </div>
  );
}
