import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/db";
import { displayName } from "@/lib/format";
import { notify } from "@/lib/notify";
import { getFriendIds } from "@/lib/social";

export const friendRouter = router({
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(40) }))
    .query(async ({ input, ctx }) => {
      const q = input.query.replace(/^@/, "");
      const users = await prisma.user.findMany({
        where: {
          id: { not: ctx.user.id },
          username: { contains: q },
        },
        take: 12,
      });
      const friendIds = new Set(await getFriendIds(ctx.user.id));
      const pending = await prisma.friendship.findMany({
        where: {
          status: "PENDING",
          OR: [
            { fromId: ctx.user.id },
            { toId: ctx.user.id },
          ],
        },
      });
      const pendingWith = new Map<string, "OUTGOING" | "INCOMING">();
      for (const f of pending) {
        if (f.fromId === ctx.user.id) pendingWith.set(f.toId, "OUTGOING");
        else pendingWith.set(f.fromId, "INCOMING");
      }
      return users.map((u) => ({
        id: u.id,
        name: displayName(u),
        username: u.username,
        photoUrl: u.photoUrl,
        isFriend: friendIds.has(u.id),
        pending: pendingWith.get(u.id) ?? null,
      }));
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const [accepted, incoming] = await Promise.all([
      prisma.friendship.findMany({
        where: { status: "ACCEPTED", OR: [{ fromId: ctx.user.id }, { toId: ctx.user.id }] },
        include: { from: true, to: true },
      }),
      prisma.friendship.findMany({
        where: { status: "PENDING", toId: ctx.user.id },
        include: { from: true },
      }),
    ]);
    const friends = accepted.map((f) => {
      const other = f.fromId === ctx.user.id ? f.to : f.from;
      return { id: other.id, name: displayName(other), username: other.username, photoUrl: other.photoUrl };
    });
    const requests = incoming.map((f) => ({
      friendshipId: f.id,
      id: f.from.id,
      name: displayName(f.from),
      username: f.from.username,
      photoUrl: f.from.photoUrl,
    }));
    return { friends, requests };
  }),

  request: protectedProcedure.input(z.object({ userId: z.string() })).mutation(async ({ input, ctx }) => {
    if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST" });
    const target = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!target) throw new TRPCError({ code: "NOT_FOUND" });

    // If the other side already requested us, accept instead.
    const reverse = await prisma.friendship.findUnique({
      where: { fromId_toId: { fromId: input.userId, toId: ctx.user.id } },
    });
    if (reverse) {
      await prisma.friendship.update({ where: { id: reverse.id }, data: { status: "ACCEPTED" } });
      await notify(input.userId, {
        type: "FRIEND_ACCEPTED",
        title: `${displayName(ctx.user)} accepted your friend request`,
      });
      return { status: "ACCEPTED" as const };
    }

    await prisma.friendship.upsert({
      where: { fromId_toId: { fromId: ctx.user.id, toId: input.userId } },
      create: { fromId: ctx.user.id, toId: input.userId, status: "PENDING" },
      update: {},
    });
    await notify(input.userId, {
      type: "FRIEND_REQUEST",
      title: `${displayName(ctx.user)} sent you a friend request`,
      data: { userId: ctx.user.id, username: ctx.user.username },
    });
    return { status: "PENDING" as const };
  }),

  respond: protectedProcedure
    .input(z.object({ friendshipId: z.string(), accept: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const f = await prisma.friendship.findUnique({ where: { id: input.friendshipId } });
      if (!f || f.toId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (input.accept) {
        await prisma.friendship.update({ where: { id: f.id }, data: { status: "ACCEPTED" } });
        await notify(f.fromId, {
          type: "FRIEND_ACCEPTED",
          title: `${displayName(ctx.user)} accepted your friend request`,
        });
        return { status: "ACCEPTED" as const };
      }
      await prisma.friendship.delete({ where: { id: f.id } });
      return { status: "DECLINED" as const };
    }),

  remove: protectedProcedure.input(z.object({ userId: z.string() })).mutation(async ({ input, ctx }) => {
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { fromId: ctx.user.id, toId: input.userId },
          { fromId: input.userId, toId: ctx.user.id },
        ],
      },
    });
    return { removed: true };
  }),
});
