import { prisma } from "@/lib/db";
import { ALPHA_ENDS_AT } from "@/lib/constants";

export interface UserStats {
  searchesJoined: number;
  activeSearches: number;
  dogsFound: number;
  metersCovered: number;
  secondsSpent: number;
  sightingsReported: number;
  bugsReported: number;
  // 1 if the account was created within the alpha window (see ALPHA_ENDS_AT).
  alphaMember: number;
}

// Aggregate stats for a user, computed from participation + owned/found dogs.
export async function computeUserStats(userId: string): Promise<UserStats> {
  const [participations, agg, dogsFound, sightingsReported, bugsReported, user] = await Promise.all([
    prisma.searchParticipant.findMany({
      where: { userId },
      select: { secondsSpent: true, metersCovered: true, search: { select: { status: true } } },
    }),
    prisma.searchParticipant.aggregate({
      where: { userId },
      _sum: { secondsSpent: true, metersCovered: true },
    }),
    // Dogs the user helped find: searches they participated in whose dog is now FOUND/HOME.
    prisma.searchParticipant.count({
      where: {
        userId,
        search: { dog: { status: { in: ["FOUND", "HOME"] } } },
      },
    }),
    prisma.sightingPin.count({ where: { userId } }),
    prisma.bugReport.count({ where: { reporterId: userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);

  return {
    searchesJoined: participations.length,
    activeSearches: participations.filter((p) => p.search.status === "ACTIVE").length,
    dogsFound,
    metersCovered: Math.round(agg._sum.metersCovered ?? 0),
    secondsSpent: agg._sum.secondsSpent ?? 0,
    sightingsReported,
    bugsReported,
    alphaMember: user && user.createdAt <= ALPHA_ENDS_AT ? 1 : 0,
  };
}
