import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, PlusCircle, TrendingUp, Search, Users, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import ReaderProfileSheet from "../components/ReaderProfileSheet";
import MilestoneModal from "../components/MilestoneModal";
import {
  computeMemberStats,
  computePendingMilestones,
  fetchCelebratedMilestones,
  markMilestoneCelebrated,
  getLocalCelebrated,
  markLocalCelebrated,
  milestoneKey,
  type PendingMilestone,
} from "../lib/milestones";
import { AGE_TIER_NAMES } from "../lib/types";
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
  bestReaders: FamilyMember[];
  bestReaderCount: number;
  latestBook: Book | null;
  finishedCountByMember: Record<string, number>;
  myBookwormScore: number;
}

// ── Bookworm score + levels — mirrors ReaderProfileSheet's canonical formula ──
interface BookwormInput {
  booksFinished: number;
  totalPagesRead: number;
  reviewsWritten: number;
  booksReading: number;
  booksWantToRead: number;
}

function bookwormScore(input: BookwormInput): number {
  return (
    input.booksFinished * 10 +
    Math.floor(input.totalPagesRead / 100) +
    input.reviewsWritten * 5 +
    input.booksReading * 3 +
    input.booksWantToRead
  );
}

const LEVELS = [
  { min: 0, title: "Bookworm Jr.", emoji: "🌱" },
  { min: 10, title: "Page Turner", emoji: "📖" },
  { min: 30, title: "Bookworm", emoji: "📚" },
  { min: 60, title: "Reading Champion", emoji: "🏆" },
  { min: 100, title: "Legendary Reader", emoji: "🌟" },
  { min: 200, title: "Reading Legend", emoji: "⚡" },
] as const;

function getLevel(score: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (score >= LEVELS[i].min) idx = i;
  }
  return LEVELS[idx];
}

// ── Age-adaptive greeting — gentle mode by default (PRD §5.9, §6.3) ──────────
function getGreeting(nickname: string, ageGroup: string | null): { line1: string; line2: string } {
  const h = new Date().getHours();
  const time = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const tier = ageGroup ? AGE_TIER_NAMES[ageGroup] : null;

  if (tier === "Explorers" || tier === "Adventurers" || tier === "Navigators") {
    const adventures = [
      "Ready for your next adventure?",
      "Every page is a new world 🌍",
      "What will you discover today?",
      "Books are waiting for you!",
    ];
    return {
      line1: `${time}, ${nickname}! 👋`,
      line2: adventures[new Date().getDay() % adventures.length],
    };
  }
  if (tier === "Travellers") {
    return { line1: `${time}, ${nickname}.`, line2: "Keep the story going." };
  }
  return { line1: `${time},`, line2: nickname };
}

// Legacy '10-15' is included so existing child profiles awaiting an age-band
// update (PRD §2.2) still get the gentler experience, not the adult default.
function isChildTier(ageGroup: string | null): boolean {
  return ["3-5", "6-9", "10-12", "10-15"].includes(ageGroup ?? "");
}

export default function DashboardPage() {
  const { family, member, allMembers } = useAuth();
  const navigate = useNavigate();
  const [recentBooks, setRecentBooks] = useState<BookWithData[]>([]);
  const [currentlyReading, setCurrentlyReading] = useState<BookWithData[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalBooks: 0, booksFinished: 0, totalPages: 0,
    bestReaders: [], bestReaderCount: 0, latestBook: null, finishedCountByMember: {},
    myBookwormScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedReader, setSelectedReader] = useState<FamilyMember | null>(null);
  const [milestoneQueue, setMilestoneQueue] = useState<PendingMilestone[]>([]);
  const milestoneCheckedRef = useRef(false);

  useEffect(() => {
    if (!family) return;
    milestoneCheckedRef.current = false;
    loadData();
  }, [family?.id]);

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

    const topCount = finishedByMember[0]?.count ?? 0;
    const bestReaders = topCount > 0
      ? finishedByMember.filter((x) => x.count === topCount).map((x) => x.member)
      : [];
    const totalPages = progress.reduce((acc, p) => acc + p.current_page, 0);
    const finishedCountByMember: Record<string, number> = {};
    finishedByMember.forEach(({ member: m, count }) => { finishedCountByMember[m.id] = count; });

    // My own Bookworm score, same inputs/formula as ReaderProfileSheet.
    const myProgress = progress.filter((p) => p.member_id === member?.id);
    const myBookwormScore = bookwormScore({
      booksFinished: myProgress.filter((p) => p.status === "finished").length,
      totalPagesRead: myProgress.reduce((acc, p) => acc + p.current_page, 0),
      reviewsWritten: ratings.filter((r) => r.member_id === member?.id && r.review).length,
      booksReading: myProgress.filter((p) => p.status === "reading").length,
      booksWantToRead: myProgress.filter((p) => p.status === "want_to_read").length,
    });

    setStats({
      totalBooks: books.length,
      booksFinished: finishedProgress.length,
      totalPages,
      bestReaders,
      bestReaderCount: topCount,
      latestBook: books[0] ?? null,
      finishedCountByMember,
      myBookwormScore,
    });
    setRecentBooks(recent);
    setCurrentlyReading(reading);
    setLoading(false);

    // Milestone check — only once per session load
    if (!milestoneCheckedRef.current) {
      milestoneCheckedRef.current = true;
      checkMilestones(books, progress);
    }
  }

  async function checkMilestones(books: Book[], progress: ReadingProgress[]) {
    if (!family) return;
    const memberIds = allMembers.map((m) => m.id);

    // 1. DB is the source of truth across devices. If we can't read it,
    //    bail out this session instead of risking a false re-celebration.
    const celebratedMap = await fetchCelebratedMilestones(memberIds);
    if (celebratedMap === null) {
      console.warn("Skipping milestone check — could not verify celebration history.");
      return;
    }

    // 2. localStorage now only guards against double-queueing within this
    //    browser session — it is never treated as authoritative.
    const localCelebrated = getLocalCelebrated(family.id);

    const statsMap: Record<string, ReturnType<typeof computeMemberStats>> = {};
    for (const m of allMembers) {
      statsMap[m.id] = computeMemberStats(m.id, progress, books);
    }

    const allPending = computePendingMilestones(allMembers as FamilyMember[], statsMap, celebratedMap);

    const pending = allPending.filter(
      (p) => !localCelebrated.has(milestoneKey(p.memberId, p.type, p.value))
    );
    if (pending.length === 0) return;

    // 3. Write first, show only what's confirmed written. A failed write means
    //    we'll safely re-offer that milestone next session instead of it
    //    silently vanishing — but we won't celebrate it now unconfirmed.
    const results = await Promise.all(
      pending.map(async (p) => ({
        milestone: p,
        saved: await markMilestoneCelebrated(p.memberId, p.type, p.value),
      }))
    );

    const confirmed = results.filter((r) => r.saved).map((r) => r.milestone);
    const failed = results.filter((r) => !r.saved).map((r) => r.milestone);
    if (failed.length > 0) {
      console.error(`Failed to persist ${failed.length} milestone(s) — will retry next session.`, failed);
    }

    for (const p of confirmed) {
      markLocalCelebrated(family.id, milestoneKey(p.memberId, p.type, p.value));
    }
    if (confirmed.length > 0) setMilestoneQueue(confirmed);
  }

  function dismissCurrentMilestone() {
    // Already persisted in checkMilestones — just advance the display queue.
    setMilestoneQueue((q) => q.slice(1));
  }

  const greeting = getGreeting(member?.nickname ?? "", member?.age_group ?? null);
  const isChild = isChildTier(member?.age_group ?? null);
  const myLevel = getLevel(stats.myBookwormScore);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-4xl animate-bounce">📚</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl lg:max-w-none mx-auto lg:mx-0 px-4 lg:px-10 py-6 pb-24 lg:pb-10">
      <div className="lg:grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] lg:gap-8 lg:items-start space-y-8 lg:space-y-0">
      {/* ── Left / main column ── */}
      <div className="space-y-8">

      {/* Welcome + level badge */}
      <div className="flex items-start justify-between gap-4">
        <button
          onClick={() => member && setSelectedReader(member as FamilyMember)}
          className="group text-left"
        >
          <p className="text-sm text-muted-foreground font-medium">{greeting.line1}</p>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
              {isChild ? greeting.line2 : member?.nickname}
            </h1>
            <span className="text-2xl">{member?.avatar_emoji}</span>
          </div>
          {!isChild && <p className="text-sm text-muted-foreground mt-0.5">{greeting.line2}</p>}
        </button>

        <button
          onClick={() => member && setSelectedReader(member as FamilyMember)}
          className="flex-shrink-0 flex flex-col items-center gap-1 bg-card border border-border rounded-2xl px-3.5 py-3 hover:border-primary/40 hover:shadow-sm active:scale-[0.97] transition-all"
        >
          <span className="text-2xl leading-none">{myLevel.emoji}</span>
          <span className="text-[9px] font-bold text-primary leading-tight text-center max-w-[64px]">{myLevel.title}</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: isChild ? "Books read 🎉" : "Books", value: stats.totalBooks, emoji: "📚" },
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

      {/* Star Reader(s) — tappable */}
      {stats.bestReaders.length === 1 && (
        <button
          onClick={() => setSelectedReader(stats.bestReaders[0])}
          className="w-full text-left bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground flex items-center gap-4 hover:opacity-95 active:scale-[0.99] transition-all"
        >
          <span className="text-4xl">{stats.bestReaders[0].avatar_emoji}</span>
          <div className="flex-1">
            <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
              <TrendingUp size={12} /> {isChild ? "Top Reader in the Family" : "Star Reader"}
            </p>
            <p className="font-display text-xl font-bold">{stats.bestReaders[0].nickname}</p>
            <p className="text-primary-foreground/80 text-sm">
              {stats.bestReaderCount} book{stats.bestReaderCount !== 1 ? "s" : ""} finished
              {!isChild && " · tap to view profile"}
            </p>
          </div>
          <span className="text-3xl">🏆</span>
        </button>
      )}
      {stats.bestReaders.length > 1 && (
        <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground">
          <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-wide flex items-center gap-1 mb-3">
            <TrendingUp size={12} /> {isChild ? "Top Readers" : "Star Readers"} — {stats.bestReaderCount} book{stats.bestReaderCount !== 1 ? "s" : ""} each
          </p>
          <div className="flex gap-3 flex-wrap">
            {stats.bestReaders.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReader(r)}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 active:scale-[0.97] transition-all rounded-xl px-3 py-2"
              >
                <span className="text-2xl">{r.avatar_emoji}</span>
                <span className="font-display font-bold text-sm">{r.nickname}</span>
                <span className="text-base">🏆</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Currently reading */}
      {currentlyReading.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <BookOpen size={18} className="text-primary" /> {isChild ? "Keep reading 📖" : "Currently reading"}
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

      {/* Family readers — mobile only (also in desktop right panel) */}
      <section className="lg:hidden">
        <h2 className="font-display font-bold text-lg mb-3">{isChild ? "My family reads" : "Your readers"}</h2>
        <div className="flex gap-3 flex-wrap">
          {allMembers.map((m) => {
            const booksRead = stats.finishedCountByMember[m.id] ?? 0;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedReader(m as FamilyMember)}
                className="flex flex-col items-center gap-1 bg-card border border-border rounded-2xl p-3 min-w-[72px] hover:border-primary/40 hover:shadow-sm active:scale-[0.97] transition-all"
              >
                <span className="text-3xl">{m.avatar_emoji}</span>
                <span className="text-xs font-bold text-center leading-tight">{m.nickname}</span>
                <span className="text-[10px] text-muted-foreground">
                  {booksRead} book{booksRead !== 1 ? "s" : ""} read
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent books */}
      {recentBooks.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg">{isChild ? "Books we've read 📚" : "Recent books"}</h2>
            <button onClick={() => navigate("/books")} className="text-sm text-primary font-semibold hover:underline">See all</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {recentBooks.slice(0, 6).map(({ book, rating }) => (
              <button
                key={book.id}
                onClick={() => navigate(`/books/${book.id}`)}
                className="text-left bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]"
              >
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} className="w-full h-36 object-cover bg-secondary" />
                ) : (
                  <div className="w-full h-36 bg-secondary flex items-center justify-center text-4xl">📘</div>
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
          <h3 className="font-display font-bold text-xl mb-2">{isChild ? "Time to start reading!" : "No books yet!"}</h3>
          <p className="text-muted-foreground text-sm mb-5">
            {isChild
              ? "Ask a grown-up to add your first book and let the adventure begin."
              : "Start your family library by adding your first book."}
          </p>
          {!isChild && (
            <button
              onClick={() => navigate("/books/add")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
            >
              <PlusCircle size={16} /> Add your first book
            </button>
          )}
        </div>
      )}
      </div>{/* end left column */}

      {/* ── Right panel — desktop only ── */}
      <aside className="hidden lg:block space-y-6 lg:sticky lg:top-6">
        {/* Readers */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h2 className="font-display font-bold text-base mb-3">{isChild ? "My family" : "Your readers"}</h2>
          <div className="space-y-2">
            {allMembers.map((m) => {
              const booksRead = stats.finishedCountByMember[m.id] ?? 0;
              const pct = stats.totalBooks > 0 ? Math.round((booksRead / stats.totalBooks) * 100) : 0;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedReader(m as FamilyMember)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors text-left"
                >
                  <span className="text-2xl shrink-0">{m.avatar_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{m.nickname}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{booksRead} read</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Star reader callout */}
        {stats.bestReaders.length > 0 && stats.bestReaderCount > 0 && (
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-4 text-primary-foreground">
            <p className="text-xs font-semibold text-primary-foreground/70 uppercase tracking-wide mb-2 flex items-center gap-1">
              <TrendingUp size={11} /> {isChild ? "Top reader" : "Star reader"}{stats.bestReaders.length > 1 ? "s" : ""}
            </p>
            <div className="space-y-1.5">
              {stats.bestReaders.map((r) => (
                <button key={r.id} onClick={() => setSelectedReader(r as FamilyMember)}
                  className="w-full flex items-center gap-2 hover:opacity-80 transition-opacity text-left">
                  <span className="text-2xl">{r.avatar_emoji}</span>
                  <div>
                    <p className="font-display font-bold text-sm">{r.nickname}</p>
                    <p className="text-xs text-primary-foreground/70">{stats.bestReaderCount} book{stats.bestReaderCount !== 1 ? "s" : ""} finished 🏆</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quick links</p>
          {!isChild && (
            <button onClick={() => navigate("/books/add")}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-left">
              <PlusCircle size={16} className="text-primary shrink-0" /> Add a book
            </button>
          )}
          <button onClick={() => navigate("/search")}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-left">
            <Search size={16} className="text-primary shrink-0" /> Find a book
          </button>
          <button onClick={() => navigate("/clubs")}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-left">
            <Users size={16} className="text-primary shrink-0" /> Reading clubs
          </button>
          <button onClick={() => navigate("/explore")}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-left">
            <Sparkles size={16} className="text-primary shrink-0" /> Explore
          </button>
        </div>
      </aside>

      </div>{/* end grid */}

      {/* Reader profile sheet */}
      <ReaderProfileSheet
        member={selectedReader}
        isBestReader={stats.bestReaders.some((r) => r.id === selectedReader?.id)}
        onClose={() => setSelectedReader(null)}
      />

      {/* Milestone celebration modal — shows queued milestones one at a time */}
      <MilestoneModal
        milestone={milestoneQueue[0] ?? null}
        viewerMember={member as FamilyMember | undefined}
        onDismiss={dismissCurrentMilestone}
      />
    </div>
  );
}
