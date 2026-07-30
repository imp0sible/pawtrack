import { NextRequest, NextResponse } from "next/server";

// A strict, nonce-based Content-Security-Policy in production. In development
// we skip it, because Next's HMR / error overlay rely on eval + non-nonced
// inline scripts.
// Legit requests carry up to 4 images (~3 MB each) plus small vectors; anything
// far beyond that is rejected before it's buffered into memory.
const MAX_BODY_BYTES = 16 * 1024 * 1024;

export function middleware(request: NextRequest) {
  const method = request.method;
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const len = Number(request.headers.get("content-length") ?? "0");
    if (len > MAX_BODY_BYTES) {
      return new NextResponse("Payload too large", { status: 413 });
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const nonce = crypto.randomUUID();

  const csp = [
    `default-src 'self'`,
    // Only our nonced bootstrap script and what it loads (strict-dynamic) may
    // run. 'wasm-unsafe-eval' is needed for on-device image embeddings. The
    // telegram.org host is a fallback for browsers that don't honour
    // strict-dynamic (which our nonced bundle already covers for the widget).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' https://telegram.org`,
    // Tailwind + inline element styles (Leaflet markers) need inline styles.
    `style-src 'self' 'unsafe-inline'`,
    // Map tiles (CDNs), avatars, and data/blob image uploads.
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    // tRPC (self), the socket worker (ws/wss) and the on-device model CDN.
    `connect-src 'self' https: wss: ws:`,
    // transformers.js / on-device translation may spawn workers.
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    // Allow Telegram Web to embed us as a Mini App (mobile/desktop use a native
    // webview, not an iframe, so this mainly covers web.telegram.org).
    `frame-ancestors 'self' https://web.telegram.org`,
    // The official Telegram Login Widget renders as an iframe from this origin.
    `frame-src https://oauth.telegram.org`,
    `manifest-src 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Run on pages, not on static assets or image optimizer.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
