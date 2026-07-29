import { router } from "@/server/trpc/trpc";
import { searchRouter } from "@/server/trpc/routers/search";
import { mapRouter } from "@/server/trpc/routers/map";
import { userRouter } from "@/server/trpc/routers/user";
import { friendRouter } from "@/server/trpc/routers/friend";
import { notificationRouter } from "@/server/trpc/routers/notification";
import { bugRouter } from "@/server/trpc/routers/bug";
import { devlogRouter } from "@/server/trpc/routers/devlog";
import { matchRouter } from "@/server/trpc/routers/match";
import { moderationRouter } from "@/server/trpc/routers/moderation";

export const appRouter = router({
  search: searchRouter,
  map: mapRouter,
  user: userRouter,
  friend: friendRouter,
  notification: notificationRouter,
  bug: bugRouter,
  devlog: devlogRouter,
  match: matchRouter,
  moderation: moderationRouter,
});

export type AppRouter = typeof appRouter;
