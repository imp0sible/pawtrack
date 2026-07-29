import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, devProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/db";
import { displayName } from "@/lib/format";
import { notify } from "@/lib/notify";

const REASONS = ["SCAM", "INAPPROPRIATE", "WRONG_INFO", "SPAM", "OTHER"] as const;

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

      const devs = await prisma.user.findMany({ where: { isDeveloper: true }, select: { id: true } });
      await Promise.all(
        devs
          .filter((d) => d.id !== ctx.user.id)
          .map((d) =>
            notify(d.id, {
              type: "LISTING_REPORTED",
              title: `🚩 Listing reported: ${search.dog.name}`,
              body: `${input.reason} — from ${displayName(ctx.user)}`,
            })
          )
      );

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
});
