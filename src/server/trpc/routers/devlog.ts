import { z } from "zod";
import { router, publicProcedure, devProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/db";
import { nextVersion } from "@/lib/devlog";

export const devlogRouter = router({
  // Public: anyone can read the devlog.
  list: publicProcedure.query(async () => {
    const rows = await prisma.devlogEntry.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((e) => ({
      id: e.id,
      version: e.version,
      title: e.title,
      body: e.body,
      kind: e.kind,
      createdAt: e.createdAt,
    }));
  }),

  latest: publicProcedure.query(async () => {
    const e = await prisma.devlogEntry.findFirst({ orderBy: { createdAt: "desc" } });
    return e ? { version: e.version } : { version: "0.0.0" };
  }),

  // Developer-only: add an entry. The version auto-increments from the latest.
  create: devProcedure
    .input(
      z.object({
        title: z.string().min(2).max(140),
        body: z.string().min(2).max(4000),
        kind: z.enum(["MAJOR", "MINOR"]).default("MINOR"),
      })
    )
    .mutation(async ({ input }) => {
      const latest = await prisma.devlogEntry.findFirst({ orderBy: { createdAt: "desc" } });
      const version = nextVersion(latest?.version, input.kind);
      const entry = await prisma.devlogEntry.create({
        data: { version, title: input.title.trim(), body: input.body.trim(), kind: input.kind },
      });
      return { id: entry.id, version: entry.version };
    }),
});
