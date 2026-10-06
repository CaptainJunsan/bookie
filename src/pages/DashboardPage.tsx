import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import ReaderProfileSheet from "../components/ReaderProfileSheet";
import type { ReadingProgress, Rating, FamilyMember } from "../lib/types";

interface Stats {
  totalBooks: number;
  booksFinished: number;
  totalPages: number;
  bestReaders: FamilyMember[];
  bestReaderCount: number;
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

// Legacy '10-15' is included so existing child profiles awaiting an age-band
// update (PRD §2.2) still get the gentler experience, not the adult default.
function isChildTier(ageGroup: string | null): boolean {
  return ["3-5", "6-9", "10-12", "10-15"].includes(ageGroup ?? "");
}

export default function DashboardPage() {
  const { family, member, allMembers } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalBooks: 0, booksFinished: 0, totalPages: 0,
    bestReaders: [], bestReaderCount: 0, finishedCountByMember: {},
    myBookwormScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedReader, setSelectedReader] = useState<FamilyMember | null>(null);

  useEffect(() => {
    if (!family) return;
    loadData();
  }, [family?.id]);

  async function loadData() {
    setLoading(true);
    const memberIds = allMembers.map((m) => m.id);
    const [booksCountRes, progressRes, ratingsRes, sessionsRes] = await Promise.all([
      supabase.from("books").select("id", { count: "exact", head: true }).eq("family_id", family!.id),
      supabase.from("reading_progress").select("*").in("member_id", memberIds),
      supabase.from("ratings").select("*").in("member_id", memberIds),
      // Completion count per member, not distinct books — re-reads log another
      // row here (PRD §6.2), so this is the canonical "books finished" source.
      supabase.from("reading_sessions").select("member_id").in("member_id", memberIds).eq("is_completion", true),
    ]);

    const progress = (progressRes.data as ReadingProgress[]) || [];
    const ratings = (ratingsRes.data as Rating[]) || [];
    const completionsByMember: Record<string, number> = {};
    (sessionsRes.data ?? []).forEach((s: { member_id: string }) => {
      completionsByMember[s.member_id] = (completionsByMember[s.member_id] ?? 0) + 1;
    });

    const finishedProgress = progress.filter((p) => p.status === "finished");
    // Falls back to distinct-finished-books count per member if a session
    // fetch ever comes back empty — avoids ever showing 0 for someone whose
    // history predates reading_sessions (shouldn't happen post-backfill).
    const finishedByMember = allMembers
      .map((m) => ({
        member: m,
        count: completionsByMember[m.id] || finishedProgress.filter((p) => p.member_id === m.id).length,
      }))
      .sort((a, b) => b.count - a.count);

    const topCount = finishedByMember[0]?.count ?? 0;
    const bestReaders = topCount > 0
      ? finishedByMember.filter((x) => x.count === topCount).map((x) => x.member)
      : [];
    const totalPages = progress.reduce((acc, p) => acc + p.current_page, 0);
    const finishedCountByMember: Record<string, number> = {};
    finishedByMember.forEach(({ member: m, count }) => { finishedCountByMember[m.id] = count; });
    const familyFinishedTotal = finishedByMember.reduce((acc, x) => acc + x.count, 0);

    // My own Bookworm score, same inputs/formula as ReaderProfileSheet.
    const myProgress = progress.filter((p) => p.member_id === member?.id);
    const myBookwormScore = bookwormScore({
      booksFinished: finishedCountByMember[member?.id ?? ""] ?? 0,
      totalPagesRead: myProgress.reduce((acc, p) => acc + p.current_page, 0),
      reviewsWritten: ratings.filter((r) => r.member_id === member?.id && r.review).length,
      booksReading: myProgress.filter((p) => p.status === "reading").length,
      booksWantToRead: myProgress.filter((p) => p.status === "want_to_read").length,
    });

    setStats({
      totalBooks: booksCountRes.count ?? 0,
      booksFinished: familyFinishedTotal,
      totalPages,
      bestReaders,
      bestReaderCount: topCount,
      finishedCountByMember,
      myBookwormScore,
    });
    setLoading(false);
  }

  const isChild = isChildTier(member?.age_group ?? null);
  const myLevel = getLevel(stats.myBookwormScore);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-4xl animate-bounce">📊</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </button>
          <p className="font-display font-bold text-base">Dashboard</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 lg:pb-10 space-y-8">

        {/* My level */}
        <button
          onClick={() => member && setSelectedReader(member as FamilyMember)}
          className="w-full flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-sm active:scale-[0.99] transition-all text-left"
        >
          <span className="text-4xl">{myLevel.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg font-bold text-foreground">{myLevel.title}</p>
            <p className="text-xs text-muted-foreground">{stats.myBookwormScore} Bookworm points</p>
          </div>
        </button>

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

        {/* Family readers */}
        <section>
          <h2 className="font-display font-bold text-lg mb-3">{isChild ? "My family reads" : "Your readers"}</h2>
          <div className="space-y-2">
            {allMembers.map((m) => {
              const booksRead = stats.finishedCountByMember[m.id] ?? 0;
              const pct = stats.totalBooks > 0 ? Math.round((booksRead / stats.totalBooks) * 100) : 0;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedReader(m as FamilyMember)}
                  className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-2xl hover:border-primary/40 hover:shadow-sm active:scale-[0.99] transition-all text-left"
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
        </section>
      </div>

      {/* Reader profile sheet */}
      <ReaderProfileSheet
        member={selectedReader}
        isBestReader={stats.bestReaders.some((r) => r.id === selectedReader?.id)}
        onClose={() => setSelectedReader(null)}
      />
    </div>
  );
}
