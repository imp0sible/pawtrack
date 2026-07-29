import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Prisma 7 requires a driver adapter. We use libsql (prebuilt binaries, no
// native compile). Locally this points at the SQLite file; in production it can
// point at a remote Turso database (libsql://…) — same adapter, just a URL +
// auth token. The DB path is the same one prisma.config.ts uses for migrations
// so runtime and migrate agree.
const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
// Required only for a remote Turso database; ignored for a local file.
const authToken = process.env.TURSO_AUTH_TOKEN;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const adapter = new PrismaLibSql({
    url: databaseUrl,
    ...(authToken ? { authToken } : {}),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
