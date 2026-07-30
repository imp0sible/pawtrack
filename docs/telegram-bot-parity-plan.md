# PawTrack — Telegram Mini App Plan

**Corrected direction:** PawTrack is **one app**. We do **not** reimplement features as bot
commands. Instead we run the **existing web app as a Telegram Mini App** (a webview opened from
inside Telegram), so the bot gains the web's functionality by *being* the web app. The bot chat
itself just becomes a friendly launcher + the notifier/coverage-tracker it already is.

Domain in use: **https://trackpaw.duckdns.org** (read from `NEXT_PUBLIC_APP_URL`).

---

## How a Telegram Mini App works (the model)

- The bot exposes a **Menu Button** (and/or an inline `web_app` button) that opens a URL — our web
  app — inside Telegram's in-app browser.
- Telegram injects `window.Telegram.WebApp`, including **`initData`**: a signed payload with the
  user's Telegram identity. We **verify it server-side** and start a session → the user is
  **auto-logged-in** the moment the Mini App opens. No login screen inside Telegram.
- Because it's our real Next.js app, every feature (feed, map, report, found, profile, settings)
  is there automatically. Our job is integration + polish, not reimplementation.

---

## What stays a *bot* feature (webview can't do these well)

- **Live-location coverage tracking** — the existing `/start <search>` → share Live Location →
  `/stop` flow. Keep as-is.
- **Notifications** — already delivered via `notify()`. Keep.

---

## Build tasks

### 1. Bot chat presence + launcher
- [ ] Set the bot's **Menu Button** to open the Mini App (via `setChatMenuButton`, or BotFather
      `/setmenubutton`). URL = `NEXT_PUBLIC_APP_URL`.
- [ ] `/start` (no payload): friendly welcome + an inline **web_app** button "🐾 Open PawTrack",
      so the chat isn't empty. Keep the existing deep-link payloads working.
- [ ] Optional: `/help` explaining the app + coverage tracking.

### 2. Mini App authentication (`initData`) → auto-login
- [ ] New endpoint `POST /api/auth/telegram/webapp`: verify `initData`.
      **Note the algorithm differs from the Login Widget:** secret key =
      `HMAC_SHA256("WebAppData", bot_token)`, then check
      `HMAC_SHA256(secret, data_check_string) === hash`. Add `verifyWebAppInitData()` in
      `src/lib/telegram.ts` (separate from `verifyTelegramAuth`). Reject stale `auth_date`.
- [ ] On success: upsert user by `telegramId`, sign session, set cookie. (Reuse the upsert helper
      already added to the telegram route.)
- [ ] Client: a small provider that, on load, if `window.Telegram?.WebApp?.initData` is present
      and we're not signed in, POSTs it to the endpoint and then continues. Seamless entry.

### 3. Make the web app Telegram-aware
- [ ] Load the SDK in the root layout: `<script src="https://telegram.org/js/telegram-web-app.js"
      nonce={nonce}>` (nonce → allowed under strict-dynamic; already permit `telegram.org`).
- [ ] On mount inside Telegram: `WebApp.ready()`, `WebApp.expand()`.
- [ ] Detect Mini App context (`window.Telegram.WebApp.initData` non-empty) to:
      - skip/replace the login screen (auto-login instead),
      - optionally hide our top nav (Telegram provides its own chrome) and use
        `WebApp.BackButton` for back navigation,
      - apply Telegram `themeParams` so light/dark matches the client.

### 4. CSP / embedding (important)
- [ ] `frame-ancestors 'none'` currently **blocks** embedding. Allow Telegram to frame us on
      Telegram Web: `frame-ancestors 'self' https://web.telegram.org`. (Mobile/Desktop use a native
      webview, not an iframe, so this mainly matters for Telegram Web — but set it regardless.)
- [ ] `script-src` already allows `https://telegram.org` (from the login widget work) — good for
      `telegram-web-app.js`.

### 5. Session cookie inside the webview (the tricky bit)
- [ ] On **Telegram Web**, our app runs in a cross-site **iframe** under web.telegram.org, so a
      `SameSite=Lax` session cookie **won't be sent** → auth would break there. Mobile/Desktop use
      a first-party webview, so Lax is fine.
- [ ] Decision/fix: when establishing the session from `initData`, set the cookie
      **`SameSite=None; Secure`** (needed for the iframe case) — or re-verify `initData` on each
      Mini App load. Simplest robust path: `SameSite=None; Secure` for the session cookie (we're
      HTTPS-only anyway). Confirm this doesn't regress the normal web login (it won't — None is a
      superset of Lax for our flows, but review CSRF posture; our mutations are POST + same-origin
      + we can keep other protections).

### 6. Phone gate inside the Mini App
- [ ] Web app requires a phone (the phone gate). Inside Telegram we can request it natively.
      **Decision needed:** (a) call `WebApp.requestContact()` / bot "share phone" to satisfy the
      gate, or (b) relax the phone requirement for Telegram-origin accounts. Recommend (a) if easy,
      else (b).

### 7. Responsive / UX polish for the webview
- [ ] The Mini App is a mobile viewport — reuse the mobile pass we already did; verify the feed,
      map, report, found, profile all feel right in Telegram's webview on iOS/Android.
- [ ] Use `WebApp.MainButton` for primary actions where it improves the flow (optional).

---

## Schema changes
- Likely **none required** for the Mini App itself (identity comes from `initData`).
- `User.locale` still worth adding so bot messages + web share a language, but it's optional for
  Mini-App parity (the webview already has the full i18n switcher).

## Deps / deploy
- No heavy new deps (SDK is a script tag). Possibly a tiny init-data verify helper (crypto,
  built-in).
- Mini-App work touches **both** the web (build needed) and the bot (menu button). Web changes →
  full `git pull && npm run build && pm2 restart all`. Bot-only menu-button change → restart
  realtime.
- BotFather step: set the Menu Button URL (or we do it programmatically on bot start).

## Risks
- **Cookie/iframe (SameSite)** on Telegram Web — the main gotcha; handled in task 5.
- **initData verification** must use the WebApp algorithm (not the widget one) — easy to get wrong.
- **CSP frame-ancestors** must include Telegram or the app won't load in the webview.
- Platform differences (iOS / Android / Desktop / Web) — test each if possible.
- No CLIP-in-worker concern here — the Mini App runs the web app, so photo matching still happens
  in the *user's* device browser (the webview), exactly like the web. 👍

## Open questions to settle first
1. Phone gate in the Mini App: request via Telegram, or relax for TG accounts?
2. Session cookie: switch to `SameSite=None; Secure` (recommended) — OK to review CSRF posture?
3. Inside Telegram, hide our own top nav in favour of Telegram's chrome, or keep ours?
4. Day-1 target: **the whole app loading + auto-login inside Telegram** (tasks 1–5) is the big win;
   phone gate + polish (6–7) follow.
