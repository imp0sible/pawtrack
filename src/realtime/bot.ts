import { Bot, type Context } from "grammy";
import { prisma } from "@/lib/db";
import { pathMeters } from "@/lib/geo";

type Emit = (room: string, event: string, payload: unknown) => void;

interface TrackSession {
  searchId: string;
  dogName: string;
  userId: string;
  points: Array<[number, number]>;
  segmentId?: string;
  lastMeters: number;
}

// In-memory live-tracking sessions keyed by Telegram user id. A session lasts
// from /start <search> until /stop (or process restart).
const sessions = new Map<number, TrackSession>();

async function findSearch(payload: string) {
  const byId = await prisma.search.findUnique({ where: { id: payload }, include: { dog: true } });
  if (byId) return byId;
  return prisma.search.findUnique({ where: { dogId: payload }, include: { dog: true } });
}

export async function startBot(emit: Emit): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("[bot] TELEGRAM_BOT_TOKEN not set — bot disabled (socket.io still runs).");
    return;
  }

  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim();
    if (!payload) {
      await ctx.reply(
        "🐕 <b>PawTrack</b>\n\nOpen a search on the web app and tap “Track via Telegram” to record your coverage here by sharing your Live Location.\n\nCommands:\n/stop — finish recording",
        { parse_mode: "HTML" }
      );
      return;
    }
    if (payload.startsWith("login_")) {
      await handleLogin(ctx, payload.slice("login_".length));
      return;
    }
    if (payload.startsWith("link_")) {
      await handleLink(ctx, payload.slice("link_".length));
      return;
    }
    if (payload.startsWith("reset_")) {
      await handleReset(ctx, payload.slice("reset_".length));
      return;
    }
    await beginSession(ctx, payload);
  });

  bot.command("stop", async (ctx) => {
    const s = ctx.from && sessions.get(ctx.from.id);
    if (!s) {
      await ctx.reply("No active recording. Start one from a search page on the web app.");
      return;
    }
    sessions.delete(ctx.from!.id);
    await ctx.reply(`⏹ Stopped recording for ${s.dogName}. Total covered this session: ${Math.round(s.lastMeters)} m. Thank you! 🐾`);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("Share your Live Location while a recording is active to fill in the search map. /stop to finish.");
  });

  bot.on("message:location", (ctx) => handleLocation(ctx, emit));
  bot.on("edited_message:location", (ctx) => handleLocation(ctx, emit));

  bot.catch((err) => console.error("[bot] error:", err.error));

  // Long-polling: no public URL needed for local dev.
  bot.start({
    onStart: (info) => console.log(`[bot] @${info.username} started (long-polling).`),
  });
}

// Signs the user in: finds/creates a User for this Telegram account and marks
// the login token resolved so the browser (polling) can pick it up.
async function handleLogin(ctx: Context, token: string) {
  if (!ctx.from) return;
  const row = await prisma.tgAuthToken.findUnique({ where: { token } });
  if (!row || row.kind !== "LOGIN" || row.status !== "PENDING" || row.expiresAt.getTime() < Date.now()) {
    await ctx.reply("This login link is invalid or has expired. Please start again from the web app.");
    return;
  }

  const telegramId = String(ctx.from.id);
  const profile = {
    username: ctx.from.username ?? undefined,
    firstName: ctx.from.first_name ?? undefined,
    lastName: ctx.from.last_name ?? undefined,
  };
  const user = await prisma.user.upsert({
    where: { telegramId },
    create: { telegramId, ...profile, settings: { create: {} } },
    update: profile,
  });

  await prisma.tgAuthToken.update({
    where: { token },
    data: { status: "DONE", resolvedUserId: user.id },
  });

  const name = profile.firstName ?? profile.username ?? "there";
  await ctx.reply(`✅ Signed in as ${name}. Head back to your browser — it will continue automatically. 🐾`);
}

// Connects this Telegram account to an already-signed-in PawTrack user.
async function handleLink(ctx: Context, token: string) {
  if (!ctx.from) return;
  const row = await prisma.tgAuthToken.findUnique({ where: { token } });
  if (!row || row.kind !== "LINK" || row.status !== "PENDING" || row.expiresAt.getTime() < Date.now() || !row.initiatorUserId) {
    await ctx.reply("This connect link is invalid or has expired. Please try again from your profile.");
    return;
  }

  const telegramId = String(ctx.from.id);
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing && existing.id !== row.initiatorUserId) {
    await prisma.tgAuthToken.update({
      where: { token },
      data: { status: "ERROR", error: "This Telegram account is already linked to another PawTrack user." },
    });
    await ctx.reply("⚠️ This Telegram account is already linked to a different PawTrack user.");
    return;
  }

  // Adopt the Telegram username only if the account doesn't have one and it's free.
  const initiator = await prisma.user.findUnique({ where: { id: row.initiatorUserId } });
  const data: { telegramId: string; username?: string } = { telegramId };
  if (initiator && !initiator.username && ctx.from.username) {
    const taken = await prisma.user.findUnique({ where: { username: ctx.from.username } });
    if (!taken) data.username = ctx.from.username;
  }

  try {
    await prisma.user.update({ where: { id: row.initiatorUserId }, data });
  } catch {
    await prisma.tgAuthToken.update({
      where: { token },
      data: { status: "ERROR", error: "Could not link this Telegram account." },
    });
    await ctx.reply("⚠️ Couldn't connect this Telegram account. Please try again.");
    return;
  }

  await prisma.tgAuthToken.update({
    where: { token },
    data: { status: "DONE", resolvedUserId: row.initiatorUserId },
  });
  await ctx.reply("✅ Telegram connected to your PawTrack account. You can now use bot features. 🐾");
}

// Password reset: the Telegram account itself is the proof of identity. We only
// resolve the token for the PawTrack user already linked to this Telegram
// account — so possession of the account is what authorizes the reset.
async function handleReset(ctx: Context, token: string) {
  if (!ctx.from) return;
  const row = await prisma.tgAuthToken.findUnique({ where: { token } });
  if (!row || row.kind !== "RESET" || row.status !== "PENDING" || row.expiresAt.getTime() < Date.now()) {
    await ctx.reply("This reset link is invalid or has expired. Please start again from the web app.");
    return;
  }

  const telegramId = String(ctx.from.id);
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    await prisma.tgAuthToken.update({
      where: { token },
      data: { status: "ERROR", error: "No PawTrack account is connected to this Telegram account." },
    });
    await ctx.reply(
      "⚠️ This Telegram account isn't connected to any PawTrack account, so I can't reset a password from here."
    );
    return;
  }

  await prisma.tgAuthToken.update({
    where: { token },
    data: { status: "DONE", resolvedUserId: user.id },
  });
  await ctx.reply("✅ Identity confirmed. Head back to your browser to set a new password. 🐾");
}

async function beginSession(ctx: Context, payload: string) {
  if (!ctx.from) return;
  const telegramId = String(ctx.from.id);
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    await ctx.reply("I don't recognize this Telegram account yet. Please sign in on the PawTrack web app first, then try again.");
    return;
  }
  const search = await findSearch(payload);
  if (!search) {
    await ctx.reply("That search couldn't be found.");
    return;
  }
  if (search.status !== "ACTIVE") {
    await ctx.reply("That search is already closed.");
    return;
  }

  await prisma.searchParticipant.upsert({
    where: { searchId_userId: { searchId: search.id, userId: user.id } },
    create: { searchId: search.id, userId: user.id, role: "SEARCHER" },
    update: {},
  });

  sessions.set(ctx.from.id, {
    searchId: search.id,
    dogName: search.dog.name,
    userId: user.id,
    points: [],
    lastMeters: 0,
  });

  await ctx.reply(
    `📍 Recording coverage for <b>${search.dog.name}</b>.\n\nTap 📎 → Location → <b>Share Live Location</b> and choose a duration. Your path will appear on the search map in real time.\n\nSend /stop when you're done.`,
    { parse_mode: "HTML" }
  );
}

async function handleLocation(ctx: Context, emit: Emit) {
  if (!ctx.from) return;
  const session = sessions.get(ctx.from.id);
  const loc = ctx.msg?.location;
  if (!session || !loc) return;

  session.points.push([loc.latitude, loc.longitude]);
  if (session.points.length < 2) return;

  const meters = pathMeters(session.points);
  const delta = Math.max(0, meters - session.lastMeters);

  if (!session.segmentId) {
    const seg = await prisma.coverageSegment.create({
      data: {
        searchId: session.searchId,
        userId: session.userId,
        pointsJson: JSON.stringify(session.points),
        meters,
        source: "BOT",
      },
    });
    session.segmentId = seg.id;
  } else {
    await prisma.coverageSegment.update({
      where: { id: session.segmentId },
      data: { pointsJson: JSON.stringify(session.points), meters },
    });
  }

  if (delta > 0) {
    await prisma.searchParticipant.update({
      where: { searchId_userId: { searchId: session.searchId, userId: session.userId } },
      data: { metersCovered: { increment: Math.round(delta) } },
    });
  }
  session.lastMeters = meters;

  emit(`search:${session.searchId}`, "coverage:added", {
    id: session.segmentId,
    points: session.points,
    by: "Telegram live location",
  });
}
