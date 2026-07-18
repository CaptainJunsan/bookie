import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

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

function toHttps(url: string): string {
  return url.replace(/^http:\/\//, "https://");
}

export async function fetchBookByIsbn(isbn: string) {
  const cleaned = isbn.replace(/[^0-9X]/gi, "");

  // ── 1. Open Library Search API ─────────────────────────────────────────────
  // Faster and more reliable than the Books API for cover lookup.
  // cover_i gives a stable numeric ID → HTTPS CDN URL with no mixed-content issues.
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?isbn=${cleaned}&limit=1&fields=title,author_name,cover_i,number_of_pages_median`
    );
    const data = await res.json();
    const doc = data.docs?.[0];
    if (doc?.title) {
      return {
        title: doc.title as string,
        author: (doc.author_name?.[0] as string) ?? undefined,
        cover_url: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
          : null,
        page_count: (doc.number_of_pages_median as number) ?? undefined,
      };
    }
  } catch { /* fall through */ }

  // ── 2. Google Books API (fallback) ──────────────────────────────────────────
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}&maxResults=1`
    );
    const data = await res.json();
    const info = data.items?.[0]?.volumeInfo;
    if (info?.title) {
      const thumb =
        info.imageLinks?.extraLarge ||
        info.imageLinks?.large ||
        info.imageLinks?.thumbnail ||
        info.imageLinks?.smallThumbnail;
      return {
        title: info.title as string,
        author: (info.authors?.[0] as string) ?? undefined,
        cover_url: thumb ? toHttps(thumb as string) : null,
        page_count: (info.pageCount as number) ?? undefined,
      };
    }
  } catch { /* fall through */ }

  return null;
}

/** @deprecated use fetchBookByIsbn */
export const fetchOpenLibraryBook = fetchBookByIsbn;
