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
  color: string;
  gender: string | null;
  created_at: string;
}

export interface Invite {
  id: string;
  family_id: string;
  invited_by: string | null;
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

export type ReadingStatus = "want_to_read" | "reading" | "finished";

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  want_to_read: "Want to Read",
  reading: "Reading",
  finished: "Finished",
};
