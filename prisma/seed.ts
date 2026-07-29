import "dotenv/config";
import { prisma } from "@/lib/db";
import { pathMeters } from "@/lib/geo";
import { ensureAchievements, evaluateAchievements } from "@/lib/achievements";
import { DEVELOPER } from "@/lib/dev";
import { hashPassword } from "@/lib/password";

// Base location that all seeded geo data clusters around (central London).
const BASE = { lat: 51.5074, lng: -0.1278 };

function jitter(base: number, spreadDeg: number): number {
  return base + (Math.random() - 0.5) * spreadDeg;
}

function point(spread = 0.03): [number, number] {
  return [jitter(BASE.lat, spread), jitter(BASE.lng, spread)];
}

function walk(steps = 12, spread = 0.012): Array<[number, number]> {
  const start = point(0.02);
  const pts: Array<[number, number]> = [start];
  for (let i = 1; i < steps; i++) {
    const [plat, plng] = pts[i - 1];
    pts.push([plat + (Math.random() - 0.5) * spread * 0.3, plng + (Math.random() - 0.5) * spread * 0.3]);
  }
  return pts;
}

async function reset() {
  // Order matters for FK integrity.
  await prisma.streetDogSighting.deleteMany();
  await prisma.bugResponse.deleteMany();
  await prisma.bugReport.deleteMany();
  await prisma.devlogEntry.deleteMany();
  await prisma.tgAuthToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.coverageSegment.deleteMany();
  await prisma.pointOfInterest.deleteMany();
  await prisma.sightingPin.deleteMany();
  await prisma.searchParticipant.deleteMany();
  await prisma.search.deleteMany();
  await prisma.dog.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("Resetting database…");
  await reset();
  await ensureAchievements();

  console.log("Creating users…");
  const usersData = [
    { telegramId: "2000000001" as string | null, username: "alexr", firstName: "Alex", lastName: "Rivera", bio: "Dog dad. Cyclist. Always out looking.", phone: "+447700900001", passwordHash: null as string | null, isDeveloper: false },
    { telegramId: "2000000002" as string | null, username: "samchen", firstName: "Sam", lastName: "Chen", bio: "Vet tech, volunteer searcher.", phone: "+447700900002", passwordHash: null as string | null, isDeveloper: false },
    { telegramId: "2000000003" as string | null, username: "mariag", firstName: "Maria", lastName: "Gomez", bio: "Neighborhood watch + foster mom.", phone: "+447700900003", passwordHash: null as string | null, isDeveloper: false },
    { telegramId: "2000000004" as string | null, username: "tomf", firstName: "Tom", lastName: "Fisher", bio: "Runs the local shelter's night shift.", phone: "+447700900004", passwordHash: null as string | null, isDeveloper: false },
    { telegramId: "2000000005" as string | null, username: "priyap", firstName: "Priya", lastName: "Patel", bio: "Drone hobbyist, helps map coverage.", phone: "+447700900005", passwordHash: null as string | null, isDeveloper: false },
    // Built-in developer account — log in with @developer + password.
    { telegramId: null as string | null, username: DEVELOPER.username, firstName: DEVELOPER.firstName, lastName: DEVELOPER.lastName, bio: DEVELOPER.bio, phone: DEVELOPER.phone, passwordHash: hashPassword(DEVELOPER.password), isDeveloper: true },
  ];

  const users = [];
  for (const u of usersData) {
    users.push(
      await prisma.user.create({
        data: {
          ...u,
          settings: { create: {} },
        },
      })
    );
  }
  const [alex, sam, maria, tom, priya, dev] = users;

  console.log("Creating dogs & searches…");

  const dogSpecs = [
    { name: "Bella", breed: "Golden Retriever", color: "Golden", size: "LARGE", owner: alex, status: "LOST", desc: "Friendly, wearing a red collar with a bell. Answers to Bella. Slightly limps on left hind leg.", photo: "bella" },
    { name: "Rocky", breed: "Beagle", color: "Tricolor", size: "MEDIUM", owner: sam, status: "LOST", desc: "Very food-motivated, may follow anyone with treats. Microchipped. Scared of traffic.", photo: "rocky" },
    { name: "Luna", breed: "Border Collie", color: "Black & White", size: "MEDIUM", owner: maria, status: "LOST", desc: "High energy, herds people. Blue harness. Do not chase — call her name and crouch.", photo: "luna" },
    { name: "Max", breed: "Dachshund", color: "Brown", size: "SMALL", owner: tom, status: "LOST", desc: "Tiny, fast, timid. Green tag with phone number. Likely hiding under cars or bushes.", photo: "max" },
    { name: "Coco", breed: "Poodle mix", color: "Apricot", size: "SMALL", owner: priya, status: "LOST", desc: "Recently groomed. No collar. Very shy with strangers; approach slowly.", photo: "coco" },
    { name: "Buddy", breed: "Labrador", color: "Black", size: "LARGE", owner: alex, status: "HOME", desc: "Reunited with family after 3 days thanks to searchers!", photo: "buddy" },
  ];

  const searches = [];
  for (let i = 0; i < dogSpecs.length; i++) {
    const spec = dogSpecs[i];
    const isArchived = spec.status === "HOME";
    const homeLoc = point(0.04);
    const lastSeen = point(0.03);
    const startedAt = new Date(Date.now() - (i + 1) * 6 * 3600 * 1000);

    const dog = await prisma.dog.create({
      data: {
        name: spec.name,
        breed: spec.breed,
        color: spec.color,
        size: spec.size,
        description: spec.desc,
        status: spec.status,
        contentLang: "en", // seeded cards are written in English
        contactPhone: spec.owner.phone,
        ownerId: spec.owner.id,
        homeLat: homeLoc[0],
        homeLng: homeLoc[1],
        photosJson: JSON.stringify([`https://placedog.net/500/380?id=${10 + i}`]),
      },
    });

    const search = await prisma.search.create({
      data: {
        dogId: dog.id,
        status: isArchived ? "ARCHIVED" : "ACTIVE",
        telegramGroupLink: `https://t.me/+seedgroup${i}${spec.name.toLowerCase()}`,
        lastSeenLat: lastSeen[0],
        lastSeenLng: lastSeen[1],
        lastSeenAddress: ["Near Hyde Park", "By the canal", "Camden Market area", "Riverside path", "Behind the station", "Home"][i],
        lastSeenAt: new Date(startedAt.getTime() + 3600 * 1000),
        startedAt,
        endedAt: isArchived ? new Date() : null,
      },
    });
    searches.push({ search, dog, owner: spec.owner });
  }

  console.log("Adding participants, sightings, POIs, coverage…");
  const poiTypes = ["TRASH_BIN", "SHOP", "FLYER_SPOT", "OTHER"] as const;

  for (let i = 0; i < searches.length; i++) {
    const { search, owner } = searches[i];

    // Owner is always a participant with OWNER role.
    await prisma.searchParticipant.create({
      data: { searchId: search.id, userId: owner.id, role: "OWNER", secondsSpent: 5400, metersCovered: 3200 },
    });

    // A rotating subset of other users join each search.
    const others = users.filter((u) => u.id !== owner.id);
    const joinCount = 2 + (i % 3);
    for (let j = 0; j < joinCount; j++) {
      const u = others[(i + j) % others.length];
      const secs = 1200 + Math.floor(Math.random() * 6000);
      const segs = walk();
      const meters = Math.round(pathMeters(segs));
      await prisma.searchParticipant.create({
        data: { searchId: search.id, userId: u.id, role: "SEARCHER", secondsSpent: secs, metersCovered: meters },
      });
      await prisma.coverageSegment.create({
        data: { searchId: search.id, userId: u.id, pointsJson: JSON.stringify(segs), meters, source: "APP" },
      });
    }

    // Sightings.
    const sightingCount = 1 + (i % 3);
    for (let s = 0; s < sightingCount; s++) {
      const [lat, lng] = point(0.025);
      const reporter = others[(i + s) % others.length];
      await prisma.sightingPin.create({
        data: {
          searchId: search.id,
          userId: reporter.id,
          lat,
          lng,
          note: ["Saw a dog matching this description running north", "Someone fed a stray here this morning", "Barking heard near the alley", "Possible sighting by the bins"][s % 4],
          seenAt: new Date(Date.now() - Math.floor(Math.random() * 5 * 3600 * 1000)),
        },
      });
    }

    // Points of interest.
    for (let p = 0; p < 4; p++) {
      const [lat, lng] = point(0.02);
      await prisma.pointOfInterest.create({
        data: {
          searchId: search.id,
          type: poiTypes[p % poiTypes.length],
          lat,
          lng,
          note: null,
          addedById: owner.id,
        },
      });
    }
  }

  console.log("Creating friendships…");
  // The developer account is friends with Alex and Sam; a pending request from Maria.
  await prisma.friendship.create({ data: { fromId: dev.id, toId: alex.id, status: "ACCEPTED" } });
  await prisma.friendship.create({ data: { fromId: dev.id, toId: sam.id, status: "ACCEPTED" } });
  await prisma.friendship.create({ data: { fromId: maria.id, toId: dev.id, status: "PENDING" } });
  await prisma.friendship.create({ data: { fromId: alex.id, toId: sam.id, status: "ACCEPTED" } });

  console.log("Seeding devlog…");
  await prisma.devlogEntry.create({
    data: {
      version: "0.0.1",
      kind: "MINOR",
      title: "PawTrack is live",
      body: "Initial build: report lost dogs, search together with live map coverage, phone/password and Telegram login, printable posters, achievements, a bug tracker, and English / Russian / Serbian support.",
    },
  });

  console.log("Evaluating achievements…");
  for (const u of users) {
    await evaluateAchievements(u.id);
  }

  const counts = {
    users: await prisma.user.count(),
    dogs: await prisma.dog.count(),
    searches: await prisma.search.count(),
    participants: await prisma.searchParticipant.count(),
    sightings: await prisma.sightingPin.count(),
    pois: await prisma.pointOfInterest.count(),
    coverage: await prisma.coverageSegment.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
