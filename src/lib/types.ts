export interface Family {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string | null;
  role: string;
  nickname: string;
  avatar_emoji: string;
  is_child: boolean;
  /** @deprecated Use immersion_enabled instead. Will be removed after migration. */
  is_child_mode: boolean;
  /** Replaces is_child_mode. Controls Immersion mode per profile (PRD §5.2). */
  immersion_enabled: boolean | null;
  /** Per-profile UI language: 'en' | 'af' | 'xh' (PRD §9.2). Not yet read/written by the UI. */
  language: string;
  color: string;
  gender: string | null;
  age_group: string | null;
  created_at: string;
}

// ── PRD v0.3 age group bands (§2.2) ──────────────────────────────────────────
// Named tiers for the new immersion mode and age-adaptive UI.
// Legacy values '10-15' and '16-21' are kept for backward compat until migration.
export const AGE_GROUPS = [
  "0-2",            // Little ones
  "3-5",            // Explorers
  "6-9",            // Adventurers
  "10-12",          // Navigators  (NEW — split from old '10-15')
  "13-17",          // Travellers  (NEW — merges old upper '10-15' + '16-21')
  "18-21",          // Adults (sub-band)
  "22-35",          // Adults (sub-band)
  "36-65",          // Adults (sub-band)
  "66+",            // Adults (sub-band)
  "prefer_not_to_say",
  // Legacy — kept so existing rows don't break; resolved as 'needs-review'
  "10-15",
  "16-21",
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

// Display labels — shown in profile pickers and settings
export const AGE_GROUP_LABELS: Record<string, string> = {
  "0-2":             "0–2 (Little ones)",
  "3-5":             "3–5 (Explorers)",
  "6-9":             "6–9 (Adventurers)",
  "10-12":           "10–12 (Navigators)",
  "13-17":           "13–17 (Travellers)",
  "18-21":           "18–21",
  "22-35":           "22–35",
  "36-65":           "36–65",
  "66+":             "66+",
  "prefer_not_to_say": "Prefer not to say",
  // Legacy labels for existing records awaiting parent review
  "10-15":           "10–15 (please update)",
  "16-21":           "16–21 (please update)",
};

// Picker-visible groups only (excludes legacy and prefer_not_to_say from the main picker)
export const AGE_GROUPS_PICKER = [
  "0-2", "3-5", "6-9", "10-12", "13-17", "18-21", "22-35", "36-65", "66+", "prefer_not_to_say",
] as const;

// Per-tier immersion defaults (PRD §5.2)
export const IMMERSION_DEFAULT: Record<string, boolean> = {
  "0-2":   false,  // Little ones — later phase, parent-operated
  "3-5":   true,   // Explorers — on by default
  "6-9":   true,   // Adventurers — on by default
  "10-12": true,   // Navigators — on by default
  "13-17": false,  // Travellers — offered but off
  "18-21": false,
  "22-35": false,
  "36-65": false,
  "66+":   false,
  "prefer_not_to_say": false,
};

// Named tier labels used in Immersion mode and age-adaptive UI
export const AGE_TIER_NAMES: Record<string, string> = {
  "0-2":   "Little ones",
  "3-5":   "Explorers",
  "6-9":   "Adventurers",
  "10-12": "Navigators",
  "13-17": "Travellers",
};

// Accent colours per tier (used in avatars, badges, cards)
export const AGE_GROUP_COLORS: Record<string, string> = {
  "0-2":   "#F4A0B0",  // soft pink
  "3-5":   "#F4A562",  // warm orange — Explorers
  "6-9":   "#F2C94C",  // golden — Adventurers
  "10-12": "#6BBEA0",  // teal — Navigators
  "13-17": "#4EA8C8",  // sky blue — Travellers
  "18-21": "#5B8EDA",
  "22-35": "#5B8EDA",
  "36-65": "#7C6BD6",
  "66+":   "#C47AC8",
  "prefer_not_to_say": "#9AA5B4",
  // Legacy
  "10-15": "#6BBEA0",
  "16-21": "#4EA8C8",
  "Unknown": "#CBD5E0",
};

// Returns true if this age_group needs a parent review (legacy band)
export function ageGroupNeedsReview(ageGroup: string | null): boolean {
  return ageGroup === "10-15" || ageGroup === "16-21";
}

export const SUPPORTED_LANGUAGES = ["en", "af", "xh"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// First-run language, taken from the browser/OS locale (PRD §9.2). Falls back
// to English when the device locale isn't one of the MVP's three languages.
export function detectLanguage(): SupportedLanguage {
  const locale = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  if (locale.startsWith("af")) return "af";
  if (locale.startsWith("xh")) return "xh";
  return "en";
}

export interface Invite {
  id: string;
  family_id: string;
  invited_by: string | null;
  member_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Book {
  id: string;
  family_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  cover_url: string | null;
  cover_storage_path: string | null;
  page_count: number | null;
  added_by: string | null;
  created_at: string;
}

export interface ReadingProgress {
  id: string;
  book_id: string;
  member_id: string;
  current_page: number;
  status: "want_to_read" | "reading" | "finished";
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface Rating {
  id: string;
  book_id: string;
  member_id: string;
  parent_rating: number | null;
  reader_rating: number | null;
  review: string | null;
  created_at: string;
  updated_at: string;
}

export const MEMBER_COLORS = [
  "#3B6E52",
  "#C4556A",
  "#2D6B9F",
  "#D4622A",
  "#7B4F9E",
  "#2D8B8A",
  "#C4922A",
  "#4A6B7A",
  "#6B4F3A",
  "#5B6E3B",
];

export const PARENT_ROLES = [
  "Mom", "Dad", "Grandma", "Grandpa", "Aunt", "Uncle", "Guardian", "Other",
];

export const CHILD_ROLES = [
  "Son", "Daughter", "Brother", "Sister", "Grandson", "Granddaughter", "Other",
];

const MASCULINE_ROLES = new Set(["Dad", "Grandpa", "Uncle", "Son", "Brother", "Grandson"]);
const FEMININE_ROLES = new Set(["Mom", "Grandma", "Aunt", "Daughter", "Sister", "Granddaughter"]);

export function genderFromRole(role: string): string {
  if (MASCULINE_ROLES.has(role)) return "Male";
  if (FEMININE_ROLES.has(role)) return "Female";
  return "";
}

export type ReadingStatus = "want_to_read" | "reading" | "finished";

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  want_to_read: "Want to Read",
  reading: "Reading",
  finished: "Finished",
};

// ── Reading Clubs ─────────────────────────────────────────────────────────────

export type ClubRole = "owner" | "admin" | "member";
export type JoinRequestStatus = "pending" | "approved" | "rejected";

export type ClubType = "social" | "educational";

export interface Club {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  is_public: boolean;
  invite_token: string;
  created_by: string | null;
  created_at: string;
  city: string | null;
  suburb: string | null;
  club_type: ClubType;
  commenting_enabled: boolean;
  profanity_filter: boolean;
  // joined via query
  member_count?: number;
  my_role?: ClubRole;
}

export interface ReadingGroup {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  age_min: number | null;
  age_max: number | null;
  created_at: string;
}

export interface ClubJoinRequest {
  id: string;
  club_id: string;
  family_member_id: string;
  status: JoinRequestStatus;
  message: string | null;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface ClubMember {
  id: string;
  club_id: string;
  family_member_id: string;
  role: ClubRole;
  joined_at: string;
  // joined via query
  family_member?: FamilyMember;
}

export interface ClubBook {
  id: string;
  club_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  cover_url: string | null;
  page_count: number | null;
  added_by: string | null;
  added_at: string;
  is_current_read: boolean;
  read_target_date: string | null;
  reading_group_id: string | null;
}

export interface ClubReadingProgress {
  id: string;
  club_book_id: string;
  member_id: string;
  current_page: number;
  status: ReadingStatus;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface ClubNotification {
  id: string;
  club_id: string;
  member_id: string;
  type: "new_book" | "new_member" | "milestone" | "invite" | "join_request";
  title: string;
  seen: boolean;
  created_at: string;
}

export interface ClubTopic {
  id: string;
  club_id: string;
  club_book_id: string | null;
  created_by: string;
  title: string;
  body: string | null;
  commenting_allowed: boolean;
  threads_allowed: boolean;
  profanity_filter: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClubTopicComment {
  id: string;
  topic_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  is_deleted: boolean;
  created_at: string;
  // joined via query
  author?: FamilyMember;
}

export interface ClubCommentBlock {
  id: string;
  club_id: string;
  member_id: string;
  blocked_at: string;
}

// ── Schools (PRD §10) ────────────────────────────────────────────────────────
// A school is its own top-level entity, distinct from Reading Clubs — see
// PRD.md §10.2. Grades contain classes; classes contain learners.

export type SchoolRole = "admin" | "teacher";

export interface School {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  city: string | null;
  suburb: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SchoolMember {
  id: string;
  school_id: string;
  family_member_id: string;
  role: SchoolRole;
  class_id: string | null; // set when a teacher is scoped to one class; null for admins
  created_at: string;
  // joined via query
  family_member?: FamilyMember;
}

export interface Grade {
  id: string;
  school_id: string;
  name: string;
  order_index: number;
  created_at: string;
}

export interface SchoolClass {
  id: string;
  grade_id: string;
  school_id: string;
  name: string;
  join_code: string;
  created_at: string;
}

export interface ClassLearner {
  id: string;
  class_id: string;
  school_id: string;
  family_member_id: string | null; // null until claimed (school-created) or always set (linked)
  nickname: string;
  avatar_emoji: string;
  is_school_created: boolean;
  handover_code: string | null;
  handover_code_expires_at: string | null;
  claimed_at: string | null;
  added_by: string | null;
  created_at: string;
}

export interface SchoolStaffInvite {
  id: string;
  school_id: string;
  role: SchoolRole;
  class_id: string | null;
  code: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}
