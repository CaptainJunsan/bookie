import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { PlusCircle, Search } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import BookCard from "../components/BookCard";
import type { Book, ReadingProgress, Rating } from "../lib/types";

type FilterStatus = "all" | "want_to_read" | "reading" | "finished";

interface BookWithData {
  book: Book;
  progress: ReadingProgress[];
  rating: Rating | null;
}

export default function BooksPage() {
  const { family, member, allMembers } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get("view") as FilterStatus) || "all";

  const [books, setBooks] = useState<BookWithData[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>(initialFilter);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!family) return;
    loadBooks();
  }, [family]);

  async function loadBooks() {
    setLoading(true);
    const [booksRes, progressRes, ratingsRes] = await Promise.all([
      supabase.from("books").select("*").eq("family_id", family!.id).order("created_at", { ascending: false }),
      supabase.from("reading_progress").select("*").in("member_id", allMembers.map((m) => m.id)),
      supabase.from("ratings").select("*").in("member_id", allMembers.map((m) => m.id)),
    ]);
    const rawBooks = (booksRes.data as Book[]) || [];
    const progress = (progressRes.data as ReadingProgress[]) || [];
    const ratings = (ratingsRes.data as Rating[]) || [];
    const combined = rawBooks.map((book) => ({
      book,
      progress: progress.filter((p) => p.book_id === book.id),
      rating: ratings.find((r) => r.book_id === book.id && r.member_id === member?.id) ?? null,
    }));
    setBooks(combined);
    setLoading(false);
  }

  const filtered = books.filter(({ book, progress }) => {
    const matchesSearch = !search || book.title.toLowerCase().includes(search.toLowerCase()) || book.author?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "all") return true;
    return progress.some((p) => p.member_id === member?.id && p.status === filter);
  });

  const filterLabels: { key: FilterStatus; label: string; emoji: string }[] = [
    { key: "all", label: "All", emoji: "📚" },
    { key: "want_to_read", label: "Want to read", emoji: "🔖" },
    { key: "reading", label: "Reading", emoji: "📖" },
    { key: "finished", label: "Finished", emoji: "✅" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold">Our Library</h1>
        <button
          onClick={() => navigate("/books/add")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <PlusCircle size={15} /> Add book
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or author..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
        {filterLabels.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
              filter === key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{emoji}</span> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="text-4xl animate-bounce">📚</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(({ book, progress, rating }) => (
            <BookCard
              key={book.id}
              book={book}
              progress={progress}
              rating={rating}
              members={allMembers}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <span className="text-5xl block mb-4">{search ? "🔍" : "📚"}</span>
          <h3 className="font-display font-bold text-xl mb-2">
            {search ? "No books found" : filter !== "all" ? `No ${filter.replace(/_/g, " ")} books` : "Your library is empty"}
          </h3>
          <p className="text-muted-foreground text-sm mb-5">
            {search ? "Try a different search term." : "Add your first book to start the adventure!"}
          </p>
          {!search && (
            <button
              onClick={() => navigate("/books/add")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90"
            >
              <PlusCircle size={16} /> Add a book
            </button>
          )}
        </div>
      )}
    </div>
  );
}
