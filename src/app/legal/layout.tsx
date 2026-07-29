import Link from "next/link";
import { ArrowLeft, PawPrint } from "lucide-react";

// Legal documents live outside the authenticated app shell so they're reachable
// before sign-in (e.g. linked from the login screen). Canonical text is English.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
            <PawPrint className="h-4 w-4" />
          </span>
          PawTrack
        </Link>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>
      <article className="legal-doc space-y-4 pb-16">{children}</article>
    </div>
  );
}
