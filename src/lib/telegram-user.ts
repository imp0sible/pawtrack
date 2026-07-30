import { prisma } from "@/lib/db";

export interface TelegramProfile {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

// Finds or creates the PawTrack account for a Telegram identity. Shared by every
// Telegram sign-in path (Mini App, Login Widget, bot deep link) so they behave
// identically.
//
// `User.username` is unique, so the Telegram @username is only claimed when it's
// actually free. Writing it blindly throws a unique-constraint error and blocks
// the sign-in entirely — which is never an acceptable outcome for logging in.
export async function upsertTelegramUser(v: TelegramProfile) {
  const telegramId = String(v.id);
  const existing = await prisma.user.findUnique({ where: { telegramId } });

  let username: string | undefined;
  if (v.username) {
    const holder = await prisma.user.findUnique({
      where: { username: v.username },
      select: { id: true },
    });
    // Free, or already ours.
    if (!holder || (existing && holder.id === existing.id)) username = v.username;
  }

  const profile = {
    firstName: v.first_name,
    lastName: v.last_name,
    photoUrl: v.photo_url,
    ...(username ? { username } : {}),
  };

  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data: profile });
  }
  return prisma.user.create({
    data: { telegramId, ...profile, settings: { create: {} } },
  });
}
