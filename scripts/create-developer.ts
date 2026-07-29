/**
 * Creates (or updates) the developer account in production without touching any
 * other data — unlike `npm run seed`, which wipes and reseeds demo content.
 *
 * The password comes from the DEVELOPER_PASSWORD env var, so it never lives in
 * the repo. Run once after the first deploy:
 *
 *   DEVELOPER_PASSWORD='your-strong-password' npm run create:developer
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { DEVELOPER } from "@/lib/dev";

async function main() {
  const password = process.env.DEVELOPER_PASSWORD;
  if (!password || password.length < 8) {
    console.error("✗ Set DEVELOPER_PASSWORD to at least 8 characters, e.g.\n    DEVELOPER_PASSWORD='…' npm run create:developer");
    process.exit(1);
  }

  const passwordHash = hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { username: DEVELOPER.username } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, isDeveloper: true },
    });
    console.log(`✓ Updated developer account @${DEVELOPER.username} (password reset, isDeveloper=true).`);
  } else {
    await prisma.user.create({
      data: {
        username: DEVELOPER.username,
        firstName: DEVELOPER.firstName,
        phone: DEVELOPER.phone,
        bio: DEVELOPER.bio,
        isDeveloper: true,
        passwordHash,
        settings: { create: {} },
      },
    });
    console.log(`✓ Created developer account @${DEVELOPER.username}. Sign in with that username + your password.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
