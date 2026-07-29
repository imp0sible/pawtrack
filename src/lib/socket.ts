"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

// Fetches a fresh short-lived token for each (re)connection so the realtime
// worker can authenticate the socket.
async function authToken(cb: (data: { token?: string }) => void) {
  try {
    const res = await fetch("/api/realtime-token");
    if (!res.ok) return cb({});
    const { token } = await res.json();
    cb({ token });
  } catch {
    cb({});
  }
}

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
    socket = io(url, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      withCredentials: true,
      auth: authToken,
    });
  }
  return socket;
}
