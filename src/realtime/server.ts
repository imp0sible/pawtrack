import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server as SocketServer } from "socket.io";
import { startBot } from "@/realtime/bot";
import { prisma } from "@/lib/db";
import { verifySessionToken } from "@/lib/jwt";
import { internalApiSecret } from "@/lib/secrets";

const PORT = Number(process.env.REALTIME_PORT ?? 3001);
const SECRET = internalApiSecret();
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const httpServer = createServer((req, res) => handleHttp(req, res));

const io = new SocketServer(httpServer, {
  cors: { origin: APP_ORIGIN, methods: ["GET", "POST"], credentials: true },
});

// Authenticate the socket from the short-lived token in the handshake. A socket
// with no valid token connects but carries no identity, so it can't join any
// private room.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  socket.data.userId = typeof token === "string" ? await verifySessionToken(token) : null;
  next();
});

// Is this user allowed to receive events for this room?
async function canJoin(userId: string | null, room: string): Promise<boolean> {
  if (!userId) return false;

  if (room.startsWith("user:")) {
    // Only ever your own user room.
    return room === `user:${userId}`;
  }

  if (room.startsWith("search:")) {
    const searchId = room.slice("search:".length);
    const search = await prisma.search.findUnique({ where: { id: searchId }, select: { status: true } });
    if (!search) return false;
    // Active searches are viewable by any signed-in user (same as the dog page).
    if (search.status === "ACTIVE") return true;
    // Archived searches: participants only.
    const part = await prisma.searchParticipant.findUnique({
      where: { searchId_userId: { searchId, userId } },
      select: { id: true },
    });
    return Boolean(part);
  }

  return false;
}

io.on("connection", (socket) => {
  socket.on("join", async (room: string) => {
    if (typeof room !== "string") return;
    if (await canJoin(socket.data.userId as string | null, room)) {
      socket.join(room);
    }
  });
  socket.on("leave", (room: string) => {
    if (typeof room === "string") socket.leave(room);
  });
});

// Shared emit used by both the /emit bridge and the bot.
export function emitToRoom(room: string, event: string, payload: unknown) {
  io.to(room).emit(event, payload);
}

function roomFor(target: { kind: string; id: string }): string | null {
  if (target.kind === "search") return `search:${target.id}`;
  if (target.kind === "user") return `user:${target.id}`;
  return null;
}

async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url === "/emit" && req.method === "POST") {
    if (req.headers["x-internal-secret"] !== SECRET) {
      res.writeHead(403).end("forbidden");
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { target, event, payload } = JSON.parse(body);
        const room = roomFor(target);
        if (room) emitToRoom(room, event, payload);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400).end("bad request");
      }
    });
    return;
  }

  res.writeHead(404).end("not found");
}

httpServer.listen(PORT, () => {
  console.log(`[realtime] socket.io + bridge listening on :${PORT}`);
  startBot(emitToRoom).catch((e) => console.error("[bot] failed to start:", e));
});
