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

  let title: string | undefined;
  let author: string | undefined;
  let pageCount: number | undefined;
  let coverUrl: string | null = null;

  // ── 1. Open Library Books API ───────────────────────────────────────────
  // Use ID-based cover URLs only — the ISBN-direct URL (covers.openlibrary.org/b/isbn/…-L.jpg)
  // returns a 1×1 transparent placeholder for missing covers, which looks blank in the UI.
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${cleaned}&format=json&jscmd=data`
    );
    const data = await res.json();
    const book = data[`ISBN:${cleaned}`];
    if (book?.title) {
      title = book.title as string;
      author = (book.authors?.[0]?.name as string) ?? undefined;
      pageCount = (book.number_of_pages as number) ?? undefined;
      // ID-based URLs are reliable; don't fall back to the ISBN direct URL
      const olCover = book.cover?.large || book.cover?.medium || book.cover?.small;
      if (olCover) coverUrl = olCover as string;
    }
  } catch { /* fall through */ }

  // ── 2. Google Books API ─────────────────────────────────────────────────
  // Used as cover fallback when OL has no cover, and as full fallback when OL doesn't know the ISBN.
  if (!title || !coverUrl) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}&maxResults=1`
      );
      const data = await res.json();
      const info = data.items?.[0]?.volumeInfo;
      if (info?.title) {
        if (!title) {
          title = info.title as string;
          author = (info.authors?.[0] as string) ?? undefined;
          pageCount = (info.pageCount as number) ?? undefined;
        }
        if (!coverUrl) {
          const thumb =
            info.imageLinks?.extraLarge ||
            info.imageLinks?.large ||
            info.imageLinks?.thumbnail ||
            info.imageLinks?.smallThumbnail;
          // Upgrade to https — don't modify zoom as zoom=0 isn't universally available
          if (thumb) coverUrl = (thumb as string).replace("http://", "https://");
        }
      }
    } catch { /* fall through */ }
  }

  if (!title) return null;
  return { title, author, cover_url: coverUrl, page_count: pageCount };
}

/** @deprecated use fetchBookByIsbn */
export const fetchOpenLibraryBook = fetchBookByIsbn;
