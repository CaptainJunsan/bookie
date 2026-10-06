import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, PlusCircle, Search, Users, Sparkles, LayoutDashboard } from "lucide-react";
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

export default function HomePage() {
  const { family, member, allMembers } = useAuth();
  const navigate = useNavigate();
  const [recentBooks, setRecentBooks] = useState<BookWithData[]>([]);
  const [currentlyReading, setCurrentlyReading] = useState<BookWithData[]>([]);
  const [hasAnyBooks, setHasAnyBooks] = useState(true);
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

    setHasAnyBooks(books.length > 0);
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

      {/* Welcome + Dashboard pill */}
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
          onClick={() => navigate("/dashboard")}
          className="flex-shrink-0 flex items-center gap-1.5 bg-card border border-border rounded-full px-3.5 py-2 hover:border-primary/40 hover:shadow-sm active:scale-[0.97] transition-all"
        >
          <LayoutDashboard size={15} className="text-primary" />
          <span className="text-xs font-bold text-primary">Dashboard</span>
        </button>
      </div>

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

      {/* Recent books */}
      {hasAnyBooks ? (
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
          <button onClick={() => navigate("/dashboard")}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-sm font-semibold text-left">
            <LayoutDashboard size={16} className="text-primary shrink-0" /> Dashboard
          </button>
        </div>
      </aside>

      </div>{/* end grid */}

      {/* Reader profile sheet */}
      <ReaderProfileSheet
        member={selectedReader}
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
