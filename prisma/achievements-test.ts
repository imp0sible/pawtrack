/**
 * End-to-end achievement wiring test. Drives the REAL tRPC mutations a user
 * would trigger and checks whether the matching achievement actually unlocks.
 * This catches "the metric is right but nothing evaluates it" bugs.
 *
 * Run: npx tsx prisma/achievements-test.ts
 */
import { prisma } from "@/lib/db";
import { appRouter } from "@/server/trpc/root";
import { evaluateAchievements } from "@/lib/achievements";
import { ALPHA_ENDS_AT } from "@/lib/constants";

const PHONE_PREFIX = "+1999000"; // test users; cleaned up at the end

type FullUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>;
function loadUser(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { settings: true } });
}
function caller(user: FullUser) {
  return appRouter.createCaller({ user });
}
async function earned(userId: string): Promise<Set<string>> {
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievement: { select: { key: true } } },
  });
  return new Set(rows.map((r) => r.achievement.key));
}

async function makeUser(tag: string, phone: string): Promise<FullUser> {
  const u = await prisma.user.create({
    data: { firstName: tag, phone, passwordHash: "scrypt:x:y", settings: { create: {} } },
    include: { settings: true },
  });
  return u;
}

const results: { case: string; achievement: string; expected: boolean; got: boolean }[] = [];
function record(name: string, achievement: string, got: boolean, expected = true) {
  results.push({ case: name, achievement, expected, got });
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
}

async function main() {
  await cleanup(); // in case a prior run left rows

  const owner = await makeUser("TestOwner", PHONE_PREFIX + "001");
  let searcher = await makeUser("TestSearcher", PHONE_PREFIX + "002");

  // Owner reports a lost dog (owner becomes an OWNER participant).
  const ownerCaller = caller(owner);
  const { searchId } = await ownerCaller.search.create({
    name: "AchievementTestDog",
    lastSeenLat: 44.8,
    lastSeenLng: 20.46,
    lastSeenAddress: "Test",
  });

  // 1) Join a search -> First Steps (searchesJoined >= 1)
  await caller(searcher).search.join({ searchId });
  record("search.join", "first_search", (await earned(searcher.id)).has("first_search"));

  // 2) Report a sighting -> Spotter (sightingsReported >= 1)
  await caller(searcher).map.addSighting({ searchId, lat: 44.801, lng: 20.461, note: "test" });
  record("map.addSighting", "first_sighting", (await earned(searcher.id)).has("first_sighting"));

  // 3) Record coverage ~1.7km, 4000s -> Ground Coverage + Dedicated
  await caller(searcher).map.addCoverage({
    searchId,
    points: [
      [44.80, 20.46],
      [44.815, 20.46],
    ],
    secondsSpent: 4000,
  });
  {
    const e = await earned(searcher.id);
    record("map.addCoverage", "km_covered", e.has("km_covered"));
    record("map.addCoverage", "one_hour", e.has("one_hour"));
  }

  // 4) Report a bug -> Bug Hunter (bugsReported >= 1)
  await caller(searcher).bug.create({ title: "Test bug report", description: "Steps to reproduce the test." });
  record("bug.create", "first_bug", (await earned(searcher.id)).has("first_bug"));

  // 5) Owner marks the dog HOME -> Finder for the searcher (dogsFound >= 1)
  await ownerCaller.search.archive({ searchId, outcome: "HOME" });
  record("search.archive", "first_find", (await earned(searcher.id)).has("first_find"));

  // 6) Alpha Pioneer — the searcher was created now, inside the alpha window.
  record("alpha-era user", "alpha", (await earned(searcher.id)).has("alpha"));

  // 7) A user created AFTER the alpha window must NEVER earn it.
  const future = await makeUser("TestFuture", PHONE_PREFIX + "003");
  await prisma.user.update({
    where: { id: future.id },
    data: { createdAt: new Date(ALPHA_ENDS_AT.getTime() + 86_400_000) }, // 1 day past cutoff
  });
  await evaluateAchievements(future.id);
  record("post-alpha user", "alpha", (await earned(future.id)).has("alpha"), false);

  // Report
  let pass = 0;
  console.log("\n  case                 achievement      expected  got");
  console.log("  " + "-".repeat(55));
  for (const r of results) {
    const ok = r.got === r.expected;
    if (ok) pass++;
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${r.case.padEnd(17)} ${r.achievement.padEnd(15)}  ${String(r.expected).padEnd(8)} ${r.got}`
    );
  }
  console.log(`\n  ${pass}/${results.length} passed\n`);

  await cleanup();
  await prisma.$disconnect();
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
