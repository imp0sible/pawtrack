import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/db";
import { parseJsonObject } from "@/lib/json";

export const notificationRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(50).default(20) })).query(
    async ({ input, ctx }) => {
      const rows = await prisma.notification.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
      return rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: parseJsonObject(n.dataJson),
        read: n.read,
        createdAt: n.createdAt,
      }));
    }
  ),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return prisma.notification.count({ where: { userId: ctx.user.id, read: false } });
  }),

  markRead: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    await prisma.notification.updateMany({
      where: { id: input.id, userId: ctx.user.id },
      data: { read: true },
    });
    return { ok: true };
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.notification.updateMany({
      where: { userId: ctx.user.id, read: false },
      data: { read: true },
    });
    return { ok: true };
  }),
});
