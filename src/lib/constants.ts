// Enum-like string unions (SQLite has no native enums).

export const DOG_STATUS = ["LOST", "FOUND", "HOME"] as const;
export type DogStatus = (typeof DOG_STATUS)[number];

export const SEARCH_STATUS = ["ACTIVE", "ARCHIVED"] as const;
export type SearchStatus = (typeof SEARCH_STATUS)[number];

export const POI_TYPES = ["TRASH_BIN", "SHOP", "FLYER_SPOT", "OTHER"] as const;
export type PoiType = (typeof POI_TYPES)[number];

export const POI_META: Record<PoiType, { label: string; icon: string }> = {
  TRASH_BIN: { label: "Trash bin", icon: "🗑️" },
  SHOP: { label: "Shop", icon: "🏪" },
  FLYER_SPOT: { label: "Flyer spot", icon: "📌" },
  OTHER: { label: "Other", icon: "📍" },
};

export const PARTICIPANT_ROLES = ["OWNER", "SEARCHER"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const FRIENDSHIP_STATUS = ["PENDING", "ACCEPTED"] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUS)[number];

export const DOG_SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;
export type DogSize = (typeof DOG_SIZES)[number];

export const NOTIFICATION_TYPES = [
  "NEW_SIGHTING",
  "FRIEND_JOINED_SEARCH",
  "FRIEND_POSTED_DOG",
  "FRIEND_REQUEST",
  "FRIEND_ACCEPTED",
  "ACHIEVEMENT_UNLOCKED",
  "SEARCH_ARCHIVED",
  "BUG_REPORTED",
  "BUG_RESPONSE",
  "LISTING_REPORTED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Feed sort modes.
export const SORT_MODES = [
  "START_TIME",
  "LOSS_LOCATION",
  "PARTICIPANTS",
  "ALPHABETICAL",
] as const;
export type SortMode = (typeof SORT_MODES)[number];

export const SORT_LABELS: Record<SortMode, string> = {
  START_TIME: "Newest",
  LOSS_LOCATION: "Nearest",
  PARTICIPANTS: "Most searchers",
  ALPHABETICAL: "A–Z",
};

// Achievement metrics correspond to aggregate stats computed per user.
export type AchievementMetric =
  | "searchesJoined"
  | "dogsFound"
  | "metersCovered"
  | "secondsSpent"
  | "sightingsReported"
  | "bugsReported";

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  metric: AchievementMetric;
  threshold: number;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { key: "first_search", name: "First Steps", description: "Joined your first search", icon: "🐾", metric: "searchesJoined", threshold: 1 },
  { key: "ten_searches", name: "Search Party", description: "Joined 10 searches", icon: "🔦", metric: "searchesJoined", threshold: 10 },
  { key: "hundred_searches", name: "Century Searcher", description: "Joined 100 searches", icon: "🏅", metric: "searchesJoined", threshold: 100 },
  { key: "first_find", name: "Finder", description: "Helped bring 1 dog home", icon: "🦴", metric: "dogsFound", threshold: 1 },
  { key: "ten_finds", name: "Guardian Angel", description: "Helped bring 10 dogs home", icon: "😇", metric: "dogsFound", threshold: 10 },
  { key: "km_covered", name: "Ground Coverage", description: "Covered 1 km on searches", icon: "👟", metric: "metersCovered", threshold: 1000 },
  { key: "ten_km_covered", name: "Marathoner", description: "Covered 10 km on searches", icon: "🏃", metric: "metersCovered", threshold: 10000 },
  { key: "one_hour", name: "Dedicated", description: "Spent 1 hour searching", icon: "⏱️", metric: "secondsSpent", threshold: 3600 },
  { key: "ten_hours", name: "Tireless", description: "Spent 10 hours searching", icon: "🌙", metric: "secondsSpent", threshold: 36000 },
  { key: "first_sighting", name: "Spotter", description: "Reported your first sighting", icon: "👀", metric: "sightingsReported", threshold: 1 },
  { key: "ten_sightings", name: "Eagle Eye", description: "Reported 10 sightings", icon: "🦅", metric: "sightingsReported", threshold: 10 },
  { key: "first_bug", name: "Bug Hunter", description: "Reported your first bug", icon: "🐛", metric: "bugsReported", threshold: 1 },
  { key: "beta_tester", name: "Beta Tester", description: "Reported 5 bugs to help improve PawTrack", icon: "🧪", metric: "bugsReported", threshold: 5 },
];
