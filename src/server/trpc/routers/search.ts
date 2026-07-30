import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, devProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/db";
import { parseStringArray, parsePath } from "@/lib/json";
import { haversine } from "@/lib/geo";
import { displayName } from "@/lib/format";
import { notify } from "@/lib/notify";
import { notifyFriends } from "@/lib/social";
import { evaluateAchievements } from "@/lib/achievements";
import { emitToSearch } from "@/lib/realtime";
import { SORT_MODES, DOG_SIZES } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";
import { imageSchema, httpUrlSchema } from "@/lib/validators";
import { pickTraceColor, fallbackTraceColor, TRACE_COLOR_HEXES } from "@/lib/trace";

// Picks the first unused trace colour for a search. Colours are unique per
// search (enforced by a DB index), so callers should tolerate a race by
// retrying without a colour.
async function nextTraceColor(searchId: string): Promise<string> {
  const rows = await prisma.searchParticipant.findMany({
    where: { searchId },
    select: { traceColor: true },
  });
  return pickTraceColor(rows.map((r) => r.traceColor));
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const cardInclude = {
  dog: { include: { owner: true } },
  _count: { select: { participants: true, sightings: true } },
} as const;

type CardRow = Awaited<ReturnType<typeof fetchCards>>[number];

function fetchCards(where: object) {
  return prisma.search.findMany({ where, include: cardInclude });
}

function toCard(row: CardRow, myParticipantIds: Set<string>, userLoc?: { lat: number; lng: number }) {
  const distance =
    userLoc && row.lastSeenLat != null && row.lastSeenLng != null
      ? haversine(userLoc, { lat: row.lastSeenLat, lng: row.lastSeenLng })
      : null;
  return {
    id: row.id,
    status: row.status,
    startedAt: row.startedAt,
    lastSeenAt: row.lastSeenAt,
    lastSeenAddress: row.lastSeenAddress,
    lastSeenLat: row.lastSeenLat,
    lastSeenLng: row.lastSeenLng,
    telegramGroupLink: row.telegramGroupLink,
    participantCount: row._count.participants,
    sightingCount: row._count.sightings,
    isParticipant: myParticipantIds.has(row.id),
    distanceMeters: distance,
    dog: {
      id: row.dog.id,
      name: row.dog.name,
      breed: row.dog.breed,
      color: row.dog.color,
      size: row.dog.size,
      status: row.dog.status,
      description: row.dog.description,
      photos: parseStringArray(row.dog.photosJson),
      contactPhone: row.dog.contactPhone ?? row.dog.owner.phone,
      ownerName: displayName(row.dog.owner),
      ownerUsername: row.dog.owner.username,
    },
  };
}

async function myParticipantSet(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await prisma.searchParticipant.findMany({
    where: { userId },
    select: { searchId: true },
  });
  return new Set(rows.map((r) => r.searchId));
}

const locInput = z.object({ lat: z.number(), lng: z.number() }).optional();

export const searchRouter = router({
  feed: publicProcedure
    .input(z.object({ sort: z.enum(SORT_MODES).default("START_TIME"), loc: locInput }))
    .query(async ({ input, ctx }) => {
      const rows = await fetchCards({ status: "ACTIVE" });
      const mine = await myParticipantSet(ctx.user?.id);
      const cards = rows.map((r) => toCard(r, mine, input.loc));

      switch (input.sort) {
        case "START_TIME":
          cards.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
          break;
        case "ALPHABETICAL":
          cards.sort((a, b) => a.dog.name.localeCompare(b.dog.name));
          break;
        case "PARTICIPANTS":
          cards.sort((a, b) => b.participantCount - a.participantCount);
          break;
        case "LOSS_LOCATION":
          cards.sort((a, b) => {
            if (a.distanceMeters == null) return 1;
            if (b.distanceMeters == null) return -1;
            return a.distanceMeters - b.distanceMeters;
          });
          break;
      }
      return cards;
    }),

  mapPins: publicProcedure.input(z.object({ loc: locInput })).query(async () => {
    const rows = await prisma.search.findMany({
      where: { status: "ACTIVE", lastSeenLat: { not: null }, lastSeenLng: { not: null } },
      include: { dog: true },
    });
    return rows.map((r) => ({
      searchId: r.id,
      dogId: r.dog.id,
      name: r.dog.name,
      breed: r.dog.breed,
      lat: r.lastSeenLat!,
      lng: r.lastSeenLng!,
      photo: parseStringArray(r.dog.photosJson)[0] ?? null,
    }));
  }),

  mySearches: protectedProcedure.query(async ({ ctx }) => {
    const parts = await prisma.searchParticipant.findMany({
      where: { userId: ctx.user.id },
      select: { searchId: true },
    });
    const ids = parts.map((p) => p.searchId);
    const rows = await fetchCards({ id: { in: ids } });
    const mine = new Set(ids);
    const cards = rows.map((r) => toCard(r, mine));
    const newestFirst = (a: (typeof cards)[number], b: (typeof cards)[number]) =>
      b.startedAt.getTime() - a.startedAt.getTime();
    return {
      // Listings of yours still awaiting review (or declined) — shown separately
      // so it's obvious why they aren't in the public feed yet.
      pending: cards
        .filter((c) => c.status === "PENDING" || c.status === "REJECTED")
        .sort(newestFirst),
      active: cards.filter((c) => c.status === "ACTIVE").sort(newestFirst),
      archived: cards.filter((c) => c.status === "ARCHIVED").sort(newestFirst),
    };
  }),

  detail: publicProcedure.input(z.object({ dogId: z.string() })).query(async ({ input, ctx }) => {
    const search = await prisma.search.findUnique({
      where: { dogId: input.dogId },
      include: {
        dog: { include: { owner: { include: { settings: false } } } },
        participants: { include: { user: true }, orderBy: { joinedAt: "asc" } },
        sightings: { include: { user: true }, orderBy: { seenAt: "desc" } },
        pois: true,
        coverage: { include: { user: true }, orderBy: { recordedAt: "asc" } },
      },
    });
    if (!search) throw new TRPCError({ code: "NOT_FOUND" });

    const isParticipant = ctx.user
      ? search.participants.some((p) => p.userId === ctx.user!.id)
      : false;
    const isOwner = ctx.user ? search.dog.ownerId === ctx.user.id : false;

    const isDev = ctx.user?.isDeveloper === true;

    // Archived searches are visible only to their participants.
    if (search.status === "ARCHIVED" && !isParticipant) {
      throw new TRPCError({ code: "FORBIDDEN", message: "This archived search is private to its participants." });
    }
    // Unreviewed / rejected listings aren't public: only the owner (and other
    // participants) plus developers reviewing them can see them.
    if ((search.status === "PENDING" || search.status === "REJECTED") && !isParticipant && !isDev) {
      throw new TRPCError({ code: "FORBIDDEN", message: "This listing is awaiting review." });
    }

    return {
      id: search.id,
      status: search.status,
      reviewNote: search.reviewNote,
      startedAt: search.startedAt,
      endedAt: search.endedAt,
      lastSeenAt: search.lastSeenAt,
      lastSeenAddress: search.lastSeenAddress,
      lastSeenLat: search.lastSeenLat,
      lastSeenLng: search.lastSeenLng,
      telegramGroupLink: search.telegramGroupLink,
      isParticipant,
      isOwner,
      dog: {
        id: search.dog.id,
        name: search.dog.name,
        breed: search.dog.breed,
        color: search.dog.color,
        size: search.dog.size,
        status: search.dog.status,
        description: search.dog.description,
        chipNumber: search.dog.chipNumber,
        contentLang: search.dog.contentLang,
        hasEmbeddings: Boolean(search.dog.embeddingsJson),
        photos: parseStringArray(search.dog.photosJson),
        contactPhone: search.dog.contactPhone ?? search.dog.owner.phone,
        homeLat: search.dog.homeLat,
        homeLng: search.dog.homeLng,
        owner: {
          id: search.dog.owner.id,
          name: displayName(search.dog.owner),
          username: search.dog.owner.username,
          photoUrl: search.dog.owner.photoUrl,
        },
      },
      participants: search.participants.map((p, i) => ({
        id: p.id,
        role: p.role,
        joinedAt: p.joinedAt,
        secondsSpent: p.secondsSpent,
        metersCovered: p.metersCovered,
        // Older participants may predate trace colours — fall back to a stable
        // palette slot so the map and the searcher list always agree.
        traceColor: p.traceColor ?? fallbackTraceColor(i),
        user: {
          id: p.user.id,
          name: displayName(p.user),
          username: p.user.username,
          photoUrl: p.user.photoUrl,
        },
      })),
      sightings: search.sightings.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        note: s.note,
        seenAt: s.seenAt,
        by: displayName(s.user),
      })),
      pois: search.pois.map((p) => ({ id: p.id, type: p.type, lat: p.lat, lng: p.lng, note: p.note })),
      coverage: search.coverage.map((c) => {
        const idx = search.participants.findIndex((p) => p.userId === c.userId);
        const own = idx >= 0 ? search.participants[idx] : null;
        return {
          id: c.id,
          points: parsePath(c.pointsJson),
          meters: c.meters,
          source: c.source,
          by: displayName(c.user),
          userId: c.userId,
          // recordedAt drives the time-based fade on the map.
          recordedAt: c.recordedAt,
          color: own?.traceColor ?? (idx >= 0 ? fallbackTraceColor(idx) : undefined),
        };
      }),
    };
  }),

  join: protectedProcedure.input(z.object({ searchId: z.string() })).mutation(async ({ input, ctx }) => {
    const search = await prisma.search.findUnique({
      where: { id: input.searchId },
      include: { dog: true },
    });
    if (!search) throw new TRPCError({ code: "NOT_FOUND" });
    if (search.status !== "ACTIVE") throw new TRPCError({ code: "BAD_REQUEST", message: "Search is closed" });

    const existing = await prisma.searchParticipant.findUnique({
      where: { searchId_userId: { searchId: input.searchId, userId: ctx.user.id } },
    });
    if (existing) return { joined: true };

    const traceColor = await nextTraceColor(input.searchId);
    try {
      await prisma.searchParticipant.create({
        data: { searchId: input.searchId, userId: ctx.user.id, role: "SEARCHER", traceColor },
      });
    } catch {
      // Colour raced with another joiner — join without one; the UI falls back.
      await prisma.searchParticipant.create({
        data: { searchId: input.searchId, userId: ctx.user.id, role: "SEARCHER" },
      });
    }

    const url = `${APP_URL}/dogs/${search.dogId}`;
    if (search.dog.ownerId !== ctx.user.id) {
      await notify(search.dog.ownerId, {
        type: "FRIEND_JOINED_SEARCH",
        title: `${displayName(ctx.user)} joined the search for ${search.dog.name}`,
        data: { searchId: search.id, dogId: search.dogId },
        url,
      });
    }
    await notifyFriends(ctx.user.id, {
      type: "FRIEND_JOINED_SEARCH",
      title: `${displayName(ctx.user)} joined the search for ${search.dog.name}`,
      body: "Lend a hand?",
      data: { searchId: search.id, dogId: search.dogId },
      url,
    });
    void emitToSearch(search.id, "participant:joined", { userId: ctx.user.id });
    // Joining a search can unlock First Steps / Search Party / Century Searcher.
    await evaluateAchievements(ctx.user.id);
    return { joined: true };
  }),

  leave: protectedProcedure.input(z.object({ searchId: z.string() })).mutation(async ({ input, ctx }) => {
    await prisma.searchParticipant.deleteMany({
      where: { searchId: input.searchId, userId: ctx.user.id, role: { not: "OWNER" } },
    });
    return { left: true };
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(60),
        breed: z.string().max(60).optional(),
        color: z.string().max(40).optional(),
        size: z.enum(DOG_SIZES).optional(),
        description: z.string().max(1000).optional(),
        chipNumber: z.string().max(40).optional(),
        contentLang: z.string().max(5).optional(),
        // Image embeddings computed in the browser (one per photo), used to
        // rank this dog against street photos later.
        embeddings: z.array(z.array(z.number()).max(2048)).max(4).optional(),
        contactPhone: z.string().max(30).optional(),
        photos: z.array(imageSchema).max(4).optional(),
        homeLat: z.number().optional(),
        homeLng: z.number().optional(),
        lastSeenLat: z.number().optional(),
        lastSeenLng: z.number().optional(),
        lastSeenAddress: z.string().max(200).optional(),
        telegramGroupLink: httpUrlSchema.optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dog = await prisma.dog.create({
        data: {
          name: input.name,
          breed: input.breed,
          color: input.color,
          size: input.size,
          description: input.description,
          chipNumber: input.chipNumber?.trim() || null,
          contentLang: input.contentLang || null,
          embeddingsJson: input.embeddings?.length ? JSON.stringify(input.embeddings) : null,
          status: "LOST",
          contactPhone: input.contactPhone ? normalizePhone(input.contactPhone) : ctx.user.phone,
          ownerId: ctx.user.id,
          homeLat: input.homeLat,
          homeLng: input.homeLng,
          photosJson: JSON.stringify(input.photos ?? []),
        },
      });
      // New listings wait for developer review before going public. Friends are
      // deliberately NOT notified yet — that happens on approval, so nobody is
      // alerted about a listing that may be rejected.
      const search = await prisma.search.create({
        data: {
          dogId: dog.id,
          status: "PENDING",
          telegramGroupLink: input.telegramGroupLink,
          lastSeenLat: input.lastSeenLat,
          lastSeenLng: input.lastSeenLng,
          lastSeenAddress: input.lastSeenAddress,
          lastSeenAt: new Date(),
          // The reporter is the first participant, so they get the first colour.
          participants: { create: { userId: ctx.user.id, role: "OWNER", traceColor: TRACE_COLOR_HEXES[0] } },
        },
      });

      // Let the developer(s) know there's something to review.
      const devs = await prisma.user.findMany({
        where: { isDeveloper: true, bannedAt: null },
        select: { id: true },
      });
      await Promise.all(
        devs
          .filter((d) => d.id !== ctx.user.id)
          .map((d) =>
            notify(d.id, {
              type: "LISTING_REPORTED",
              title: `🕵️ New listing awaiting review: ${dog.name}`,
              body: `From ${displayName(ctx.user)}`,
              data: { searchId: search.id, dogId: dog.id },
              url: `${APP_URL}/dogs/${dog.id}`,
            })
          )
      );

      // The reporter becomes an OWNER participant — may unlock First Steps.
      await evaluateAchievements(ctx.user.id);
      return { searchId: search.id, dogId: dog.id, status: search.status };
    }),

  archive: protectedProcedure
    .input(z.object({ searchId: z.string(), outcome: z.enum(["FOUND", "HOME"]).default("HOME") }))
    .mutation(async ({ input, ctx }) => {
      const search = await prisma.search.findUnique({ where: { id: input.searchId }, include: { dog: true } });
      if (!search) throw new TRPCError({ code: "NOT_FOUND" });
      if (search.dog.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      await prisma.search.update({
        where: { id: input.searchId },
        data: { status: "ARCHIVED", endedAt: new Date() },
      });
      await prisma.dog.update({ where: { id: search.dogId }, data: { status: input.outcome } });

      const participants = await prisma.searchParticipant.findMany({
        where: { searchId: input.searchId },
        select: { userId: true },
      });
      await Promise.all(
        participants
          .filter((p) => p.userId !== ctx.user.id)
          .map((p) =>
            notify(p.userId, {
              type: "SEARCH_ARCHIVED",
              title: `${search.dog.name} is ${input.outcome === "HOME" ? "home" : "found"}! 🎉`,
              body: "Thanks for helping search.",
              data: { searchId: search.id },
            })
          )
      );

      // The dog is now FOUND/HOME, so every participant's dogsFound went up —
      // evaluate all of them (Finder / Guardian Angel), the owner included.
      await Promise.all(participants.map((p) => evaluateAchievements(p.userId)));
      return { archived: true };
    }),

  // Attaches image embeddings computed in the owner's browser, after the fact,
  // so reporting a lost dog is never delayed by model loading.
  setDogEmbeddings: protectedProcedure
    .input(
      z.object({
        dogId: z.string(),
        embeddings: z.array(z.array(z.number()).max(2048)).min(1).max(4),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const dog = await prisma.dog.findUnique({ where: { id: input.dogId } });
      if (!dog) throw new TRPCError({ code: "NOT_FOUND" });
      if (dog.ownerId !== ctx.user.id && !ctx.user.isDeveloper) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await prisma.dog.update({
        where: { id: input.dogId },
        data: { embeddingsJson: JSON.stringify(input.embeddings) },
      });
      return { ok: true };
    }),

  // Developer-only: permanently delete a dog and its search (cascades to
  // participants, sightings, POIs, coverage).
  deleteDog: devProcedure.input(z.object({ dogId: z.string() })).mutation(async ({ input }) => {
    await prisma.dog.delete({ where: { id: input.dogId } });
    return { ok: true };
  }),
});
