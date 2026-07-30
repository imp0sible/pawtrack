import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/db";
import { displayName } from "@/lib/format";
import { computeUserStats } from "@/lib/stats";
import { areFriends } from "@/lib/social";
import { ACHIEVEMENT_DEFS } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/password";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import { optionalImageSchema } from "@/lib/validators";

export const userRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    return {
      id: ctx.user.id,
      name: displayName(ctx.user),
      username: ctx.user.username,
      firstName: ctx.user.firstName,
      lastName: ctx.user.lastName,
      photoUrl: ctx.user.photoUrl,
      bio: ctx.user.bio,
      phone: ctx.user.phone,
      hasPassword: !!ctx.user.passwordHash,
      telegramConnected: !!ctx.user.telegramId,
      isDeveloper: ctx.user.isDeveloper,
    };
  }),

  profile: publicProcedure
    .input(z.object({ username: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const target = input.username
        ? await prisma.user.findUnique({ where: { username: input.username } })
        : ctx.user
          ? await prisma.user.findUnique({ where: { id: ctx.user.id } })
          : null;
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const [stats, earned] = await Promise.all([
        computeUserStats(target.id),
        prisma.userAchievement.findMany({
          where: { userId: target.id },
          include: { achievement: true },
          orderBy: { earnedAt: "desc" },
        }),
      ]);

      const earnedKeys = new Set(earned.map((e) => e.achievement.key));
      const achievements = ACHIEVEMENT_DEFS.map((def) => ({
        key: def.key,
        name: def.name,
        description: def.description,
        icon: def.icon,
        earned: earnedKeys.has(def.key),
        earnedAt: earned.find((e) => e.achievement.key === def.key)?.earnedAt ?? null,
      }));

      const isSelf = ctx.user?.id === target.id;
      const friend = !isSelf && ctx.user ? await areFriends(ctx.user.id, target.id) : false;

      return {
        id: target.id,
        name: displayName(target),
        username: target.username,
        photoUrl: target.photoUrl,
        bio: target.bio,
        isDeveloper: target.isDeveloper,
        // Ban state is shown to the account itself and to developers moderating.
        bannedAt: isSelf || ctx.user?.isDeveloper ? target.bannedAt : null,
        banReason: isSelf || ctx.user?.isDeveloper ? target.banReason : null,
        // Phone is private: only the owner sees it on their own profile.
        phone: isSelf ? target.phone : null,
        telegramConnected: isSelf ? !!target.telegramId : false,
        joinedAt: target.createdAt,
        isSelf,
        isFriend: friend,
        stats,
        achievements,
      };
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        bio: z.string().max(300).optional(),
        // Either an http(s) URL or a small raster data URL from the cropper.
        photoUrl: optionalImageSchema.optional(),
        phone: z.string().optional(),
        // Optional: lets Telegram/dev accounts set a password to enable login.
        password: z.string().min(6).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let phone: string | undefined;
      if (input.phone !== undefined) {
        if (!isValidPhone(input.phone)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid phone number." });
        }
        phone = normalizePhone(input.phone);
        const clash = await prisma.user.findUnique({ where: { phone } });
        if (clash && clash.id !== ctx.user.id) {
          throw new TRPCError({ code: "CONFLICT", message: "That phone number is already in use." });
        }
      }

      await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl || null } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(input.password ? { passwordHash: hashPassword(input.password) } : {}),
        },
      });
      return { ok: true };
    }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string().optional(), newPassword: z.string().min(6) }))
    .mutation(async ({ input, ctx }) => {
      // If a password is already set, the current one must be provided + correct.
      if (ctx.user.passwordHash) {
        if (!input.currentPassword || !verifyPassword(input.currentPassword, ctx.user.passwordHash)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
        }
      }
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: { passwordHash: hashPassword(input.newPassword) },
      });
      return { ok: true };
    }),

  // Permanently deletes the account and everything it owns. All related rows
  // (dogs → searches → sightings/coverage/participants, friendships, bug
  // reports, notifications, settings, etc.) cascade from the User row. The
  // client clears the session cookie afterward via /api/auth/logout.
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.user.delete({ where: { id: ctx.user.id } });
    return { ok: true };
  }),

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await prisma.userSettings.upsert({
      where: { userId: ctx.user.id },
      create: { userId: ctx.user.id },
      update: {},
    });
    return {
      soundsEnabled: settings.soundsEnabled,
      notificationsEnabled: settings.notificationsEnabled,
      geolocationEnabled: settings.geolocationEnabled,
      friendActivityAlerts: settings.friendActivityAlerts,
      traceFadeMinutes: settings.traceFadeMinutes,
    };
  }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        soundsEnabled: z.boolean().optional(),
        notificationsEnabled: z.boolean().optional(),
        geolocationEnabled: z.boolean().optional(),
        friendActivityAlerts: z.boolean().optional(),
        // 0 = never fade ("all time").
        traceFadeMinutes: z.number().int().min(0).max(1440).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await prisma.userSettings.upsert({
        where: { userId: ctx.user.id },
        create: { userId: ctx.user.id, ...input },
        update: input,
      });
      return { ok: true };
    }),
});
