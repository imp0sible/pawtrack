"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, MapPin, Phone, PawPrint, ScanLine } from "lucide-react";
import { useT } from "@/lib/i18n/react";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatPhone } from "@/lib/phone";

interface Props {
  open: boolean;
  onClose: () => void;
  dog: {
    name: string;
    breed: string | null;
    color: string | null;
    size: string | null;
    description: string | null;
    chipNumber: string | null;
    photo?: string;
  };
  lastSeenAddress: string | null;
  ownerName: string;
  ownerUsername: string | null;
  contactPhone: string | null;
  url: string;
}

export function DogPoster({ open, onClose, dog, lastSeenAddress, ownerName, ownerUsername, contactPhone, url }: Props) {
  const t = useT();
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setQr).catch(() => setQr(""));
  }, [open, url]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="w-full max-w-[600px]">
        <div className="no-print mb-3 flex items-center justify-between">
          <span className="font-semibold text-white">{t("poster.preview")}</span>
          <div className="flex gap-2">
            <button className="btn-primary inline-flex items-center gap-1.5" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> {t("poster.print")}
            </button>
            <button className="btn-ghost" onClick={onClose}>{t("poster.close")}</button>
          </div>
        </div>

        <div className="poster-print rounded-2xl bg-white p-8 text-center text-black">
          <div className="rounded-lg border-4 border-black">
            <div className="bg-black py-3 text-4xl font-extrabold uppercase tracking-widest text-white">
              {t("poster.lostDog")}
            </div>

            <div className="p-6">
              {dog.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dog.photo} alt={dog.name} className="mx-auto max-h-72 w-auto rounded-lg object-cover" />
              ) : (
                <div className="mx-auto flex h-56 w-full items-center justify-center rounded-lg bg-neutral-100">
                  <PawPrint className="h-24 w-24 text-neutral-300" />
                </div>
              )}

              <h1 className="mt-4 text-5xl font-extrabold">{dog.name}</h1>
              <p className="mt-1 text-lg font-medium text-neutral-700">
                {[dog.breed, dog.color, dog.size ? t(`report.size${dog.size}` as MessageKey) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {dog.chipNumber && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1 text-base font-semibold text-neutral-800">
                  <ScanLine className="h-4 w-4" /> {t("dog.chip")}: <span className="font-mono">{dog.chipNumber}</span>
                </p>
              )}

              {dog.description && <p className="mx-auto mt-3 max-w-md text-sm text-neutral-800">{dog.description}</p>}

              {lastSeenAddress && (
                <p className="mt-4 inline-flex items-center gap-1.5 text-lg font-bold">
                  <MapPin className="h-5 w-5" /> {t("poster.lastSeen")}: <span className="underline">{lastSeenAddress}</span>
                </p>
              )}

              <div className="mt-5 flex items-center justify-center gap-6">
                <div className="text-left">
                  <p className="text-sm font-semibold uppercase text-neutral-500">{t("poster.pleaseContact")}</p>
                  <p className="text-2xl font-extrabold">{ownerName}</p>
                  {contactPhone && (
                    <p className="flex items-center gap-1.5 text-xl font-extrabold text-neutral-900">
                      <Phone className="h-5 w-5" /> {formatPhone(contactPhone)}
                    </p>
                  )}
                  {ownerUsername && <p className="text-lg font-bold text-neutral-800">{t("poster.telegram")}: @{ownerUsername}</p>}
                  <p className="mt-1 text-xs text-neutral-500">{t("poster.scanHint")}</p>
                </div>
                {qr && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="QR code" width={120} height={120} className="h-30 w-30 shrink-0" />
                )}
              </div>
            </div>

            <div className="bg-black py-2 text-sm font-semibold uppercase tracking-wider text-white">
              {t("poster.footer")}
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-400">Made with PawTrack — pawtrack.app</p>
        </div>
      </div>
    </div>
  );
}
