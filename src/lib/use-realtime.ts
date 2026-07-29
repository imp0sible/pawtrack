"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";

type Handler = (payload: unknown) => void;

// Subscribes to socket.io events for a given room ("search:<id>" or
// "user:<id>"). No-op if the realtime worker is unreachable.
export function useRoomEvents(room: string | null, handlers: Record<string, Handler>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!room) return;
    const socket = getSocket();
    const join = () => socket.emit("join", room);
    join();
    socket.on("connect", join);

    const bound: Array<[string, Handler]> = Object.keys(handlersRef.current).map((event) => {
      const fn: Handler = (payload) => handlersRef.current[event]?.(payload);
      socket.on(event, fn);
      return [event, fn];
    });

    return () => {
      socket.emit("leave", room);
      socket.off("connect", join);
      bound.forEach(([event, fn]) => socket.off(event, fn));
    };
  }, [room]);
}
