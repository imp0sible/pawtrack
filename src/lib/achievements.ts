import { prisma } from "@/lib/db";
import { ACHIEVEMENT_DEFS } from "@/lib/constants";
import { computeUserStats, type UserStats } from "@/lib/stats";
import { notify } from "@/lib/notify";

// Ensures the Achievement rows exist (idempotent), returns a key->id map.
export async function ensureAchievements(): Promise<Map<string, string>> {
  const existing = await prisma.achievement.findMany({ select: { id: true, key: true } });
  const map = new Map(existing.map((a) => [a.key, a.id]));
  const missing = ACHIEVEMENT_DEFS.filter((d) => !map.has(d.key));
  for (const def of missing) {
    const created = await prisma.achievement.create({
      data: {
        key: def.key,
        name: def.name,
        description: def.description,
        icon: def.icon,
        metric: def.metric,
        threshold: def.threshold,
      },
      select: { id: true, key: true },
    });
    map.set(created.key, created.id);
  }
  return map;
}

// Checks all thresholds for a user and awards any newly-earned achievements.
// Returns the newly-awarded definition keys.
export async function evaluateAchievements(
  userId: string,
  stats?: UserStats
): Promise<string[]> {
  const s = stats ?? (await computeUserStats(userId));
  const keyToId = await ensureAchievements();

  const alreadyEarned = new Set(
    (
      await prisma.userAchievement.findMany({
        where: { userId },
        select: { achievement: { select: { key: true } } },
      })
    ).map((ua) => ua.achievement.key)
  );

  const newlyEarned: string[] = [];
  for (const def of ACHIEVEMENT_DEFS) {
    if (alreadyEarned.has(def.key)) continue;
    if (s[def.metric] >= def.threshold) {
      const achievementId = keyToId.get(def.key);
      if (!achievementId) continue;
      await prisma.userAchievement.create({ data: { userId, achievementId } });
      newlyEarned.push(def.key);
      await notify(userId, {
        type: "ACHIEVEMENT_UNLOCKED",
        title: `Achievement unlocked: ${def.name}`,
        body: def.description,
        data: { key: def.key, icon: def.icon },
      });
    }
  }
  return newlyEarned;
}
