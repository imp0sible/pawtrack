import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import type { NotificationType } from "@/lib/constants";

// Accepted-friend user ids for a user (friendship is symmetric once accepted).
export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ fromId: userId }, { toId: userId }] },
    select: { fromId: true, toId: true },
  });
  return rows.map((r) => (r.fromId === userId ? r.toId : r.fromId));
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const row = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { fromId: a, toId: b },
        { fromId: b, toId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function notifyFriends(
  userId: string,
  payload: { type: NotificationType; title: string; body?: string; data?: Record<string, unknown>; url?: string }
): Promise<void> {
  const friendIds = await getFriendIds(userId);
  await Promise.all(friendIds.map((id) => notify(id, payload)));
}
