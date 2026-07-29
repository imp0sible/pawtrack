"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bone, Search, Footprints, Clock, Camera, Phone, Award, Send, Check,
  PawPrint, Flashlight, Medal, HeartHandshake, Zap, Timer, Moon,
  Eye, Radar, Bug, FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { Avatar } from "@/components/avatar";
import { FriendsPanel } from "@/components/friends-panel";
import { TelegramAuthButton } from "@/components/telegram-auth-button";
import { formatDistance } from "@/lib/geo";
import { formatDuration } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { fileToAvatarDataUrl } from "@/lib/image";
import { useT } from "@/lib/i18n/react";

// Modern icons per achievement key (replacing the stored emoji).
const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  first_search: PawPrint,
  ten_searches: Flashlight,
  hundred_searches: Medal,
  first_find: Bone,
  ten_finds: HeartHandshake,
  km_covered: Footprints,
  ten_km_covered: Zap,
  one_hour: Timer,
  ten_hours: Moon,
  first_sighting: Eye,
  ten_sightings: Radar,
  first_bug: Bug,
  beta_tester: FlaskConical,
};

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="card p-4 text-center">
      <Icon className="mx-auto h-6 w-6 text-[var(--brand)]" />
      <div className="mt-1 text-xl font-bold">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}

export function ProfileView({ username }: { username?: string }) {
  const t = useT();
  const q = trpc.user.profile.useQuery({ username });
  const utils = trpc.useUtils();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  // null = keep current photo, "" = remove, string = new url/data-url
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.user.profile.invalidate();
      router.refresh(); // update the nav avatar (server-rendered)
      setEditing(false);
      setPhoto(null);
    },
    onError: (e) => setEditError(e.message),
  });

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhoto(await fileToAvatarDataUrl(file));
    } finally {
      setPhotoBusy(false);
      e.target.value = "";
    }
  }

  function startEdit(currentBio: string | null, currentPhone: string | null) {
    setBio(currentBio ?? "");
    setPhone(currentPhone ?? "");
    setPhoto(null);
    setEditError(null);
    setEditing(true);
  }

  function submitEdit() {
    setEditError(null);
    save.mutate({
      bio,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(photo !== null ? { photoUrl: photo } : {}),
    });
  }
  const request = trpc.friend.request.useMutation({ onSuccess: () => utils.user.profile.invalidate() });
  const [requested, setRequested] = useState(false);

  if (q.isLoading) return <div className="card h-72 animate-pulse" />;
  if (q.error) {
    return (
      <div className="card p-10 text-center">
        <p className="text-4xl">🐾</p>
        <p className="mt-2 font-semibold">User not found</p>
      </div>
    );
  }

  const p = q.data!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative">
            <Avatar
              name={p.name}
              src={editing ? (photo === null ? p.photoUrl : photo || null) : p.photoUrl}
              size={88}
            />
            {editing && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--brand)] text-white shadow"
                title="Change photo"
              >
                <Camera className="h-4 w-4" />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold">{p.name}</h1>
            {p.username && <p className="text-[var(--muted)]">@{p.username}</p>}

            {editing ? (
              <div className="mt-3 space-y-2">
                <textarea
                  className="input min-h-20"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={300}
                  placeholder={t("profile.bioPlaceholder")}
                />
                <div>
                  <label className="label">{t("profile.phone")}</label>
                  <input
                    className="input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("auth.phonePlaceholder")}
                  />
                </div>
                {editError && <p className="text-sm text-[var(--danger)]">{editError}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button className="btn-primary" onClick={submitEdit} disabled={save.isPending || photoBusy}>
                    {save.isPending ? t("common.saving") : t("common.save")}
                  </button>
                  <button className="btn-ghost" onClick={() => { setEditing(false); setPhoto(null); setEditError(null); }}>{t("common.cancel")}</button>
                  <button className="text-xs text-[var(--muted)] hover:underline" onClick={() => fileRef.current?.click()}>
                    {t("profile.changePhoto")}
                  </button>
                  {(photo || p.photoUrl) && (
                    <button className="text-xs text-[var(--muted)] hover:text-[var(--danger)]" onClick={() => setPhoto("")}>
                      {t("profile.removePhoto")}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm">{p.bio || (p.isSelf ? t("profile.addBio") : "")}</p>
                {p.isSelf && p.phone && (
                  <a href={`tel:${p.phone}`} className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--brand)]">
                    <Phone className="h-3.5 w-3.5" /> {formatPhone(p.phone)}
                  </a>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2">
            {p.isSelf ? (
              !editing && (
                <button className="btn-ghost" onClick={() => startEdit(p.bio, p.phone)}>
                  {t("profile.editProfile")}
                </button>
              )
            ) : p.isFriend ? (
              <span className="chip chip-active">{t("profile.friends")} ✓</span>
            ) : requested ? (
              <span className="chip">{t("profile.requests")}</span>
            ) : (
              <button
                className="btn-primary"
                onClick={() => { request.mutate({ userId: p.id }); setRequested(true); }}
              >
                {t("profile.add")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Telegram connection (optional) */}
      {p.isSelf && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Send className="h-4 w-4 text-[var(--muted)]" /> {t("auth.telegram")}
          </div>
          {p.telegramConnected ? (
            <span className="chip chip-active inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> {t("auth.telegramConnected")}
            </span>
          ) : (
            <TelegramAuthButton
              mode="link"
              onDone={() => {
                utils.user.profile.invalidate();
                router.refresh();
              }}
              className="btn-ghost inline-flex items-center gap-2"
            />
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile icon={Bone} label={t("profile.dogsFound")} value={String(p.stats.dogsFound)} />
        <StatTile icon={Search} label={t("profile.searchesJoined")} value={String(p.stats.searchesJoined)} />
        <StatTile icon={Footprints} label={t("profile.distanceCovered")} value={formatDistance(p.stats.metersCovered)} />
        <StatTile icon={Clock} label={t("profile.searchTime")} value={formatDuration(p.stats.secondsSpent)} />
      </div>

      {/* Achievements */}
      <div className="card p-5">
        <h2 className="mb-3 font-semibold">{t("profile.achievements")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {p.achievements.map((a) => {
            const Icon = ACHIEVEMENT_ICONS[a.key] ?? Award;
            return (
              <div
                key={a.key}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  a.earned ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)] opacity-60"
                }`}
              >
                <Icon className={`h-6 w-6 shrink-0 ${a.earned ? "text-[var(--brand)]" : "text-[var(--muted)]"}`} />
                <div>
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-[var(--muted)]">{a.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {p.isSelf && <FriendsPanel />}
    </div>
  );
}
