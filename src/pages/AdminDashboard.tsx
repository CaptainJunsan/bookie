import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import BookCover from "../components/BookCover";
import {
  ArrowLeft, ArrowRight, RefreshCw, Search, ChevronDown,
  Printer, Star, Users, BookOpen, FileText, TrendingUp, Home,
  ShieldCheck, Plus, Trash2, X, Loader2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchOverviewStats, fetchBooksReport, fetchTopAuthors,
  fetchAgeBreakdown, fetchFamiliesReport,
  type OverviewStats, type BookStat, type AuthorStat,
  type AgeGroupStat, type FamilyStat,
} from "../lib/admin";
import { AGE_GROUP_COLORS, AGE_GROUP_LABELS } from "../lib/types";

type Tab = "overview" | "library" | "insights" | "moderation";
type DetailMetric =
  | "families" | "readers" | "books" | "pages" | "activity" | "age_groups" | "authors" | null;

const AGE_GROUP_ORDER = [
  "0-2", "3-5", "6-9", "10-15", "16-21", "22-35", "36-65", "66+",
  "prefer_not_to_say", "Unknown",
];

function sortAgeGroups(a: AgeGroupStat, b: AgeGroupStat) {
  return AGE_GROUP_ORDER.indexOf(a.age_group) - AGE_GROUP_ORDER.indexOf(b.age_group);
}

// ── Helpers ──────────────────────────────────────────────────

function StatChip({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-muted-foreground">
      {icon} {value} <span className="font-normal opacity-70">{label}</span>
    </span>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display font-bold text-lg">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab>("overview");
  const [detailMetric, setDetailMetric] = useState<DetailMetric>(null);

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [books, setBooks] = useState<BookStat[]>([]);
  const [authors, setAuthors] = useState<AuthorStat[]>([]);
  const [ageBreakdown, setAgeBreakdown] = useState<AgeGroupStat[]>([]);
  const [families, setFamilies] = useState<FamilyStat[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Library / Insights filters
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>("all");
  const [sortBooks, setSortBooks] = useState<"reads" | "rating" | "pages" | "alpha">("reads");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAdmin) { navigate("/dashboard"); return; }
    loadAll();
  }, [isAdmin]);

  async function loadAll(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setFetchError(false);

    const [ov, bk, au, ag, fm] = await Promise.all([
      fetchOverviewStats(),
      fetchBooksReport(),
      fetchTopAuthors(),
      fetchAgeBreakdown(),
      fetchFamiliesReport(),
    ]);

    if (!ov) setFetchError(true);

    setOverview(ov);
    setBooks(bk);
    setAuthors(au);
    setAgeBreakdown(ag.sort(sortAgeGroups));
    setFamilies(fm);
    setLoading(false);
    setRefreshing(false);
  }

  // Derived
  const filteredBooks = useMemo(() => {
    let result = books;
    if (ageGroupFilter !== "all") result = result.filter((b) => b.age_groups.includes(ageGroupFilter));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      if (sortBooks === "reads") return b.finished_count - a.finished_count;
      if (sortBooks === "rating") return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
      if (sortBooks === "pages") return (b.page_count ?? 0) - (a.page_count ?? 0);
      return a.title.localeCompare(b.title);
    });
  }, [books, ageGroupFilter, sortBooks, searchQuery]);

  const filteredAuthors = useMemo(() => {
    if (ageGroupFilter === "all") return authors;
    return authors.filter((a) => a.age_groups.includes(ageGroupFilter));
  }, [authors, ageGroupFilter]);

  const chartData = useMemo(
    () =>
      ageBreakdown
        .filter((ag) => ag.member_count > 0 || ag.books_finished > 0)
        .map((ag) => ({
          ...ag,
          label: AGE_GROUP_LABELS[ag.age_group] ?? ag.age_group,
          color: AGE_GROUP_COLORS[ag.age_group] ?? "#CBD5E0",
        })),
    [ageBreakdown]
  );

  const availableAgeGroups = useMemo(() => {
    const groups = new Set<string>();
    books.forEach((b) => b.age_groups.forEach((g) => groups.add(g)));
    return AGE_GROUP_ORDER.filter((g) => groups.has(g));
  }, [books]);

  const popularBook = useMemo(
    () => books.reduce<BookStat | null>((best, b) => (b.finished_count > (best?.finished_count ?? -1) ? b : best), null),
    [books]
  );

  const statusPieData = useMemo(() => {
    if (!overview) return [];
    return [
      { name: "Finished", value: overview.total_finished, fill: "#3B6E52" },
      { name: "Reading", value: overview.total_reading, fill: "#2D6B9F" },
      { name: "Want to read", value: overview.total_want_to_read, fill: "#C4922A" },
    ].filter((d) => d.value > 0);
  }, [overview]);

  function handlePrint() {
    window.print();
  }

  function openDetail(metric: DetailMetric) {
    setDetailMetric(metric);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!isAdmin) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <span className="text-5xl animate-pulse">📊</span>
        <p className="text-muted-foreground font-medium">Loading admin data…</p>
      </div>
    );
  }

  // ── Layout shell ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col print:bg-white" ref={printRef}>
      {/* Admin header */}
      <header className="sticky top-0 z-40 bg-foreground text-background border-b border-foreground/20 print:hidden">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => detailMetric ? setDetailMetric(null) : navigate("/dashboard")}
            className="flex items-center gap-1.5 text-background/70 hover:text-background transition-colors text-sm font-semibold"
          >
            <ArrowLeft size={16} />
            {detailMetric ? "Overview" : "Family view"}
          </button>
          <div className="flex-1" />
          <span className="text-sm font-bold flex items-center gap-2">
            <span className="text-lg">📚</span> Bookie
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary tracking-wider uppercase">Admin</span>
          </span>
          <button onClick={handlePrint} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors" title="Print / Export PDF">
            <Printer size={14} />
          </button>
          <button onClick={() => loadAll(true)} disabled={refreshing} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* Tab bar — hidden when in detail view */}
      {!detailMetric && (
        <div className="sticky top-14 z-30 bg-card border-b border-border print:hidden">
          <div className="max-w-3xl mx-auto px-4 flex">
            {(["overview", "library", "insights", "moderation"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t === "overview" ? "Overview" : t === "library" ? "Library" : t === "insights" ? "Insights" : "Moderation"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar — Library & Insights only */}
      {!detailMetric && tab !== "overview" && tab !== "moderation" && (
        <div className="bg-muted/50 border-b border-border print:hidden">
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-2">
            <div className="relative">
              <select value={ageGroupFilter} onChange={(e) => setAgeGroupFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold outline-none focus:ring-2 focus:ring-ring">
                <option value="all">All age groups</option>
                {availableAgeGroups.map((g) => <option key={g} value={g}>{AGE_GROUP_LABELS[g] ?? g}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
            {tab === "library" && (
              <>
                <div className="relative">
                  <select value={sortBooks} onChange={(e) => setSortBooks(e.target.value as typeof sortBooks)}
                    className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold outline-none focus:ring-2 focus:ring-ring">
                    <option value="reads">Most read</option>
                    <option value="rating">Top rated</option>
                    <option value="pages">Most pages</option>
                    <option value="alpha">A–Z</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
                <div className="relative flex-1 min-w-[160px]">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search title or author…"
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-card border border-border text-xs outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </>
            )}
            {ageGroupFilter !== "all" && (
              <button onClick={() => setAgeGroupFilter("all")} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>
            )}
          </div>
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 lg:px-8 py-6 pb-12 space-y-6">

        {/* ══ SETUP ERROR STATE ══ */}
        {fetchError && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2">
            <p className="font-bold text-amber-900 flex items-center gap-2">⚠️ Admin database setup required</p>
            <p className="text-sm text-amber-800">
              The admin SQL functions haven't been created in your Supabase project yet.
              Open <code className="bg-amber-100 px-1 rounded font-mono text-xs">supabase/schema.sql</code>,
              copy the <strong>SUPER ADMIN</strong> section at the bottom, and run it in your Supabase SQL editor.
            </p>
            <p className="text-xs text-amber-700">Also add yourself as admin with:
              <code className="block bg-amber-100 rounded p-2 mt-1 font-mono text-xs">
                insert into public.super_admins (user_id){"\n"}
                values ((select id from auth.users where email = 'your@email.com'));
              </code>
            </p>
          </div>
        )}

        {/* ══ DETAIL VIEWS ══ */}
        {detailMetric && <DetailView
          metric={detailMetric}
          overview={overview}
          books={books}
          authors={authors}
          ageBreakdown={ageBreakdown}
          chartData={chartData}
          families={families}
          onClose={() => setDetailMetric(null)}
        />}

        {/* ══ OVERVIEW TAB ══ */}
        {!detailMetric && tab === "overview" && (
          <>
            {/* Setup needed but not a full fetch error */}
            {!overview && !fetchError && (
              <div className="bg-muted rounded-2xl p-6 text-center text-muted-foreground text-sm">
                No overview data available yet. Ensure the admin SQL functions are created in Supabase.
              </div>
            )}

            {overview && (
              <>
                {/* Primary KPI widgets — 2×2 grid */}
                <div className="grid grid-cols-2 gap-3">
                  <OverviewWidget
                    emoji="🏠" label="Families" value={overview.total_families}
                    sub={`${overview.total_members} total members`}
                    onClick={() => openDetail("families")}
                  />
                  <OverviewWidget
                    emoji="👥" label="Readers" value={overview.total_members}
                    sub={`${overview.total_children} children`}
                    onClick={() => openDetail("readers")}
                  />
                  <OverviewWidget
                    emoji="📚" label="Books" value={overview.total_books}
                    sub={`${overview.total_finished} finished`}
                    onClick={() => openDetail("books")}
                  />
                  <OverviewWidget
                    emoji="📄" label="Pages Read" value={overview.pages_read.toLocaleString()}
                    sub="across all families"
                    onClick={() => openDetail("pages")}
                  />
                </div>

                {/* Secondary KPIs row */}
                <div className="grid grid-cols-3 gap-3">
                  <OverviewWidget
                    emoji="✅" label="Finished" value={overview.total_finished}
                    sub={`${overview.total_reading} reading now`}
                    compact onClick={() => openDetail("activity")}
                  />
                  <OverviewWidget
                    emoji="⭐" label="Reviews" value={overview.total_reviews}
                    sub={overview.avg_rating != null ? `Avg ${overview.avg_rating}★` : "None yet"}
                    compact onClick={() => openDetail("books")}
                  />
                  <OverviewWidget
                    emoji="🏆" label="Milestones" value={overview.total_milestones}
                    sub="celebrated" compact
                  />
                </div>

                {/* Reading status mini chart */}
                <section
                  className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => openDetail("activity")}
                  role="button"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display font-bold text-base flex items-center gap-2">
                      <BookOpen size={15} className="text-primary" /> Reading Activity
                    </h2>
                    <ArrowRight size={14} className="text-muted-foreground" />
                  </div>
                  {statusPieData.length > 0 ? (
                    <div className="flex gap-6 items-center">
                      <ResponsiveContainer width={100} height={100}>
                        <PieChart>
                          <Pie data={statusPieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={46}>
                            {statusPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 flex-1">
                        {statusPieData.map((d) => {
                          const total = statusPieData.reduce((s, x) => s + x.value, 0);
                          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                          return (
                            <div key={d.name} className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.fill }} />
                              <span className="text-xs flex-1">{d.name}</span>
                              <span className="text-xs font-bold">{d.value} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No reading data yet.</p>
                  )}
                </section>

                {/* Age group breakdown widget */}
                <section
                  className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => openDetail("age_groups")}
                  role="button"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display font-bold text-base flex items-center gap-2">
                      <Users size={15} className="text-primary" /> Readers by Age Group
                    </h2>
                    <ArrowRight size={14} className="text-muted-foreground" />
                  </div>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                        <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }}
                          formatter={(v: number) => [v, "Books finished"]} />
                        <Bar dataKey="books_finished" radius={[3, 3, 0, 0]}>
                          {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground">Set age groups in profiles to see this data.</p>
                  )}
                  {overview.members_without_age_group > 0 && (
                    <p className="text-[11px] text-amber-600 mt-2">
                      ⚠️ {overview.members_without_age_group} member{overview.members_without_age_group !== 1 ? "s have" : " has"} no age group set — data is partial.
                    </p>
                  )}
                </section>

                {/* Most popular book */}
                {popularBook && (
                  <section
                    className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => openDetail("books")}
                    role="button"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-display font-bold text-base flex items-center gap-2">
                        <TrendingUp size={15} className="text-primary" /> Most Read Book
                      </h2>
                      <ArrowRight size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <BookCover src={popularBook.cover_url} isbn={popularBook.isbn} title={popularBook.title} className="w-full h-full object-cover" fallbackClassName="w-full h-full" iconSize={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-bold leading-tight line-clamp-2">{popularBook.title}</p>
                        <p className="text-sm text-muted-foreground">{popularBook.author}</p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          <StatChip icon="✅" value={`${popularBook.finished_count}`} label="reads" />
                          {popularBook.avg_rating != null && <StatChip icon="⭐" value={`${popularBook.avg_rating}`} label="avg" />}
                          {popularBook.review_count > 0 && <StatChip icon="💬" value={`${popularBook.review_count}`} label="reviews" />}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Top authors preview */}
                {authors.length > 0 && (
                  <section
                    className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => openDetail("authors")}
                    role="button"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <h2 className="font-display font-bold text-base flex items-center gap-2">
                        <Star size={15} className="text-primary" /> Popular Authors
                      </h2>
                      <ArrowRight size={14} className="text-muted-foreground" />
                    </div>
                    <div className="divide-y divide-border">
                      {authors.slice(0, 3).map((a, i) => (
                        <div key={a.author} className="px-4 py-2.5 flex items-center gap-3">
                          <span className="w-5 text-xs font-bold text-muted-foreground flex-shrink-0">{["🥇", "🥈", "🥉"][i]}</span>
                          <span className="flex-1 text-sm font-semibold truncate">{a.author}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">✅ {a.finished_count}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* ══ LIBRARY TAB ══ */}
        {!detailMetric && tab === "library" && (
          <>
            <p className="text-xs text-muted-foreground font-semibold">
              {filteredBooks.length} book{filteredBooks.length !== 1 ? "s" : ""}
              {ageGroupFilter !== "all" ? ` · ${AGE_GROUP_LABELS[ageGroupFilter] ?? ageGroupFilter}` : ""}
            </p>
            <div className="space-y-3">
              {filteredBooks.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-2xl">
                  <span className="text-4xl block mb-3">📭</span>
                  <p className="font-semibold text-sm">No books match this filter</p>
                </div>
              ) : filteredBooks.map((book) => <BookCard key={book.id} book={book} />)}
            </div>
          </>
        )}

        {/* ══ INSIGHTS TAB ══ */}
        {!detailMetric && tab === "insights" && (
          <>
            <InsightsContent chartData={chartData} ageBreakdown={ageBreakdown} filteredAuthors={filteredAuthors} books={books} ageGroupFilter={ageGroupFilter} />
          </>
        )}

        {/* ══ MODERATION TAB ══ */}
        {tab === "moderation" && <ModerationTab />}
      </main>
    </div>
  );
}

// ── Detail views ──────────────────────────────────────────────

interface DetailViewProps {
  metric: DetailMetric;
  overview: OverviewStats | null;
  books: BookStat[];
  authors: AuthorStat[];
  ageBreakdown: AgeGroupStat[];
  chartData: Array<AgeGroupStat & { label: string; color: string }>;
  families: FamilyStat[];
  onClose: () => void;
}

function BackButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-4 print:hidden"
    >
      <ArrowLeft size={15} /> Back to Overview
    </button>
  );
}

function DetailView({ metric, overview, books, authors, ageBreakdown, chartData, families, onClose }: DetailViewProps) {
  const [sortFamilies, setSortFamilies] = useState<"books" | "reads" | "members" | "pages">("books");
  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");

  const sortedFamilies = useMemo(() => {
    return [...families].sort((a, b) => {
      if (sortFamilies === "books") return b.book_count - a.book_count;
      if (sortFamilies === "reads") return b.books_finished - a.books_finished;
      if (sortFamilies === "members") return b.member_count - a.member_count;
      return b.pages_read - a.pages_read;
    });
  }, [families, sortFamilies]);

  if (metric === "families") {
    return (
      <>
        <BackButton onClose={onClose} />
        <PrintHeader title="Families Report" />
        <SectionHeader title="All Families" subtitle={`${families.length} registered families`} />
        <div className="flex gap-2 mb-4 flex-wrap print:hidden">
          {(["books", "reads", "members", "pages"] as const).map((s) => (
            <button key={s} onClick={() => setSortFamilies(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${sortFamilies === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {s === "books" ? "Most books" : s === "reads" ? "Most reads" : s === "members" ? "Largest" : "Most pages"}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {sortedFamilies.map((f) => (
            <div key={f.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <span className="text-2xl">🏠</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.member_count} members · {f.child_count} children</p>
              </div>
              <div className="flex gap-3 text-right flex-shrink-0">
                <div><p className="text-sm font-bold">{f.book_count}</p><p className="text-[10px] text-muted-foreground">books</p></div>
                <div><p className="text-sm font-bold">{f.books_finished}</p><p className="text-[10px] text-muted-foreground">read</p></div>
                <div><p className="text-sm font-bold">{f.pages_read.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">pages</p></div>
                {f.avg_rating != null && <div><p className="text-sm font-bold">{f.avg_rating}⭐</p><p className="text-[10px] text-muted-foreground">rating</p></div>}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (metric === "readers" || metric === "age_groups") {
    const knownGroups = ageBreakdown.filter((ag) => ag.member_count > 0 || ag.books_finished > 0);
    return (
      <>
        <BackButton onClose={onClose} />
        <PrintHeader title="Readers by Age Group" />
        <SectionHeader title="Readers by Age Group" subtitle="Books finished and pages read, segmented by reader age" />

        {chartData.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 mb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Books finished</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }}
                  formatter={(v: number, n: string) => [v, n === "books_finished" ? "Finished" : n === "books_reading" ? "Reading" : "Want to read"]} />
                <Bar dataKey="books_finished" radius={[3, 3, 0, 0]} name="books_finished">
                  {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-5 text-[10px] font-bold text-muted-foreground uppercase px-4 py-2 border-b border-border bg-muted/30">
            <span className="col-span-2">Age Group</span>
            <span className="text-right">Members</span>
            <span className="text-right">Finished</span>
            <span className="text-right">Pages</span>
          </div>
          <div className="divide-y divide-border">
            {knownGroups.map((ag) => (
              <div key={ag.age_group} className="grid grid-cols-5 px-4 py-2.5 items-center">
                <div className="col-span-2 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: AGE_GROUP_COLORS[ag.age_group] ?? "#CBD5E0" }} />
                  <span className="text-xs font-semibold">{AGE_GROUP_LABELS[ag.age_group] ?? ag.age_group}</span>
                </div>
                <span className="text-xs text-right">{ag.member_count}</span>
                <span className="text-xs font-bold text-right">{ag.books_finished}</span>
                <span className="text-xs text-right">{ag.pages_read.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top books per age group */}
        {knownGroups.filter((ag) => ag.age_group !== "Unknown" && ag.books_finished > 0).length > 0 && (
          <div className="space-y-3 mt-4">
            <h3 className="font-display font-bold text-base">Most-read books per age group</h3>
            {knownGroups
              .filter((ag) => ag.age_group !== "Unknown" && ag.books_finished > 0)
              .map((ag) => {
                const topBooksForGroup = books
                  .filter((b) => b.age_groups.includes(ag.age_group))
                  .sort((a, b) => b.finished_count - a.finished_count)
                  .slice(0, 3);
                if (topBooksForGroup.length === 0) return null;
                return (
                  <div key={ag.age_group} className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-border flex items-center gap-2"
                      style={{ borderLeftWidth: 3, borderLeftColor: AGE_GROUP_COLORS[ag.age_group] ?? "#CBD5E0" }}>
                      <span className="text-xs font-bold">{AGE_GROUP_LABELS[ag.age_group] ?? ag.age_group}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {topBooksForGroup.map((b, i) => (
                        <div key={b.id} className="px-3 py-2 flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{b.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{b.author}</p>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">✅ {b.finished_count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </>
    );
  }

  if (metric === "books" || metric === "pages") {
    const sorted = [...books].sort((a, b) =>
      metric === "pages" ? (b.page_count ?? 0) - (a.page_count ?? 0) : b.finished_count - a.finished_count
    );
    return (
      <>
        <BackButton onClose={onClose} />
        <PrintHeader title={metric === "pages" ? "Books by Page Count" : "Books Report"} />
        <div className="flex gap-2 mb-4 print:hidden">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or author…"
              className="w-full pl-7 pr-3 py-2 rounded-xl bg-card border border-border text-xs outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <SectionHeader
          title={metric === "pages" ? `Books by Pages` : "All Books"}
          subtitle={`${sorted.length} books · sorted by ${metric === "pages" ? "page count" : "most finished"}`}
        />
        <div className="space-y-2">
          {sorted
            .filter((b) => !search || b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()))
            .map((book) => <BookCard key={book.id} book={book} showPages={metric === "pages"} />)}
        </div>
      </>
    );
  }

  if (metric === "activity") {
    const total = (overview?.total_finished ?? 0) + (overview?.total_reading ?? 0) + (overview?.total_want_to_read ?? 0);
    return (
      <>
        <BackButton onClose={onClose} />
        <PrintHeader title="Reading Activity Report" />
        <SectionHeader title="Reading Activity" subtitle="Distribution of reading statuses across all families" />
        <div className="space-y-4">
          {[
            { label: "Finished", count: overview?.total_finished ?? 0, color: "#3B6E52", emoji: "✅" },
            { label: "Currently Reading", count: overview?.total_reading ?? 0, color: "#2D6B9F", emoji: "📖" },
            { label: "Want to Read", count: overview?.total_want_to_read ?? 0, color: "#C4922A", emoji: "🔖" },
          ].map(({ label, count, color, emoji }) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={label} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{emoji}</span>
                    <div>
                      <p className="font-bold">{label}</p>
                      <p className="text-xs text-muted-foreground">{pct}% of all reading activity</p>
                    </div>
                  </div>
                  <p className="font-display text-3xl font-bold" style={{ color }}>{count}</p>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
          {overview && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="font-bold mb-1">Reviews & Ratings</p>
              <div className="flex gap-6">
                <div>
                  <p className="font-display text-2xl font-bold">{overview.total_reviews}</p>
                  <p className="text-xs text-muted-foreground">reviews written</p>
                </div>
                {overview.avg_rating != null && (
                  <div>
                    <p className="font-display text-2xl font-bold">{overview.avg_rating}⭐</p>
                    <p className="text-xs text-muted-foreground">average rating</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  if (metric === "authors") {
    return (
      <>
        <BackButton onClose={onClose} />
        <PrintHeader title="Author Popularity Report" />
        <div className="flex gap-2 mb-4 items-center print:hidden">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search authors…"
              className="w-full pl-7 pr-3 py-2 rounded-xl bg-card border border-border text-xs outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="relative">
            <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-2 rounded-xl bg-card border border-border text-xs font-semibold outline-none">
              <option value="all">All readers</option>
              {AGE_GROUP_ORDER.filter((g) => authors.some((a) => a.age_groups.includes(g))).map((g) => (
                <option key={g} value={g}>{AGE_GROUP_LABELS[g] ?? g}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
        </div>
        <SectionHeader title="Author Leaderboard" subtitle="Ranked by finished reads" />
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="divide-y divide-border">
            {authors
              .filter((a) => ageFilter === "all" || a.age_groups.includes(ageFilter))
              .filter((a) => !search || a.author.toLowerCase().includes(search.toLowerCase()))
              .map((a, i) => (
                <div key={a.author} className="px-4 py-3 flex items-center gap-3">
                  <span className="w-7 text-center font-bold text-sm text-muted-foreground flex-shrink-0">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{a.author}</p>
                    <p className="text-[11px] text-muted-foreground">{a.book_count} book{a.book_count !== 1 ? "s" : ""} in library</p>
                    {a.age_groups.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.age_groups.map((ag) => (
                          <span key={ag} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: (AGE_GROUP_COLORS[ag] ?? "#CBD5E0") + "22", color: AGE_GROUP_COLORS[ag] ?? "#9AA5B4" }}>
                            {AGE_GROUP_LABELS[ag] ?? ag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 text-right flex-shrink-0">
                    <div><p className="text-sm font-bold">{a.finished_count}</p><p className="text-[10px] text-muted-foreground">reads</p></div>
                    {a.avg_rating != null && <div><p className="text-sm font-bold">{a.avg_rating}⭐</p><p className="text-[10px] text-muted-foreground">avg</p></div>}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </>
    );
  }

  return null;
}

// ── Insights tab content ──────────────────────────────────────

function InsightsContent({ chartData, ageBreakdown, filteredAuthors, books, ageGroupFilter }: {
  chartData: Array<AgeGroupStat & { label: string; color: string }>;
  ageBreakdown: AgeGroupStat[];
  filteredAuthors: AuthorStat[];
  books: BookStat[];
  ageGroupFilter: string;
}) {
  return (
    <>
      <section className="bg-card border border-border rounded-2xl p-4">
        <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
          <Users size={16} className="text-primary" /> Readers by Age Group
        </h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}
                formatter={(v: number) => [v, "Books finished"]} />
              <Bar dataKey="books_finished" radius={[4, 4, 0, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">Set age groups in reader profiles to see this chart.</p>
        )}
      </section>

      {chartData.length > 0 && (
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h2 className="font-display font-bold text-base">Age Group Detail</h2></div>
          <div className="divide-y divide-border">
            {ageBreakdown.filter((ag) => ag.member_count > 0 || ag.books_finished > 0).map((ag) => (
              <div key={ag.age_group} className={`px-4 py-3 flex items-center gap-3 ${ageGroupFilter === ag.age_group ? "bg-primary/5" : ""}`}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: AGE_GROUP_COLORS[ag.age_group] ?? "#CBD5E0" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{AGE_GROUP_LABELS[ag.age_group] ?? ag.age_group}</p>
                  <p className="text-[11px] text-muted-foreground">{ag.member_count} member{ag.member_count !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex gap-4 text-right">
                  <div><p className="text-sm font-bold">{ag.books_finished}</p><p className="text-[10px] text-muted-foreground">finished</p></div>
                  <div><p className="text-sm font-bold">{ag.books_reading}</p><p className="text-[10px] text-muted-foreground">reading</p></div>
                  <div><p className="text-sm font-bold">{ag.pages_read.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">pages</p></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Star size={15} className="text-primary" />
          <h2 className="font-display font-bold text-base">
            Popular Authors
            {ageGroupFilter !== "all" && <span className="text-xs font-normal text-muted-foreground ml-1.5">· {AGE_GROUP_LABELS[ageGroupFilter] ?? ageGroupFilter}</span>}
          </h2>
        </div>
        {filteredAuthors.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No author data for this filter.</div>
        ) : (
          <div className="divide-y divide-border">
            {filteredAuthors.map((a, i) => (
              <div key={a.author} className="px-4 py-3 flex items-center gap-3">
                <span className="w-6 text-center font-bold text-sm text-muted-foreground flex-shrink-0">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{a.author}</p>
                  <p className="text-[11px] text-muted-foreground">{a.book_count} book{a.book_count !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex gap-3 text-right flex-shrink-0">
                  <div><p className="text-sm font-bold">{a.finished_count}</p><p className="text-[10px] text-muted-foreground">reads</p></div>
                  {a.avg_rating != null && <div><p className="text-sm font-bold">{a.avg_rating}⭐</p><p className="text-[10px] text-muted-foreground">avg</p></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {books.filter((b) => b.review_count > 0).length > 0 && (
        <section className="bg-card border border-border rounded-2xl p-4">
          <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
            <FileText size={16} className="text-primary" /> Most Reviewed
          </h2>
          <div className="space-y-2">
            {[...books].filter((b) => b.review_count > 0).sort((a, b) => b.review_count - a.review_count).slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.author}</p>
                </div>
                <span className="text-xs font-bold text-muted-foreground flex-shrink-0">💬 {b.review_count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────

function OverviewWidget({ emoji, label, value, sub, compact = false, onClick }: {
  emoji: string; label: string; value: string | number; sub: string; compact?: boolean; onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`bg-card border border-border rounded-2xl text-center transition-all w-full
        ${compact ? "p-3" : "p-4"}
        ${onClick ? "hover:border-primary/40 hover:shadow-sm active:scale-[0.98] cursor-pointer" : ""}`}
    >
      <span className={`block mb-1 ${compact ? "text-xl" : "text-2xl"}`}>{emoji}</span>
      <p className={`font-display font-bold ${compact ? "text-xl" : "text-2xl"}`}>{value}</p>
      <p className={`text-muted-foreground font-medium mt-0.5 ${compact ? "text-[10px]" : "text-[11px]"}`}>{label}</p>
      <p className={`text-muted-foreground/70 ${compact ? "text-[9px]" : "text-[10px]"}`}>{sub}</p>
      {onClick && <span className="text-primary text-[10px] font-bold mt-1 block">View details →</span>}
    </Tag>
  );
}

function BookCard({ book, showPages = false }: { book: BookStat; showPages?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex gap-3">
      <BookCover
        src={book.cover_url}
        isbn={book.isbn}
        title={book.title}
        className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
        fallbackClassName="w-12 h-16 rounded-lg flex-shrink-0"
        iconSize={18}
      />
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-sm leading-snug line-clamp-2">{book.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{book.author}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <StatChip icon="✅" value={`${book.finished_count}`} label="read" />
          <StatChip icon="📖" value={`${book.reading_count}`} label="reading" />
          {book.avg_rating != null && <StatChip icon="⭐" value={`${book.avg_rating}`} label="avg" />}
          {book.review_count > 0 && <StatChip icon="💬" value={`${book.review_count}`} label="reviews" />}
          {showPages && book.page_count && <StatChip icon="📄" value={`${book.page_count}`} label="pages" />}
        </div>
        {book.age_groups.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {book.age_groups.map((ag) => (
              <span key={ag} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: (AGE_GROUP_COLORS[ag] ?? "#CBD5E0") + "22", color: AGE_GROUP_COLORS[ag] ?? "#9AA5B4", border: `1px solid ${(AGE_GROUP_COLORS[ag] ?? "#CBD5E0")}44` }}>
                {AGE_GROUP_LABELS[ag] ?? ag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PrintHeader({ title }: { title: string }) {
  return (
    <div className="hidden print:flex items-center justify-between mb-6 pb-4 border-b border-border">
      <div>
        <p className="text-xs text-muted-foreground font-mono">📚 Bookie Admin</p>
        <h1 className="font-display font-bold text-xl">{title}</h1>
      </div>
      <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</p>
    </div>
  );
}

// ── Moderation tab ────────────────────────────────────────────

interface ModerationWord {
  id: string;
  word: string;
  enabled: boolean;
  added_at: string;
  added_by: string | null;
}

function ModerationTab() {
  const [words, setWords] = useState<ModerationWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEnabled, setFilterEnabled] = useState<"all" | "enabled" | "disabled">("all");
  const [newWord, setNewWord] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("moderation_words")
      .select("*")
      .order("word");
    setWords((data as ModerationWord[]) || []);
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const w = newWord.trim().toLowerCase();
    if (!w) return;
    setAdding(true);
    const { data, error } = await supabase
      .from("moderation_words")
      .insert({ word: w })
      .select().single();
    setAdding(false);
    if (error) {
      if (error.code === "23505") {
        // unique violation — word already exists
        const existing = words.find((x) => x.word === w);
        if (existing && !existing.enabled) {
          // re-enable it instead
          await handleToggle(existing);
        }
      }
      setNewWord("");
      setShowAddInput(false);
      return;
    }
    setWords((prev) => [...prev, data as ModerationWord].sort((a, b) => a.word.localeCompare(b.word)));
    setNewWord("");
    setShowAddInput(false);
  }

  async function handleToggle(word: ModerationWord) {
    setSavingId(word.id);
    const { error } = await supabase
      .from("moderation_words")
      .update({ enabled: !word.enabled })
      .eq("id", word.id);
    setSavingId(null);
    if (!error) setWords((prev) => prev.map((w) => w.id === word.id ? { ...w, enabled: !w.enabled } : w));
  }

  async function handleDelete(word: ModerationWord) {
    setDeletingId(word.id);
    await supabase.from("moderation_words").delete().eq("id", word.id);
    setWords((prev) => prev.filter((w) => w.id !== word.id));
    setDeletingId(null);
  }

  const filtered = words.filter((w) => {
    if (filterEnabled === "enabled" && !w.enabled) return false;
    if (filterEnabled === "disabled" && w.enabled) return false;
    if (search.trim() && !w.word.includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const enabledCount = words.filter((w) => w.enabled).length;
  const disabledCount = words.filter((w) => !w.enabled).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-primary" />
            <h2 className="font-display font-bold text-xl">Profanity Word List</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Words in this list are automatically asterisk-filtered in club comments. Enabled words are active; disabled words are excluded from filtering.
          </p>
        </div>
        <button
          onClick={() => setShowAddInput(!showAddInput)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm shrink-0 ml-4"
        >
          {showAddInput ? <X size={14} /> : <Plus size={14} />}
          {showAddInput ? "Cancel" : "Add Word"}
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total words", value: words.length, color: "text-foreground" },
          { label: "Filtering active", value: enabledCount, color: "text-primary" },
          { label: "Disabled", value: disabledCount, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl px-4 py-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Add word form */}
      {showAddInput && (
        <form onSubmit={handleAdd} className="flex gap-2 mb-5">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value.toLowerCase())}
            placeholder="Type a word to add…"
            autoFocus
            className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
          />
          <button
            type="submit"
            disabled={adding || !newWord.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </form>
      )}

      {/* Search + filter */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search words…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex bg-muted rounded-xl p-1 gap-1 shrink-0">
          {(["all", "enabled", "disabled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterEnabled(f)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all capitalize ${filterEnabled === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Word list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck size={36} className="mx-auto text-muted-foreground mb-3 opacity-40" />
          <p className="font-semibold text-foreground">
            {search ? "No words match your search" : words.length === 0 ? "No words in the list yet" : "No words to show"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {!search && words.length === 0 && "Add words above to begin filtering profanity."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 border-b border-border bg-muted/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Word</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center w-20">Filtering</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-8" />
          </div>
          <div className="divide-y divide-border">
            {filtered.map((word) => (
              <div key={word.id} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <code className={`text-sm font-mono font-semibold truncate ${word.enabled ? "text-foreground" : "text-muted-foreground line-through"}`}>
                    {word.word}
                  </code>
                </div>
                {/* Toggle */}
                <div className="flex items-center justify-center w-20">
                  <button
                    onClick={() => handleToggle(word)}
                    disabled={savingId === word.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                      word.enabled
                        ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/30"
                    }`}
                  >
                    {savingId === word.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : word.enabled ? (
                      <><ToggleRight size={13} />On</>
                    ) : (
                      <><ToggleLeft size={13} />Off</>
                    )}
                  </button>
                </div>
                {/* Delete */}
                <div className="flex justify-end w-8">
                  <button
                    onClick={() => handleDelete(word)}
                    disabled={deletingId === word.id}
                    title="Remove word"
                    className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {deletingId === word.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      {!loading && words.length > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          Changes take effect immediately for all new comments across all clubs. Existing comments are not retroactively filtered.
        </p>
      )}
    </div>
  );
}
