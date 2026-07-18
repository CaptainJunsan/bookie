import { supabase } from "./supabase";

export interface OverviewStats {
  total_families: number;
  total_members: number;
  total_children: number;
  total_books: number;
  total_finished: number;
  total_reading: number;
  total_want_to_read: number;
  pages_read: number;
  total_reviews: number;
  avg_rating: number | null;
  members_without_age_group: number;
  total_milestones: number;
}

export interface BookStat {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  page_count: number | null;
  finished_count: number;
  reading_count: number;
  want_to_read_count: number;
  total_interactions: number;
  avg_rating: number | null;
  review_count: number;
  age_groups: string[];
  latest_activity_at: string | null;
}

export interface AuthorStat {
  author: string;
  book_count: number;
  total_reads: number;
  finished_count: number;
  avg_rating: number | null;
  age_groups: string[];
}

export interface AgeGroupStat {
  age_group: string;
  member_count: number;
  books_finished: number;
  books_reading: number;
  books_want_to_read: number;
  pages_read: number;
}

export async function fetchOverviewStats(): Promise<OverviewStats | null> {
  try {
    const { data, error } = await supabase.rpc("admin_overview_stats");
    if (error) throw error;
    return data as OverviewStats;
  } catch (e) {
    console.error("admin_overview_stats:", e);
    return null;
  }
}

export async function fetchBooksReport(): Promise<BookStat[]> {
  try {
    const { data, error } = await supabase.rpc("admin_books_report");
    if (error) throw error;
    return (data as BookStat[]) ?? [];
  } catch (e) {
    console.error("admin_books_report:", e);
    return [];
  }
}

export async function fetchTopAuthors(): Promise<AuthorStat[]> {
  try {
    const { data, error } = await supabase.rpc("admin_top_authors");
    if (error) throw error;
    return (data as AuthorStat[]) ?? [];
  } catch (e) {
    console.error("admin_top_authors:", e);
    return [];
  }
}

export interface FamilyStat {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
  child_count: number;
  book_count: number;
  books_finished: number;
  pages_read: number;
  avg_rating: number | null;
}

export async function fetchFamiliesReport(): Promise<FamilyStat[]> {
  try {
    const { data, error } = await supabase.rpc("admin_families_report");
    if (error) throw error;
    return (data as FamilyStat[]) ?? [];
  } catch (e) {
    console.error("admin_families_report:", e);
    return [];
  }
}

export async function fetchAgeBreakdown(): Promise<AgeGroupStat[]> {
  try {
    const { data, error } = await supabase.rpc("admin_age_breakdown");
    if (error) throw error;
    return (data as AgeGroupStat[]) ?? [];
  } catch (e) {
    console.error("admin_age_breakdown:", e);
    return [];
  }
}
