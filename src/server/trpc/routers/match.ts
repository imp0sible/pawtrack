import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/db";
import { haversine } from "@/lib/geo";
import { parseStringArray } from "@/lib/json";
import { displayName } from "@/lib/format";
import { notify } from "@/lib/notify";
import { emitToSearch } from "@/lib/realtime";
import { evaluateAchievements } from "@/lib/achievements";
import { bestSimilarity, bandFor, parseVectors } from "@/lib/vector";
import { imageSchema as photo } from "@/lib/validators";
import { isOpenSearch } from "@/lib/constants";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

const embedding = z.array(z.number()).max(2048);

export const matchRouter = router({
  /**
   * Candidate lost dogs for a photo taken at a place/time.
   * Geography + time do the heavy lifting; the optional embedding only
   * re-ranks what's already nearby.
   */
  findNearby: protectedProcedure
    .input(
      z.object({
        lat: z.number(),
        lng: z.number(),
        seenAt: z.date().optional(),
        radiusKm: z.number().min(1).max(500).default(50),
        embedding: embedding.optional(),
      })
    )
    .query(async ({ input }) => {
      const seenAt = input.seenAt ?? new Date();
      const rows = await prisma.search.findMany({
        // The dog must have gone missing before the photo was taken.
        where: { status: "ACTIVE", startedAt: { lte: seenAt } },
        include: { dog: true },
      });

      const here = { lat: input.lat, lng: input.lng };
      const radiusMeters = input.radiusKm * 1000;

      const candidates = rows
        .map((r) => {
          const distanceMeters =
            r.lastSeenLat != null && r.lastSeenLng != null
              ? haversine(here, { lat: r.lastSeenLat, lng: r.lastSeenLng })
              : null;

          const similarity = input.embedding
            ? bestSimilarity(input.embedding, parseVectors(r.dog.embeddingsJson))
            : null;

          return {
            searchId: r.id,
            dogId: r.dog.id,
            name: r.dog.name,
            breed: r.dog.breed,
            color: r.dog.color,
            size: r.dog.size,
            chipNumber: r.dog.chipNumber,
            photos: parseStringArray(r.dog.photosJson),
            lastSeenAddress: r.lastSeenAddress,
            startedAt: r.startedAt,
            distanceMeters,
            similarity,
            band: similarity != null ? bandFor(similarity) : null,
          };
        })
        // Keep anything within the radius; listings without coordinates can't
        // be ruled out on distance, so they stay in (ranked last).
        .filter((c) => c.distanceMeters == null || c.distanceMeters <= radiusMeters);

      candidates.sort((a, b) => {
        // Visually-scored candidates first, best similarity on top.
        const sa = a.similarity ?? -1;
        const sb = b.similarity ?? -1;
        if (sa !== sb) return sb - sa;
        const da = a.distanceMeters ?? Number.MAX_SAFE_INTEGER;
        const db = b.distanceMeters ?? Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
        return b.startedAt.getTime() - a.startedAt.getTime();
      });

      return {
        usedVisualMatching: Boolean(input.embedding),
        candidates: candidates.slice(0, 20),
      };
    }),

  /** Saves a street dog that didn't match anything — kept for retroactive matching. */
  createStreetSighting: protectedProcedure
    .input(
      z.object({
        photos: z.array(photo).min(1).max(4),
        embeddings: z.array(embedding).max(4).optional(),
        lat: z.number(),
        lng: z.number(),
        seenAt: z.date().optional(),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const row = await prisma.streetDogSighting.create({
        data: {
          reporterId: ctx.user.id,
          photosJson: JSON.stringify(input.photos),
          embeddingsJson: input.embeddings?.length ? JSON.stringify(input.embeddings) : null,
          lat: input.lat,
          lng: input.lng,
          seenAt: input.seenAt ?? new Date(),
          note: input.note,
        },
      });
      return { id: row.id };
    }),

  /**
   * The human confirmed a candidate: file it as a sighting on that search and
   * tell the owner. Only ever called after a person picks from the shortlist.
   */
  confirmMatch: protectedProcedure
    .input(
      z.object({
        searchId: z.string(),
        photos: z.array(photo).min(1).max(4),
        lat: z.number(),
        lng: z.number(),
        seenAt: z.date().optional(),
        note: z.string().max(500).optional(),
        streetSightingId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const search = await prisma.search.findUnique({
        where: { id: input.searchId },
        include: { dog: true },
      });
      if (!search) throw new TRPCError({ code: "NOT_FOUND" });
      // Open includes unlisted (PENDING) searches, so a match reported from a
      // shared link still reaches the owner.
      if (!isOpenSearch(search.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Search is closed" });
      }

      const seenAt = input.seenAt ?? new Date();
      const pin = await prisma.sightingPin.create({
        data: {
          searchId: input.searchId,
          userId: ctx.user.id,
          lat: input.lat,
          lng: input.lng,
          note: input.note ?? "Possible match from a street photo",
          photoUrl: input.photos[0],
          seenAt,
        },
        include: { user: true },
      });

      void emitToSearch(input.searchId, "sighting:added", {
        id: pin.id,
        lat: pin.lat,
        lng: pin.lng,
        note: pin.note,
        seenAt: pin.seenAt,
        by: displayName(pin.user),
      });

      // Tell the owner and everyone searching.
      const recipients = new Set<string>([search.dog.ownerId]);
      const participants = await prisma.searchParticipant.findMany({
        where: { searchId: input.searchId },
        select: { userId: true },
      });
      participants.forEach((p) => recipients.add(p.userId));
      recipients.delete(ctx.user.id);

      await Promise.all(
        [...recipients].map((userId) =>
          notify(userId, {
            type: "NEW_SIGHTING",
            title: `📷 Possible ${search.dog.name} sighting — photo attached`,
            body: input.note ?? "Someone photographed a dog that may be yours.",
            data: { searchId: input.searchId, dogId: search.dogId },
            url: `${APP_URL}/dogs/${search.dogId}`,
          })
        )
      );

      if (input.streetSightingId) {
        await prisma.streetDogSighting.updateMany({
          where: { id: input.streetSightingId, reporterId: ctx.user.id },
          data: { status: "MATCHED", matchedSearchId: input.searchId },
        });
      }

      // Filing a sighting can unlock Spotter / Eagle Eye.
      await evaluateAchievements(ctx.user.id);

      return { sightingId: pin.id, dogId: search.dogId };
    }),
});
