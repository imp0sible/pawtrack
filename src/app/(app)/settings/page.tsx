"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Users, Volume2, MapPin, Globe, Bug, ChevronRight, Shield, FileText, type LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ChangePassword } from "@/components/change-password";
import { DeleteAccount } from "@/components/delete-account";
import type { MessageKey } from "@/lib/i18n/messages";

interface ToggleDef {
  key: "notificationsEnabled" | "soundsEnabled" | "geolocationEnabled" | "friendActivityAlerts";
  labelKey: MessageKey;
  descKey: MessageKey;
  icon: LucideIcon;
}

const TOGGLES: ToggleDef[] = [
  { key: "notificationsEnabled", labelKey: "settings.notifications", descKey: "settings.notificationsDesc", icon: Bell },
  { key: "friendActivityAlerts", labelKey: "settings.friendAlerts", descKey: "settings.friendAlertsDesc", icon: Users },
  { key: "soundsEnabled", labelKey: "settings.sounds", descKey: "settings.soundsDesc", icon: Volume2 },
  { key: "geolocationEnabled", labelKey: "settings.geolocation", descKey: "settings.geolocationDesc", icon: MapPin },
];

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const utils = trpc.useUtils();
  const q = trpc.user.getSettings.useQuery();
  const update = trpc.user.updateSettings.useMutation({
    onMutate: async (patch) => {
      await utils.user.getSettings.cancel();
      const prev = utils.user.getSettings.getData();
      if (prev) utils.user.getSettings.setData(undefined, { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) utils.user.getSettings.setData(undefined, ctx.prev);
    },
    onSettled: () => utils.user.getSettings.invalidate(),
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const s = q.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>

      {/* Language */}
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-4">
          <Globe className="h-6 w-6 text-[var(--muted)]" />
          <div className="flex-1">
            <p className="font-medium">{t("settings.language")}</p>
            <p className="text-xs text-[var(--muted)]">{t("settings.languageDesc")}</p>
          </div>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="card divide-y divide-[var(--border)]">
        {TOGGLES.map((tog) => (
          <div key={tog.key} className="flex items-center gap-4 p-4">
            <tog.icon className="h-6 w-6 text-[var(--muted)]" />
            <div className="flex-1">
              <p className="font-medium">{t(tog.labelKey)}</p>
              <p className="text-xs text-[var(--muted)]">{t(tog.descKey)}</p>
            </div>
            <button
              role="switch"
              aria-checked={s?.[tog.key] ?? false}
              disabled={!s}
              onClick={() => s && update.mutate({ [tog.key]: !s[tog.key] })}
              className="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50"
              style={{ backgroundColor: s?.[tog.key] ? "var(--brand)" : "var(--border)" }}
            >
              <span
                className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: s?.[tog.key] ? "translateX(20px)" : "translateX(0)" }}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Security */}
      <ChangePassword />

      {/* Report a bug */}
      <Link href="/report-bug" className="card flex items-center gap-4 p-4 transition-colors hover:bg-[var(--brand-soft)]">
        <Bug className="h-6 w-6 text-[var(--muted)]" />
        <div className="flex-1">
          <p className="font-medium">{t("nav.reportBug")}</p>
          <p className="text-xs text-[var(--muted)]">{t("bug.subtitle")}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-[var(--muted)]" />
      </Link>

      {/* Legal */}
      <div className="card divide-y divide-[var(--border)]">
        <Link href="/legal/privacy" className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--brand-soft)]">
          <Shield className="h-6 w-6 text-[var(--muted)]" />
          <div className="flex-1">
            <p className="font-medium">{t("settings.privacy")}</p>
            <p className="text-xs text-[var(--muted)]">{t("settings.privacyDesc")}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-[var(--muted)]" />
        </Link>
        <Link href="/legal/terms" className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--brand-soft)]">
          <FileText className="h-6 w-6 text-[var(--muted)]" />
          <div className="flex-1">
            <p className="font-medium">{t("settings.terms")}</p>
            <p className="text-xs text-[var(--muted)]">{t("settings.termsDesc")}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-[var(--muted)]" />
        </Link>
      </div>

      <div className="card p-4">
        <button className="btn-danger w-full" onClick={logout}>{t("nav.signOut")}</button>
      </div>

      {/* Danger zone */}
      <DeleteAccount />

      <p className="text-center text-xs text-[var(--muted)]">PawTrack · Phase 1 MVP</p>
    </div>
  );
}
