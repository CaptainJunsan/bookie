import { useState, useRef } from "react";
import { Search, Loader2, BookOpen, Plus, Heart, Check, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  first_publish_year?: number;
}

type AddStatus = "idle" | "adding" | "library" | "want";

interface SearchResult extends OLDoc {
  status: AddStatus;
}

export default function SearchPage() {
  const { family, member } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setResults([]);
    try {
      const isIsbn = /^[0-9]{9,13}[0-9X]?$/.test(q.replace(/[-\s]/g, ""));
      const params = new URLSearchParams({
        limit: "20",
        fields: "key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year",
      });
      if (isIsbn) {
        params.set("isbn", q.replace(/[-\s]/g, ""));
      } else {
        params.set("q", q);
      }
      const res = await fetch(`https://openlibrary.org/search.json?${params}`);
      const data = await res.json();
      const docs: OLDoc[] = (data.docs ?? []).filter((d: OLDoc) => d.title);
      setResults(docs.map((d) => ({ ...d, status: "idle" })));
    } catch {
      toast.error("Search failed — check your connection");
    } finally {
      setSearching(false);
      setHasSearched(true);
    }
  }

  function setResultStatus(key: string, status: AddStatus) {
    setResults((prev) => prev.map((r) => r.key === key ? { ...r, status } : r));
  }

  async function addBook(result: SearchResult, wantToRead: boolean) {
    if (!family || !member) return;
    setResultStatus(result.key, "adding");
    try {
      const coverUrl = result.cover_i
        ? `https://covers.openlibrary.org/b/id/${result.cover_i}-L.jpg`
        : null;
      const isbn = result.isbn?.find((i) => i.length === 13) ?? result.isbn?.[0] ?? null;

      const { data: book, error } = await supabase
        .from("books")
        .insert({
          family_id: family.id,
          title: result.title,
          author: result.author_name?.[0] ?? null,
          isbn,
          cover_url: coverUrl,
          page_count: result.number_of_pages_median ?? null,
          added_by: member.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (wantToRead && book) {
        await supabase.from("reading_progress").insert({
          book_id: book.id,
          member_id: member.id,
          status: "want_to_read",
          current_page: 0,
        });
      }

      setResultStatus(result.key, wantToRead ? "want" : "library");
      toast.success(wantToRead ? "Added to your reading list!" : "Added to library!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add book");
      setResultStatus(result.key, "idle");
    }
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <h1 className="font-display text-2xl font-bold mb-5">Search Books</h1>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Title, author, or ISBN…"
            className="w-full pl-4 pr-10 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
            autoFocus
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          onClick={doSearch}
          disabled={searching || !query.trim()}
          className="px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          {searching
            ? <Loader2 size={16} className="animate-spin" />
            : <Search size={16} />
          }
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>

      {/* Searching spinner */}
      {searching && (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="text-sm font-medium">Searching Open Library…</p>
        </div>
      )}

      {/* Empty state (before search) */}
      {!searching && !hasSearched && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📖</div>
          <p className="font-display font-bold text-xl mb-1">Find your next adventure</p>
          <p className="text-sm text-muted-foreground">Search by title, author name, or ISBN barcode</p>
        </div>
      )}

      {/* No results */}
      {!searching && hasSearched && results.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <p className="font-display font-bold text-xl mb-1">No books found</p>
          <p className="text-sm text-muted-foreground">Try a different title, author, or ISBN</p>
        </div>
      )}

      {/* Results */}
      {!searching && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium px-1">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          {results.map((result) => {
            const coverUrl = result.cover_i
              ? `https://covers.openlibrary.org/b/id/${result.cover_i}-M.jpg`
              : null;
            const isAdded = result.status === "library" || result.status === "want";
            const isAdding = result.status === "adding";

            return (
              <div key={result.key} className="bg-card border border-border rounded-2xl p-4 flex gap-4">
                {/* Cover thumbnail */}
                <div className="w-14 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-secondary flex items-center justify-center">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={result.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <BookOpen size={18} className="text-muted-foreground" />
                  )}
                </div>

                {/* Metadata + actions */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight line-clamp-2 mb-0.5">
                    {result.title}
                  </p>
                  {result.author_name?.[0] && (
                    <p className="text-xs text-muted-foreground truncate">
                      {result.author_name[0]}
                      {result.first_publish_year ? ` · ${result.first_publish_year}` : ""}
                    </p>
                  )}
                  {result.number_of_pages_median && (
                    <p className="text-xs text-muted-foreground">
                      {result.number_of_pages_median} pages
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-2.5 flex-wrap">
                    {isAdded ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <Check size={13} />
                        {result.status === "want" ? "On reading list" : "Added to library"}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => addBook(result, false)}
                          disabled={isAdding}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-60 hover:opacity-90 transition-opacity"
                        >
                          {isAdding
                            ? <Loader2 size={11} className="animate-spin" />
                            : <Plus size={11} />
                          }
                          Add to library
                        </button>
                        <button
                          onClick={() => addBook(result, true)}
                          disabled={isAdding}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold disabled:opacity-60 hover:bg-muted transition-colors"
                        >
                          <Heart size={11} />
                          Want to read
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
