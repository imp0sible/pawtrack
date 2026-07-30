import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "@/server/trpc/context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  }
  // A banned account keeps its session but can't act: every authenticated
  // mutation and query goes through here, so this is the single chokepoint.
  if (ctx.user.bannedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This account has been banned." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Only the developer account may call these.
export const devProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user.isDeveloper) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Developers only" });
  }
  return next({ ctx });
});
