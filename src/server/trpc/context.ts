import { getSessionUser } from "@/lib/auth";

export async function createContext() {
  const user = await getSessionUser();
  return { user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
