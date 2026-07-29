"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { useRoomEvents } from "@/lib/use-realtime";
import { timeAgo } from "@/lib/format";

export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const unread = trpc.notification.unreadCount.useQuery(undefined, { refetchInterval: 30000 });
  const list = trpc.notification.list.useQuery({ limit: 20 }, { enabled: open });
  const markAll = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  useRoomEvents(`user:${userId}`, {
    notification: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const count = unread.data ?? 0;

  return (
    <div className="relative">
      <button
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span className="font-semibold">Notifications</span>
              <button
                className="text-xs text-[var(--brand-strong)] hover:underline"
                onClick={() => markAll.mutate()}
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {list.isLoading && <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">Loading…</p>}
              {list.data?.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">You're all caught up.</p>
              )}
              {list.data?.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-[var(--border)] px-4 py-3 last:border-0 ${
                    n.read ? "opacity-70" : "bg-[var(--brand-soft)]/40"
                  }`}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-[var(--muted)]">{n.body}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
