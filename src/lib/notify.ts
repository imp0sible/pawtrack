import { prisma } from "@/lib/db";
import type { NotificationType } from "@/lib/constants";
import { sendTelegramMessage } from "@/lib/telegram-api";
import { emitToUser } from "@/lib/realtime";

interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  // If set, appended as a Telegram button/link line.
  url?: string;
}

// Records an in-app notification, pushes it live over socket.io, and (when the
// user allows it and the bot is configured) sends a Telegram message.
export async function notify(userId: string, input: NotifyInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  });
  if (!user) return;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      dataJson: JSON.stringify(input.data ?? {}),
    },
  });

  void emitToUser(userId, "notification", {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    createdAt: notification.createdAt,
  });

  const pushAllowed = user.settings?.notificationsEnabled ?? true;
  if (pushAllowed && user.telegramId) {
    const lines = [`<b>${escapeHtml(input.title)}</b>`];
    if (input.body) lines.push(escapeHtml(input.body));
    if (input.url) lines.push(input.url);
    void sendTelegramMessage(user.telegramId, lines.join("\n"));
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
