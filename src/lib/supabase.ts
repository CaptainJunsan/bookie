import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Safe client — only created when env vars are present
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

export function getPublicUrl(path: string): string {
  if (!isSupabaseConfigured) return "";
  const { data } = supabase.storage.from("book-covers").getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchOpenLibraryBook(isbn: string) {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const data = await res.json();
    const book = data[`ISBN:${isbn}`];
    if (!book) return null;
    return {
      title: book.title as string,
      author: book.authors?.[0]?.name as string | undefined,
      cover_url: book.cover?.large || book.cover?.medium || book.cover?.small || null,
      page_count: book.number_of_pages as number | undefined,
    };
  } catch {
    return null;
  }
}
