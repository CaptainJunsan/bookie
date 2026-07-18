import { supabase } from "./supabase";
import type { FamilyMember } from "./types";

export type MilestoneType = "books" | "pages";

export interface Milestone {
  memberId: string;
  type: MilestoneType;
  value: number;
}

export interface PendingMilestone extends Milestone {
  member: FamilyMember;
}

// Generate book thresholds: 10, 20, 50, 100, 150, 200, 250, ...
function bookThresholds(max: number): number[] {
  const fixed = [10, 20, 50, 100];
  const dynamic: number[] = [];
  let n = 150;
  while (n <= max + 50) {
    dynamic.push(n);
    n += 50;
  }
  return [...fixed, ...dynamic].filter((v) => v <= max + 50);
}

// Generate page thresholds: 1000, 2000, 3000, ...
function pageThresholds(max: number): number[] {
  const out: number[] = [];
  let n = 1000;
  while (n <= max + 1000) {
    out.push(n);
    n += 1000;
  }
  return out;
}

export function crossedMilestones(
  type: MilestoneType,
  count: number,
  celebratedValues: Set<number>
): number[] {
  const thresholds =
    type === "books" ? bookThresholds(count) : pageThresholds(count);
  return thresholds.filter((v) => v <= count && !celebratedValues.has(v));
}

export async function fetchCelebratedMilestones(
  memberIds: string[]
): Promise<Record<string, Record<MilestoneType, Set<number>>>> {
  if (memberIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from("milestone_celebrations")
      .select("member_id, milestone_type, milestone_value")
      .in("member_id", memberIds);

    if (error) return {};

    const out: Record<string, Record<MilestoneType, Set<number>>> = {};
    for (const row of data ?? []) {
      const mid = row.member_id as string;
      const type = row.milestone_type as MilestoneType;
      if (!out[mid]) out[mid] = { books: new Set(), pages: new Set() };
      out[mid][type].add(row.milestone_value as number);
    }
    return out;
  } catch {
    return {};
  }
}

export async function markMilestoneCelebrated(
  memberId: string,
  type: MilestoneType,
  value: number
): Promise<void> {
  try {
    await supabase.from("milestone_celebrations").upsert(
      { member_id: memberId, milestone_type: type, milestone_value: value },
      { onConflict: "member_id,milestone_type,milestone_value", ignoreDuplicates: true }
    );
  } catch {
    // silently ignore — not critical
  }
}

// Compute per-member stats from existing progress+book data
export interface MemberStats {
  booksFinished: number;
  pagesRead: number;
}

export function computeMemberStats(
  memberId: string,
  progress: Array<{ member_id: string; status: string; current_page: number; book_id: string }>,
  books: Array<{ id: string; page_count: number | null }>
): MemberStats {
  const memberProgress = progress.filter((p) => p.member_id === memberId);
  const bookMap = new Map(books.map((b) => [b.id, b]));

  let booksFinished = 0;
  let pagesRead = 0;

  for (const p of memberProgress) {
    if (p.status === "finished") {
      booksFinished++;
      const book = bookMap.get(p.book_id);
      pagesRead += book?.page_count ?? p.current_page;
    } else if (p.status === "reading") {
      pagesRead += p.current_page;
    }
  }

  return { booksFinished, pagesRead };
}

// Derive pending milestones for all members given their stats + already-celebrated map
export function computePendingMilestones(
  allMembers: FamilyMember[],
  statsMap: Record<string, MemberStats>,
  celebratedMap: Record<string, Record<MilestoneType, Set<number>>>
): PendingMilestone[] {
  const pending: PendingMilestone[] = [];

  for (const member of allMembers) {
    const stats = statsMap[member.id];
    if (!stats) continue;
    const celebrated = celebratedMap[member.id] ?? { books: new Set(), pages: new Set() };

    const newBookMilestones = crossedMilestones("books", stats.booksFinished, celebrated.books);
    const newPageMilestones = crossedMilestones("pages", stats.pagesRead, celebrated.pages);

    for (const value of newBookMilestones) {
      pending.push({ memberId: member.id, type: "books", value, member });
    }
    for (const value of newPageMilestones) {
      pending.push({ memberId: member.id, type: "pages", value, member });
    }
  }

  // Sort: books milestones first, then pages; ascending value per type
  pending.sort((a, b) => {
    if (a.type !== b.type) return a.type === "books" ? -1 : 1;
    return a.value - b.value;
  });

  return pending;
}

export interface MilestoneContent {
  emoji: string;
  title: string;
  body: string;
  color: string;
}

const BOOK_EMOJI_MAP: Record<number, string> = {
  10: "🌟",
  20: "🔥",
  50: "📚",
  100: "🏆",
};

function bookEmoji(value: number): string {
  if (value <= 100) return BOOK_EMOJI_MAP[value] ?? "🎉";
  if (value <= 200) return "🌠";
  if (value <= 500) return "⚡";
  return "🌟";
}

function pageEmoji(value: number): string {
  if (value < 5000) return "📄";
  if (value < 10000) return "🗺️";
  return "🌊";
}

function pronoun(member: FamilyMember): { they: string; their: string; them: string } {
  const g = member.gender ?? "";
  if (g === "Male") return { they: "he", their: "his", them: "him" };
  if (g === "Female") return { they: "she", their: "her", them: "her" };
  return { they: "they", their: "their", them: "them" };
}

const BOOK_SELF_MESSAGES: Record<number, { title: string; body: string }> = {
  10: {
    title: "10 Books Read!",
    body: "You've officially earned your Bookworm badge. Ten books down and a whole world of stories still ahead of you!",
  },
  20: {
    title: "20 Books — Unstoppable!",
    body: "Twenty books! You've built a real reading habit now. The stories you've collected are shaping who you are.",
  },
  50: {
    title: "50 Books! A Full Shelf!",
    body: "Half a hundred books — that's practically a small library all to yourself. You're an inspiration to every reader in the family.",
  },
  100: {
    title: "100 Books! A Legend is Born!",
    body: "ONE HUNDRED BOOKS. Let that sink in. You've journeyed through a hundred worlds and come back wiser every time.",
  },
};

function selfBookMessage(value: number): { title: string; body: string } {
  if (BOOK_SELF_MESSAGES[value]) return BOOK_SELF_MESSAGES[value];
  return {
    title: `${value} Books Read!`,
    body: `${value} books — and you're still going! Every page you've turned is a story that's yours forever. Keep reading!`,
  };
}

function childBookMessage(
  child: FamilyMember,
  value: number
): { title: string; body: string } {
  const p = pronoun(child);
  const name = child.nickname;
  const messages: Record<number, { title: string; body: string }> = {
    10: {
      title: `${name} Read 10 Books!`,
      body: `Give ${p.them} a big high five! ${name} just hit ${p.their} first major reading milestone — 10 whole books finished. ${p.they.charAt(0).toUpperCase() + p.they.slice(1)}'s a bookworm now!`,
    },
    20: {
      title: `${name} Hit 20 Books!`,
      body: `Twenty books for ${name}! ${p.they.charAt(0).toUpperCase() + p.they.slice(1)}'s building an incredible reading habit. Stories are clearly ${p.their} thing.`,
    },
    50: {
      title: `${name} Read 50 Books!`,
      body: `Fifty books! ${name} is absolutely on fire. ${p.they.charAt(0).toUpperCase() + p.they.slice(1)}'s filling ${p.their} imagination with adventures and ideas — and it shows!`,
    },
    100: {
      title: `${name}: 100 Books! 🏆`,
      body: `ONE HUNDRED BOOKS! ${name} is officially a Reading Legend. What an achievement — you must be so proud. Make sure ${p.they} know how incredible this is!`,
    },
  };
  if (messages[value]) return messages[value];
  return {
    title: `${name} Read ${value} Books!`,
    body: `${value} books for ${name} and counting! ${p.they.charAt(0).toUpperCase() + p.they.slice(1)}'s unstoppable. Every book is a new world ${p.they} gets to explore.`,
  };
}

function selfPageMessage(value: number): { title: string; body: string } {
  const formatted = value.toLocaleString();
  if (value === 1000) {
    return {
      title: "1,000 Pages Turned!",
      body: "A thousand pages! You've read enough words to fill a full novel. Your reading journey is just getting started.",
    };
  }
  if (value < 10000) {
    return {
      title: `${formatted} Pages Read!`,
      body: `${formatted} pages of stories, ideas, and adventures — all inside your head. That's a remarkable dedication to reading.`,
    };
  }
  return {
    title: `${formatted} Pages! Epic Reader!`,
    body: `${formatted} pages. You've consumed the equivalent of an entire bookshelf. You're in rare company now — a truly dedicated reader.`,
  };
}

function childPageMessage(
  child: FamilyMember,
  value: number
): { title: string; body: string } {
  const p = pronoun(child);
  const name = child.nickname;
  const formatted = value.toLocaleString();
  if (value === 1000) {
    return {
      title: `${name} Turned 1,000 Pages!`,
      body: `A thousand pages! That's a whole novel's worth of stories that ${name} has read. ${p.they.charAt(0).toUpperCase() + p.they.slice(1)}'s a real reader now — celebrate ${p.them}!`,
    };
  }
  return {
    title: `${name}: ${formatted} Pages!`,
    body: `${formatted} pages read by ${name}! ${p.they.charAt(0).toUpperCase() + p.they.slice(1)}'s devouring stories and growing with every page. What a reader!`,
  };
}

export function getMilestoneContent(
  milestone: PendingMilestone,
  viewerMember: FamilyMember | null | undefined
): MilestoneContent {
  const isSelf = viewerMember?.id === milestone.member.id;
  const isChildMilestone = milestone.member.is_child;

  let title: string;
  let body: string;

  if (milestone.type === "books") {
    if (isSelf) {
      ({ title, body } = selfBookMessage(milestone.value));
    } else if (isChildMilestone) {
      ({ title, body } = childBookMessage(milestone.member, milestone.value));
    } else {
      // Another adult's milestone
      ({ title, body } = selfBookMessage(milestone.value));
      title = `${milestone.member.nickname}: ${title}`;
    }
    const emoji = bookEmoji(milestone.value);
    const color = milestone.member.color;
    return { emoji, title, body, color };
  } else {
    if (isSelf) {
      ({ title, body } = selfPageMessage(milestone.value));
    } else if (isChildMilestone) {
      ({ title, body } = childPageMessage(milestone.member, milestone.value));
    } else {
      ({ title, body } = selfPageMessage(milestone.value));
      title = `${milestone.member.nickname}: ${title}`;
    }
    const emoji = pageEmoji(milestone.value);
    const color = milestone.member.color;
    return { emoji, title, body, color };
  }
}
