"use client";

import { useEffect } from "react";
import { fallbackT } from "@/lib/i18n/fallback";

// Last-resort boundary: catches errors thrown by the root layout itself, which
// replaces the entire document. It therefore ships its own <html>/<body> and
// fully inline, self-contained styles (globals.css and the theme script are not
// guaranteed here) that still respect the OS colour scheme.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = fallbackT();

  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <style>{`
          :root { color-scheme: light dark; }
          .ge-wrap {
            min-height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center;
            padding: 24px; text-align: center; box-sizing: border-box;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
            background: #f1f4f2; color: #12201b;
          }
          .ge-card { max-width: 26rem; }
          .ge-badge {
            width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 16px;
            display: flex; align-items: center; justify-content: center; font-size: 28px;
            background: #e7f6ef;
          }
          .ge-title { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
          .ge-body { margin: 8px 0 0; font-size: 0.9rem; color: #5f6b64; line-height: 1.55; }
          .ge-btn {
            display: inline-block; margin-top: 24px; padding: 10px 18px; border: 0; border-radius: 12px;
            background: #0e9f6e; color: #fff; font-size: 0.9rem; font-weight: 600; cursor: pointer;
          }
          .ge-ref { margin-top: 24px; font-family: ui-monospace, monospace; font-size: 11px; color: #8a938d; }
          @media (prefers-color-scheme: dark) {
            .ge-wrap { background: #0b0e0d; color: #e9efec; }
            .ge-badge { background: #14251e; }
            .ge-body { color: #949f99; }
            .ge-btn { background: #24bd84; color: #04140d; }
          }
        `}</style>
        <div className="ge-wrap">
          <div className="ge-card">
            <div className="ge-badge" aria-hidden>🐾</div>
            <h1 className="ge-title">{t("error.title")}</h1>
            <p className="ge-body">{t("error.body")}</p>
            <button className="ge-btn" onClick={reset}>{t("error.retry")}</button>
            {error.digest && <p className="ge-ref">ref: {error.digest}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
