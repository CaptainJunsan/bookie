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

export async function fetchBookByIsbn(isbn: string) {
  const cleaned = isbn.replace(/[^0-9X]/gi, "");

  // ── 1. Open Library Books API ───────────────────────────────────────────
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${cleaned}&format=json&jscmd=data`
    );
    const data = await res.json();
    const book = data[`ISBN:${cleaned}`];
    if (book?.title) {
      // Open Library cover API is more reliable than the cover field in the Books response
      const olCover = `https://covers.openlibrary.org/b/isbn/${cleaned}-L.jpg`;
      const cover = book.cover?.large || book.cover?.medium || book.cover?.small || olCover;
      return {
        title: book.title as string,
        author: (book.authors?.[0]?.name as string) ?? undefined,
        cover_url: cover,
        page_count: (book.number_of_pages as number) ?? undefined,
      };
    }
  } catch { /* fall through */ }

  // ── 2. Google Books API fallback ────────────────────────────────────────
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}&maxResults=1`
    );
    const data = await res.json();
    const info = data.items?.[0]?.volumeInfo;
    if (info?.title) {
      const thumb = info.imageLinks?.extraLarge ||
        info.imageLinks?.large ||
        info.imageLinks?.thumbnail ||
        info.imageLinks?.smallThumbnail;
      // Google returns http:// urls — upgrade to https and request larger size
      const cover = thumb
        ? thumb.replace("http://", "https://").replace("&zoom=1", "&zoom=0")
        : null;
      return {
        title: info.title as string,
        author: (info.authors?.[0] as string) ?? undefined,
        cover_url: cover,
        page_count: (info.pageCount as number) ?? undefined,
      };
    }
  } catch { /* fall through */ }

  return null;
}

/** @deprecated use fetchBookByIsbn */
export const fetchOpenLibraryBook = fetchBookByIsbn;
