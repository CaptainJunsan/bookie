import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, PlusCircle, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import ReaderProfileSheet from "../components/ReaderProfileSheet";
import type { Book, ReadingProgress, Rating, FamilyMember } from "../lib/types";

interface BookWithData {
  book: Book;
  progress: ReadingProgress[];
  rating: Rating | null;
}

interface Stats {
  totalBooks: number;
  booksFinished: number;
  totalPages: number;
  bestReader: FamilyMember | null;
  bestReaderCount: number;
  latestBook: Book | null;
}

export default function DashboardPage() {
  const { family, member, allMembers } = useAuth();
  const navigate = useNavigate();
  const [recentBooks, setRecentBooks] = useState<BookWithData[]>([]);
  const [currentlyReading, setCurrentlyReading] = useState<BookWithData[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalBooks: 0, booksFinished: 0, totalPages: 0,
    bestReader: null, bestReaderCount: 0, latestBook: null,
  });
  const [loading, setLoading] = useState(true);
  const [selectedReader, setSelectedReader] = useState<FamilyMember | null>(null);

  useEffect(() => {
    if (!family) return;
    loadData();
  }, [family]);

  async function loadData() {
    setLoading(true);
    const [booksRes, progressRes, ratingsRes] = await Promise.all([
      supabase.from("books").select("*").eq("family_id", family!.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("reading_progress").select("*").in("member_id", allMembers.map((m) => m.id)),
      supabase.from("ratings").select("*").in("member_id", allMembers.map((m) => m.id)),
    ]);

    const books = (booksRes.data as Book[]) || [];
    const progress = (progressRes.data as ReadingProgress[]) || [];
    const ratings = (ratingsRes.data as Rating[]) || [];

    const readingBookIds = new Set(progress.filter((p) => p.status === "reading").map((p) => p.book_id));
    const recent = books.slice(0, 6).map((book) => ({
      book,
      progress: progress.filter((p) => p.book_id === book.id),
      rating: ratings.find((r) => r.book_id === book.id) ?? null,
    }));
    const reading = books
      .filter((b) => readingBookIds.has(b.id))
      .slice(0, 5)
      .map((book) => ({
        book,
        progress: progress.filter((p) => p.book_id === book.id),
        rating: ratings.find((r) => r.book_id === book.id) ?? null,
      }));

    const finishedProgress = progress.filter((p) => p.status === "finished");
    const finishedByMember = allMembers
      .map((m) => ({ member: m, count: finishedProgress.filter((p) => p.member_id === m.id).length }))
      .sort((a, b) => b.count - a.count);

    const bestReader = finishedByMember[0]?.count > 0 ? finishedByMember[0].member : null;
    const totalPages = progress.reduce((acc, p) => acc + p.current_page, 0);

    setStats({
      totalBooks: books.length,
      booksFinished: finishedProgress.length,
      totalPages,
      bestReader,
      bestReaderCount: finishedByMember[0]?.count ?? 0,
      latestBook: books[0] ?? null,
    });
    setRecentBooks(recent);
    setCurrentlyReading(reading);
    setLoading(false);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-4xl animate-bounce">📚</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-8">
      {/* Welcome */}
      <div>
        <p className="text-sm text-muted-foreground font-medium">{greeting()},</p>
        <button
          onClick={() => member && setSelectedReader(member as FamilyMember)}
          className="group flex items-center gap-2"
        >
          <h1 className="font-display text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
            {member?.nickname}
          </h1>
          <span className="text-2xl">{member?.avatar_emoji}</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Books", value: stats.totalBooks, emoji: "📚" },
          { label: "Finished", value: stats.booksFinished, emoji: "✅" },
          { label: "Pages read", value: stats.totalPages.toLocaleString(), emoji: "📄" },
        ].map(({ label, value, emoji }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-3 text-center">
            <span className="text-2xl block mb-1">{emoji}</span>
            <p className="font-display text-2xl font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Star Reader — tappable */}
      {stats.bestReader && (
        <button
          onClick={() => setSelectedReader(stats.bestReader)}
          className="w-full text-left bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground flex items-center gap-4 hover:opacity-95 active:scale-[0.99] transition-all"
        >
          <span className="text-4xl">{stats.bestReader.avatar_emoji}</span>
          <div className="flex-1">
            <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
              <TrendingUp size={12} /> Star Reader
            </p>
            <p className="font-display text-xl font-bold">{stats.bestReader.nickname}</p>
            <p className="text-primary-foreground/80 text-sm">
              {stats.bestReaderCount} book{stats.bestReaderCount !== 1 ? "s" : ""} finished · tap to view profile
            </p>
          </div>
          <span className="text-3xl">🏆</span>
        </button>
      )}

      {/* Currently reading */}
      {currentlyReading.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <BookOpen size={18} className="text-primary" /> Currently reading
            </h2>
          </div>
          <div className="space-y-3">
            {currentlyReading.map(({ book, progress }) => {
              const readingEntries = progress.filter((p) => p.status === "reading");
              return (
                <button
                  key={book.id}
                  onClick={() => navigate(`/books/${book.id}`)}
                  className="w-full text-left bg-card border border-border rounded-2xl p-3 flex gap-3 hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.99]"
                >
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} className="w-14 h-20 object-cover rounded-xl flex-shrink-0 bg-secondary" />
                  ) : (
                    <div className="w-14 h-20 rounded-xl bg-secondary flex items-center justify-center text-2xl flex-shrink-0">📘</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-sm leading-snug line-clamp-2">{book.title}</h3>
                    {book.author && <p className="text-xs text-muted-foreground mt-0.5">{book.author}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {readingEntries.map((p) => {
                        const m = allMembers.find((mb) => mb.id === p.member_id);
                        if (!m) return null;
                        return (
                          <div
                            key={p.member_id}
                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: m.color + "20", border: `1.5px solid ${m.color}`, color: m.color }}
                          >
                            <span>{m.avatar_emoji}</span>
                            <span className="font-semibold">
                              {book.page_count ? `p.${p.current_page}/${book.page_count}` : `p.${p.current_page}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {book.page_count && readingEntries.length > 0 && (
                      <div className="mt-2 flex gap-1.5">
                        {readingEntries.map((p) => {
                          const m = allMembers.find((mb) => mb.id === p.member_id);
                          const pct = Math.min(100, Math.round((p.current_page / book.page_count!) * 100));
                          return (
                            <div
                              key={p.member_id}
                              className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"
                              title={`${m?.nickname}: ${pct}%`}
                            >
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: m?.color }} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Family readers — each card tappable */}
      <section>
        <h2 className="font-display font-bold text-lg mb-3">Your readers</h2>
        <div className="flex gap-3 flex-wrap">
          {allMembers.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedReader(m as FamilyMember)}
              className="flex flex-col items-center gap-1 bg-card border border-border rounded-2xl p-3 min-w-[72px] hover:border-primary/40 hover:shadow-sm active:scale-[0.97] transition-all"
            >
              <span className="text-3xl">{m.avatar_emoji}</span>
              <span className="text-xs font-bold text-center leading-tight">{m.nickname}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{m.role}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Recent books */}
      {recentBooks.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg">Recent books</h2>
            <button onClick={() => navigate("/books")} className="text-sm text-primary font-semibold hover:underline">See all</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {recentBooks.slice(0, 4).map(({ book, rating }) => (
              <button
                key={book.id}
                onClick={() => navigate(`/books/${book.id}`)}
                className="text-left bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]"
              >
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} className="w-full h-32 object-cover bg-secondary" />
                ) : (
                  <div className="w-full h-32 bg-secondary flex items-center justify-center text-4xl">📘</div>
                )}
                <div className="p-2.5">
                  <p className="font-display font-bold text-xs leading-snug line-clamp-2">{book.title}</p>
                  {rating?.reader_rating && (
                    <p className="text-xs mt-0.5">{"⭐".repeat(rating.reader_rating)}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="text-center py-12 bg-card border border-border rounded-2xl">
          <span className="text-5xl block mb-4">📚</span>
          <h3 className="font-display font-bold text-xl mb-2">No books yet!</h3>
          <p className="text-muted-foreground text-sm mb-5">Start your family library by adding your first book.</p>
          <button
            onClick={() => navigate("/books/add")}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <PlusCircle size={16} /> Add your first book
          </button>
        </div>
      )}

      {/* Reader profile sheet */}
      <ReaderProfileSheet
        member={selectedReader}
        isBestReader={selectedReader?.id === stats.bestReader?.id && (stats.bestReaderCount > 0)}
        onClose={() => setSelectedReader(null)}
      />
    </div>
  );
}
