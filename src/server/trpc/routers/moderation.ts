import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, devProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/db";
import { displayName } from "@/lib/format";
import { notify } from "@/lib/notify";
import { notifyFriends } from "@/lib/social";
import { USER_REPORT_REASONS } from "@/lib/constants";
import { parseStringArray } from "@/lib/json";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const REASONS = ["SCAM", "INAPPROPRIATE", "WRONG_INFO", "SPAM", "OTHER"] as const;

// Tells every developer about something needing review.
async function notifyDevelopers(
  exceptUserId: string,
  input: { type: "LISTING_REPORTED" | "USER_REPORTED"; title: string; body?: string }
) {
  const devs = await prisma.user.findMany({
    where: { isDeveloper: true, bannedAt: null },
    select: { id: true },
  });
  await Promise.all(
    devs.filter((d) => d.id !== exceptUserId).map((d) => notify(d.id, input))
  );
}

export const moderationRouter = router({
  // Any signed-in user can flag a listing for review.
  report: protectedProcedure
    .input(
      z.object({
        searchId: z.string(),
        reason: z.enum(REASONS),
        note: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const search = await prisma.search.findUnique({
        where: { id: input.searchId },
        include: { dog: true },
      });
      if (!search) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });

      // One open report per user per listing — quietly succeed on repeats so a
      // double-tap doesn't spam the queue.
      const existing = await prisma.listingReport.findFirst({
        where: { searchId: input.searchId, reporterId: ctx.user.id, status: "OPEN" },
      });
      if (existing) return { ok: true, deduped: true };

      await prisma.listingReport.create({
        data: {
          searchId: input.searchId,
          reporterId: ctx.user.id,
          reason: input.reason,
          note: input.note?.trim() || null,
        },
      });

      await notifyDevelopers(ctx.user.id, {
        type: "LISTING_REPORTED",
        title: `🚩 Listing reported: ${search.dog.name}`,
        body: `${input.reason} — from ${displayName(ctx.user)}`,
      });

      return { ok: true };
    }),

  openCount: devProcedure.query(async () => {
    return prisma.listingReport.count({ where: { status: "OPEN" } });
  }),

  listAll: devProcedure
    .input(z.object({ status: z.enum(["ALL", "OPEN", "REVIEWED", "DISMISSED"]).default("OPEN") }))
    .query(async ({ input }) => {
      const rows = await prisma.listingReport.findMany({
        where: input.status === "ALL" ? {} : { status: input.status },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          reporter: true,
          search: { include: { dog: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        reason: r.reason,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
        reporter: { name: displayName(r.reporter), username: r.reporter.username },
        listing: {
          searchId: r.searchId,
          dogId: r.search.dogId,
          dogName: r.search.dog.name,
          dogStatus: r.search.dog.status,
          searchStatus: r.search.status,
        },
      }));
    }),

  resolve: devProcedure
    .input(z.object({ id: z.string(), status: z.enum(["REVIEWED", "DISMISSED", "OPEN"]) }))
    .mutation(async ({ input }) => {
      await prisma.listingReport.update({ where: { id: input.id }, data: { status: input.status } });
      return { ok: true };
    }),

  // ---------------------------------------------------------------- users ----

  // Any signed-in user can report another user.
  reportUser: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        reason: z.enum(USER_REPORT_REASONS),
        note: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't report yourself." });
      }
      const target = await prisma.user.findUnique({ where: { id: input.userId } });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // One open report per reporter/target so a double-tap doesn't spam the queue.
      const existing = await prisma.userReport.findFirst({
        where: { reporterId: ctx.user.id, targetId: input.userId, status: "OPEN" },
      });
      if (existing) return { ok: true, deduped: true };

      await prisma.userReport.create({
        data: {
          reporterId: ctx.user.id,
          targetId: input.userId,
          reason: input.reason,
          note: input.note?.trim() || null,
        },
      });

      await notifyDevelopers(ctx.user.id, {
        type: "USER_REPORTED",
        title: `🚩 User reported: ${displayName(target)}`,
        body: `${input.reason} — from ${displayName(ctx.user)}`,
      });

      return { ok: true };
    }),

  openUserReportCount: devProcedure.query(async () => {
    return prisma.userReport.count({ where: { status: "OPEN" } });
  }),

  listUserReports: devProcedure
    .input(z.object({ status: z.enum(["ALL", "OPEN", "REVIEWED", "DISMISSED"]).default("OPEN") }))
    .query(async ({ input }) => {
      const rows = await prisma.userReport.findMany({
        where: input.status === "ALL" ? {} : { status: input.status },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: { reporter: true, target: true },
      });
      return rows.map((r) => ({
        id: r.id,
        reason: r.reason,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
        reporter: { name: displayName(r.reporter), username: r.reporter.username },
        target: {
          id: r.target.id,
          name: displayName(r.target),
          username: r.target.username,
          bannedAt: r.target.bannedAt,
          banReason: r.target.banReason,
          isDeveloper: r.target.isDeveloper,
        },
      }));
    }),

  resolveUserReport: devProcedure
    .input(z.object({ id: z.string(), status: z.enum(["REVIEWED", "DISMISSED", "OPEN"]) }))
    .mutation(async ({ input }) => {
      await prisma.userReport.update({ where: { id: input.id }, data: { status: input.status } });
      return { ok: true };
    }),

  banUser: devProcedure
    .input(z.object({ userId: z.string(), reason: z.string().max(500).optional() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't ban yourself." });
      }
      const target = await prisma.user.findUnique({ where: { id: input.userId } });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (target.isDeveloper) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Developer accounts can't be banned." });
      }

      await prisma.user.update({
        where: { id: input.userId },
        data: { bannedAt: new Date(), banReason: input.reason?.trim() || null },
      });

      // Best-effort heads-up; the ban itself already took effect.
      try {
        await notify(input.userId, {
          type: "ACCOUNT_BANNED",
          title: "Your PawTrack account has been suspended",
          body: input.reason?.trim() || undefined,
        });
      } catch {}

      return { ok: true };
    }),

  unbanUser: devProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.user.update({
        where: { id: input.userId },
        data: { bannedAt: null, banReason: null },
      });
      return { ok: true };
    }),

  // ------------------------------------------------- listing approvals ----

  pendingCount: devProcedure.query(async () => {
    return prisma.search.count({ where: { status: "PENDING" } });
  }),

  // Listings awaiting review (oldest first — first reported, first checked).
  listPending: devProcedure
    .input(z.object({ status: z.enum(["PENDING", "REJECTED"]).default("PENDING") }))
    .query(async ({ input }) => {
      const rows = await prisma.search.findMany({
        where: { status: input.status },
        orderBy: { startedAt: "asc" },
        include: { dog: { include: { owner: true } } },
      });
      return rows.map((s) => ({
        searchId: s.id,
        dogId: s.dogId,
        status: s.status,
        startedAt: s.startedAt,
        reviewNote: s.reviewNote,
        lastSeenAddress: s.lastSeenAddress,
        dog: {
          name: s.dog.name,
          breed: s.dog.breed,
          color: s.dog.color,
          size: s.dog.size,
          description: s.dog.description,
          chipNumber: s.dog.chipNumber,
          photos: parseStringArray(s.dog.photosJson),
          contactPhone: s.dog.contactPhone ?? s.dog.owner.phone,
        },
        owner: {
          id: s.dog.owner.id,
          name: displayName(s.dog.owner),
          username: s.dog.owner.username,
          bannedAt: s.dog.owner.bannedAt,
        },
      }));
    }),

  // Approve publishes the listing (and only now notifies the reporter's friends,
  // so nobody is alerted about an unreviewed listing). Reject keeps it private
  // with a reason the owner can see.
  reviewSearch: devProcedure
    .input(
      z.object({
        searchId: z.string(),
        decision: z.enum(["APPROVE", "REJECT"]),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const search = await prisma.search.findUnique({
        where: { id: input.searchId },
        include: { dog: { include: { owner: true } } },
      });
      if (!search) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });

      const approved = input.decision === "APPROVE";
      await prisma.search.update({
        where: { id: input.searchId },
        data: {
          status: approved ? "ACTIVE" : "REJECTED",
          reviewedAt: new Date(),
          reviewedById: ctx.user.id,
          reviewNote: input.note?.trim() || null,
        },
      });

      const ownerId = search.dog.ownerId;
      const url = `${APP_URL}/dogs/${search.dogId}`;
      if (approved) {
        await notify(ownerId, {
          type: "SEARCH_APPROVED",
          title: `${search.dog.name}'s search is live 🐾`,
          body: "Your listing was approved and is now visible to the community.",
          data: { searchId: search.id, dogId: search.dogId },
          url,
        });
        // Deferred from creation until approval.
        await notifyFriends(ownerId, {
          type: "FRIEND_POSTED_DOG",
          title: `${displayName(search.dog.owner)} reported a lost dog: ${search.dog.name}`,
          body: search.lastSeenAddress ? `Last seen ${search.lastSeenAddress}` : undefined,
          data: { searchId: search.id, dogId: search.dogId },
          url,
        });
      } else {
        await notify(ownerId, {
          type: "SEARCH_REJECTED",
          title: `${search.dog.name}'s listing wasn't approved`,
          body: input.note?.trim() || "Please review the details and try again.",
          data: { searchId: search.id, dogId: search.dogId },
          url,
        });
      }

      return { ok: true, status: approved ? "ACTIVE" : "REJECTED" };
    }),
});
