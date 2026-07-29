import { en, type MessageKey } from "./en";
import { ru } from "./ru";
import { sr } from "./sr";
import type { Locale } from "../locales";

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, ru, sr };
export type { MessageKey };
