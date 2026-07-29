"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { House, Search, Plus, User, Settings, PawPrint, LogOut, Newspaper, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { DevBugsLink } from "@/components/dev-bugs-link";
import { DevReportsLink } from "@/components/dev-reports-link";
import { useT } from "@/lib/i18n/react";
import type { MessageKey } from "@/lib/i18n/messages";

interface Me {
  id: string;
  name: string;
  username: string | null;
  photoUrl: string | null;
  isDeveloper: boolean;
}

const iconBtn =
  "flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]";

const LINKS: { href: string; labelKey: MessageKey; icon: LucideIcon }[] = [
  { href: "/", labelKey: "nav.home", icon: House },
  { href: "/searches", labelKey: "nav.mySearches", icon: Search },
  { href: "/report", labelKey: "nav.report", icon: Plus },
  { href: "/profile", labelKey: "nav.profile", icon: User },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

export function Nav({ me }: { me: Me }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
              <PawPrint className="h-5 w-5" />
            </span>
            <span className="text-lg tracking-tight">PawTrack</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive(l.href)
                    ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                    : "text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]"
                )}
              >
                <l.icon className="h-4 w-4" />
                {t(l.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/devlog" title={t("nav.devlog")} aria-label={t("nav.devlog")} className={iconBtn}>
              <Newspaper className="h-5 w-5" />
            </Link>
            {/* Developer tools are desktop-first — hidden on the narrow mobile
                top bar to keep it from overflowing (reachable at /reports, /bugs). */}
            {me.isDeveloper && (
              <span className="hidden sm:contents">
                <DevReportsLink />
                <DevBugsLink />
              </span>
            )}
            <ThemeToggle />
            <NotificationBell userId={me.id} />
            <Link href="/profile" className="flex items-center gap-2">
              <Avatar name={me.name} src={me.photoUrl} size={36} />
            </Link>
            <button className="btn-ghost hidden items-center gap-1.5 md:inline-flex" onClick={logout}>
              <LogOut className="h-4 w-4" />
              {t("nav.signOut")}
            </button>
          </div>
        </div>
      </header>

      {/* Bottom tab bar (mobile) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--surface)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
              isActive(l.href) ? "text-[var(--brand-strong)]" : "text-[var(--muted)]"
            )}
          >
            <l.icon className="h-5 w-5" />
            {t(l.labelKey)}
          </Link>
        ))}
      </nav>
    </>
  );
}
