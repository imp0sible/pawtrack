"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PawPrint } from "lucide-react";
import { useT } from "@/lib/i18n/react";
import { TelegramLoginWidget } from "@/components/telegram-login-widget";
import { ResetPassword } from "@/components/reset-password";

type Mode = "signin" | "register" | "reset";

export function LoginForm({ botUsername }: { botUsername: string }) {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign-in fields
  const [identifier, setIdentifier] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  // Register fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [username, setUsername] = useState("");

  function onSuccess() {
    router.push("/");
    router.refresh();
  }

  async function submitSignin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password: signinPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sign-in failed");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("auth.passwordsDontMatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, password, username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
      setLoading(false);
    }
  }

  const tabClass = (m: Mode) =>
    `flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
      mode === m ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
    }`;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-lg">
            <PawPrint className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("nav.appName")}</h1>
          <p className="mt-2 text-[var(--muted)]">{t("auth.tagline")}</p>
        </div>

        <div className="card p-6">
          {mode === "reset" ? (
            <ResetPassword
              botUsername={botUsername}
              onBack={() => { setMode("signin"); setError(null); }}
              onDone={onSuccess}
            />
          ) : (
          <>
          <div className="mb-5 flex gap-1 rounded-xl bg-[var(--background)] p-1">
            <button className={tabClass("signin")} onClick={() => { setMode("signin"); setError(null); }}>
              {t("auth.signIn")}
            </button>
            <button className={tabClass("register")} onClick={() => { setMode("register"); setError(null); }}>
              {t("auth.register")}
            </button>
          </div>

          {mode === "signin" ? (
            <form className="space-y-3" onSubmit={submitSignin}>
              <p className="text-sm text-[var(--muted)]">{t("auth.signInSubtitle")}</p>
              <div>
                <label className="label">{t("auth.identifier")}</label>
                <input
                  className="input"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t("auth.identifierPlaceholder")}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="label">{t("auth.password")}</label>
                <input
                  className="input"
                  type="password"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <button className="btn-primary w-full" type="submit" disabled={loading}>
                {loading ? t("auth.signingIn") : t("auth.signInCta")}
              </button>
              <button
                type="button"
                onClick={() => { setMode("reset"); setError(null); }}
                className="block w-full text-center text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {t("auth.forgotPassword")}
              </button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={submitRegister}>
              <p className="text-sm text-[var(--muted)]">{t("auth.registerSubtitle")}</p>
              <div>
                <label className="label">{t("auth.name")}</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.namePlaceholder")} />
              </div>
              <div>
                <label className="label">{t("auth.phone")}</label>
                <input
                  className="input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("auth.phonePlaceholder")}
                  autoComplete="tel"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">{t("auth.phoneHint")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t("auth.password")}</label>
                  <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </div>
                <div>
                  <label className="label">{t("auth.confirmPassword")}</label>
                  <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
                </div>
              </div>
              <div>
                <label className="label">
                  {t("auth.username")} <span className="text-[var(--muted)]">({t("common.optional")})</span>
                </label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.usernamePlaceholder")} />
              </div>
              <button className="btn-primary w-full" type="submit" disabled={loading}>
                {loading ? t("auth.creating") : t("auth.registerCta")}
              </button>
            </form>
          )}

          {botUsername && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-[var(--muted)]">
                <span className="h-px flex-1 bg-[var(--border)]" />
                {t("auth.orContinueWith")}
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>
              <TelegramLoginWidget botUsername={botUsername} onDone={onSuccess} />
            </>
          )}

          {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
          </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-[var(--muted)]">
          <a href="/legal/privacy" className="hover:text-[var(--foreground)] hover:underline">{t("settings.privacy")}</a>
          {" · "}
          <a href="/legal/terms" className="hover:text-[var(--foreground)] hover:underline">{t("settings.terms")}</a>
        </p>
      </div>
    </div>
  );
}
