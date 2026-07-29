"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { isValidPhone } from "@/lib/phone";

// Blocking step shown after login for accounts that don't yet have a phone
// number (e.g. Telegram or dev accounts). A phone is mandatory to use the app.
export function PhoneSetup() {
  const t = useT();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = trpc.user.updateProfile.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => setError(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidPhone(phone)) {
      setError(t("auth.invalidPhone"));
      return;
    }
    save.mutate({ phone });
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-end gap-2 p-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-lg">
              <Phone className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t("phoneGate.title")}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{t("phoneGate.subtitle")}</p>
          </div>

          <form className="card space-y-4 p-6" onSubmit={submit}>
            <div>
              <label className="label">{t("auth.phone")}</label>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("auth.phonePlaceholder")}
                autoComplete="tel"
                autoFocus
              />
              <p className="mt-1 text-xs text-[var(--muted)]">{t("phoneGate.why")}</p>
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <button className="btn-primary w-full" type="submit" disabled={save.isPending}>
              {save.isPending ? t("common.saving") : t("phoneGate.cta")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
