import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, devProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/db";
import { displayName } from "@/lib/format";
import { evaluateAchievements } from "@/lib/achievements";
import { notify } from "@/lib/notify";
import { parseStringArray } from "@/lib/json";
import { imageSchema as screenshot } from "@/lib/validators";

export const bugRouter = router({
  // Anyone signed in can file a bug report.
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(140),
        description: z.string().min(5).max(4000),
        screenshots: z.array(screenshot).max(4).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const report = await prisma.bugReport.create({
        data: {
          reporterId: ctx.user.id,
          title: input.title.trim(),
          description: input.description.trim(),
          screenshotsJson: JSON.stringify(input.screenshots ?? []),
        },
      });

      // Reporting bugs can unlock achievements (Bug Hunter, Beta Tester).
      await evaluateAchievements(ctx.user.id);

      // Let the developer(s) know a new bug came in.
      const devs = await prisma.user.findMany({ where: { isDeveloper: true }, select: { id: true } });
      await Promise.all(
        devs
          .filter((d) => d.id !== ctx.user.id)
          .map((d) =>
            notify(d.id, {
              type: "BUG_REPORTED",
              title: `🐛 New bug report: ${input.title.trim()}`,
              body: `From ${displayName(ctx.user)}`,
            })
          )
      );

      return { id: report.id };
    }),

  // The reporter's own reports (to see status + responses).
  mine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await prisma.bugReport.findMany({
      where: { reporterId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      include: { responses: { orderBy: { createdAt: "asc" } } },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      createdAt: r.createdAt,
      screenshots: parseStringArray(r.screenshotsJson),
      responses: r.responses.map((x) => ({ id: x.id, body: x.body, createdAt: x.createdAt })),
    }));
  }),

  // Developer-only: full list.
  listAll: devProcedure
    .input(z.object({ status: z.enum(["ALL", "OPEN", "CLOSED"]).default("ALL") }))
    .query(async ({ input }) => {
      const rows = await prisma.bugReport.findMany({
        where: input.status === "ALL" ? {} : { status: input.status },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          reporter: true,
          responses: { orderBy: { createdAt: "asc" } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt,
        screenshots: parseStringArray(r.screenshotsJson),
        reporter: {
          name: displayName(r.reporter),
          username: r.reporter.username,
          telegramConnected: !!r.reporter.telegramId,
        },
        responses: r.responses.map((x) => ({ id: x.id, body: x.body, createdAt: x.createdAt })),
      }));
    }),

  openCount: devProcedure.query(async () => {
    return prisma.bugReport.count({ where: { status: "OPEN" } });
  }),

  setStatus: devProcedure
    .input(z.object({ id: z.string(), status: z.enum(["OPEN", "CLOSED"]) }))
    .mutation(async ({ input }) => {
      await prisma.bugReport.update({ where: { id: input.id }, data: { status: input.status } });
      return { ok: true };
    }),

  // Developer-only: reply to a report. Delivered to the reporter in-app + via
  // the Telegram bot (if they've connected Telegram).
  respond: devProcedure
    .input(z.object({ id: z.string(), body: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      const report = await prisma.bugReport.findUnique({ where: { id: input.id } });
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });

      await prisma.bugResponse.create({ data: { reportId: report.id, body: input.body.trim() } });

      await notify(report.reporterId, {
        type: "BUG_RESPONSE",
        title: `Reply to your bug report: ${report.title}`,
        body: input.body.trim(),
      });

      return { ok: true };
    }),
});
