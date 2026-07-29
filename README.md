# PawTrack — find lost dogs together

A community web app for organizing searches for lost dogs. Telegram is used for
identity and coordination throughout: login, owner DMs, per-search group chats,
bot notifications, and background live-location map coverage.

This is the **Phase 1 MVP**. Phase 2 (AI photo-matching of street dogs against
active listings) is intentionally not built yet.

## Features

- **Telegram login** (with a dev-login bypass for local development)
- **Home feed** of active searches with sort modes: newest, nearest, most
  searchers, searches I'm in, A–Z — plus a shared map of lost dogs near you
- **Dog card** with an interactive map layering search-area coverage, sighting
  pins, points of interest (bins/shops/flyer spots), the owner's home, and the
  last-seen location; add sightings/POIs, record your own coverage, print a
  poster (with QR code), open the Telegram group, and one-tap DM the owner
- **My Searches** — active + a participant-only archive
- **Profiles** with stats (dogs found, searches, distance covered, time) and
  achievements; **friends** with username search and activity notifications
- **Settings** — notifications, sounds, location, friend alerts
- **Telegram bot** — links your account, and turns shared Live Location into
  live map coverage even while the site is closed
- **Realtime** — sightings, POIs, and coverage stream to open maps over socket.io

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- tRPC v11 + TanStack Query
- Prisma 7 + SQLite via the libsql driver adapter (no native build needed)
- Leaflet + OpenStreetMap
- grammy (Telegram bot) + socket.io (realtime worker)
- Tailwind CSS v4

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Set up env
cp .env.example .env          # defaults work for local dev

# 3. Create the database and generate the client
npx prisma migrate dev
npx prisma generate

# 4. Seed demo data (users, dogs, searches, sightings, coverage, friends)
npm run seed

# 5. Run the web app + realtime worker together
npm run dev:all
```

Open http://localhost:3000 and click **Continue as dev user** to sign in.

Run the web app and worker separately if you prefer:

```bash
npm run dev        # Next.js on :3000
npm run realtime   # socket.io + Telegram bot on :3001
```

## Enabling Telegram

The app runs fully without Telegram (dev login + bot disabled). To enable it:

1. Create a bot with [@BotFather](https://t.me/BotFather); copy the token and username.
2. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and
   `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` in `.env`.
3. For the **login widget**, set your domain in BotFather (`/setdomain`). The
   widget requires a real domain, so use the dev-login button on `localhost`.
4. Restart `npm run dev:all`. The bot starts in long-polling mode (no public URL
   needed). Outbound notifications are sent via the Telegram HTTP API and work
   as long as the token is set.

To record coverage from Telegram: open a search, tap **Track via Telegram**,
then share your **Live Location** with the bot.

## Notes / limitations

- SQLite is used for local dev; geo queries (distance, "near me") are computed in
  application code. The Prisma schema is portable to PostgreSQL/PostGIS for prod.
- `ALLOW_DEV_LOGIN` must be `false` (or removed) in production.
- No automated test suite in this MVP; verification is manual.
