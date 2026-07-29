import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/db";
import { pathMeters } from "@/lib/geo";
import { parsePath } from "@/lib/json";
import { displayName } from "@/lib/format";
import { notify } from "@/lib/notify";
import { emitToSearch } from "@/lib/realtime";
import { evaluateAchievements } from "@/lib/achievements";
import { POI_TYPES } from "@/lib/constants";

async function assertActiveSearch(searchId: string) {
  const search = await prisma.search.findUnique({ where: { id: searchId }, include: { dog: true } });
  if (!search) throw new TRPCError({ code: "NOT_FOUND" });
  if (search.status !== "ACTIVE") throw new TRPCError({ code: "BAD_REQUEST", message: "Search is closed" });
  return search;
}

export const mapRouter = router({
  addSighting: protectedProcedure
    .input(
      z.object({
        searchId: z.string(),
        lat: z.number(),
        lng: z.number(),
        note: z.string().max(500).optional(),
        seenAt: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const search = await assertActiveSearch(input.searchId);
      const pin = await prisma.sightingPin.create({
        data: {
          searchId: input.searchId,
          userId: ctx.user.id,
          lat: input.lat,
          lng: input.lng,
          note: input.note,
          seenAt: input.seenAt ?? new Date(),
        },
        include: { user: true },
      });

      const payload = {
        id: pin.id,
        lat: pin.lat,
        lng: pin.lng,
        note: pin.note,
        seenAt: pin.seenAt,
        by: displayName(pin.user),
      };
      void emitToSearch(input.searchId, "sighting:added", payload);

      // Notify other participants of the new sighting.
      const participants = await prisma.searchParticipant.findMany({
        where: { searchId: input.searchId, userId: { not: ctx.user.id } },
        select: { userId: true },
      });
      await Promise.all(
        participants.map((p) =>
          notify(p.userId, {
            type: "NEW_SIGHTING",
            title: `New ${search.dog.name} sighting reported`,
            body: input.note ?? undefined,
            data: { searchId: input.searchId, dogId: search.dogId },
            url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dogs/${search.dogId}`,
          })
        )
      );

      // Reporting a sighting can unlock Spotter / Eagle Eye.
      await evaluateAchievements(ctx.user.id);
      return payload;
    }),

  addPoi: protectedProcedure
    .input(
      z.object({
        searchId: z.string(),
        type: z.enum(POI_TYPES),
        lat: z.number(),
        lng: z.number(),
        note: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertActiveSearch(input.searchId);
      const poi = await prisma.pointOfInterest.create({
        data: {
          searchId: input.searchId,
          type: input.type,
          lat: input.lat,
          lng: input.lng,
          note: input.note,
          addedById: ctx.user.id,
        },
      });
      const payload = { id: poi.id, type: poi.type, lat: poi.lat, lng: poi.lng, note: poi.note };
      void emitToSearch(input.searchId, "poi:added", payload);
      return payload;
    }),

  removePoi: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const poi = await prisma.pointOfInterest.findUnique({
      where: { id: input.id },
      include: { search: { include: { dog: true } } },
    });
    if (!poi) throw new TRPCError({ code: "NOT_FOUND" });
    const isOwner = poi.search.dog.ownerId === ctx.user.id;
    if (poi.addedById !== ctx.user.id && !isOwner) throw new TRPCError({ code: "FORBIDDEN" });
    await prisma.pointOfInterest.delete({ where: { id: input.id } });
    void emitToSearch(poi.searchId, "poi:removed", { id: input.id });
    return { removed: true };
  }),

  // Records a walked path; adds to the searcher's covered meters and recomputes
  // achievements. Used by the app's "record my coverage" control (and mirrored
  // by the bot's live-location handler).
  addCoverage: protectedProcedure
    .input(
      z.object({
        searchId: z.string(),
        points: z.array(z.tuple([z.number(), z.number()])).min(2),
        secondsSpent: z.number().int().min(0).max(86400).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertActiveSearch(input.searchId);
      const meters = Math.round(pathMeters(input.points));

      const segment = await prisma.coverageSegment.create({
        data: {
          searchId: input.searchId,
          userId: ctx.user.id,
          pointsJson: JSON.stringify(input.points),
          meters,
          source: "APP",
        },
      });

      await prisma.searchParticipant.upsert({
        where: { searchId_userId: { searchId: input.searchId, userId: ctx.user.id } },
        create: {
          searchId: input.searchId,
          userId: ctx.user.id,
          role: "SEARCHER",
          metersCovered: meters,
          secondsSpent: input.secondsSpent ?? 0,
        },
        update: {
          metersCovered: { increment: meters },
          secondsSpent: { increment: input.secondsSpent ?? 0 },
        },
      });

      void emitToSearch(input.searchId, "coverage:added", {
        id: segment.id,
        points: parsePath(segment.pointsJson),
        by: displayName(ctx.user),
      });
      const unlocked = await evaluateAchievements(ctx.user.id);
      return { meters, unlocked };
    }),
});
