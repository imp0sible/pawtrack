"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useT } from "@/lib/i18n/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";

// Blocking step shown after login for accounts without a password (e.g. those
// created via Telegram/dev login). A password is mandatory to use the app.
export function PasswordSetup() {
  const t = useT();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = trpc.user.changePassword.useMutation({
    onSuccess: () => router.refresh(),
    onError: (e) => setError(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 6) {
      setError(t("auth.weakPassword"));
      return;
    }
    if (pw !== confirm) {
      setError(t("auth.passwordsDontMatch"));
      return;
    }
    save.mutate({ newPassword: pw });
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
              <KeyRound className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t("passwordGate.title")}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{t("passwordGate.subtitle")}</p>
          </div>

          <form className="card space-y-4 p-6" onSubmit={submit}>
            <div>
              <label className="label">{t("auth.password")}</label>
              <input
                className="input"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
            </div>
            <div>
              <label className="label">{t("auth.confirmPassword")}</label>
              <input
                className="input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <button className="btn-primary w-full" type="submit" disabled={save.isPending}>
              {save.isPending ? t("common.saving") : t("passwordGate.cta")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
