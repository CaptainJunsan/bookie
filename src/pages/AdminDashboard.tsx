import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, BookOpen, Users, Library, FileText, Star,
  Search, ChevronDown, RefreshCw, TrendingUp, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchOverviewStats, fetchBooksReport, fetchTopAuthors, fetchAgeBreakdown,
  type OverviewStats, type BookStat, type AuthorStat, type AgeGroupStat,
} from "../lib/admin";
import { AGE_GROUP_COLORS, AGE_GROUP_LABELS } from "../lib/types";

type Tab = "overview" | "library" | "insights";

const AGE_GROUP_ORDER = [
  "0-2", "3-5", "6-9", "10-15", "16-21", "22-35", "36-65", "66+",
  "prefer_not_to_say", "Unknown",
];

function sortAgeGroups(a: AgeGroupStat, b: AgeGroupStat) {
  return AGE_GROUP_ORDER.indexOf(a.age_group) - AGE_GROUP_ORDER.indexOf(b.age_group);
}

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [books, setBooks] = useState<BookStat[]>([]);
  const [authors, setAuthors] = useState<AuthorStat[]>([]);
  const [ageBreakdown, setAgeBreakdown] = useState<AgeGroupStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
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

    const [ov, bk, au, ag] = await Promise.all([
      fetchOverviewStats(),
      fetchBooksReport(),
      fetchTopAuthors(),
      fetchAgeBreakdown(),
    ]);

    setOverview(ov);
    setBooks(bk);
    setAuthors(au);
    setAgeBreakdown(ag.sort(sortAgeGroups));
    setLoading(false);
    setRefreshing(false);
  }

  // Derived: filtered + sorted books
  const filteredBooks = useMemo(() => {
    let result = books;

    if (ageGroupFilter !== "all") {
      result = result.filter((b) => b.age_groups.includes(ageGroupFilter));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (sortBooks === "reads") return b.finished_count - a.finished_count;
      if (sortBooks === "rating") return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
      if (sortBooks === "pages") return (b.page_count ?? 0) - (a.page_count ?? 0);
      return a.title.localeCompare(b.title);
    });
  }, [books, ageGroupFilter, sortBooks, searchQuery]);

  // Derived: filtered authors
  const filteredAuthors = useMemo(() => {
    if (ageGroupFilter === "all") return authors;
    return authors.filter((a) => a.age_groups.includes(ageGroupFilter));
  }, [authors, ageGroupFilter]);

  // Derived: age breakdown for chart (exclude Unknown if empty)
  const chartData = useMemo(
    () =>
      ageBreakdown
        .filter((ag) => ag.age_group !== "Unknown" || ag.member_count > 0)
        .map((ag) => ({
          ...ag,
          label: AGE_GROUP_LABELS[ag.age_group] ?? ag.age_group,
          color: AGE_GROUP_COLORS[ag.age_group] ?? "#CBD5E0",
        })),
    [ageBreakdown]
  );

  // Unique age groups from data for the filter dropdown
  const availableAgeGroups = useMemo(() => {
    const groups = new Set<string>();
    books.forEach((b) => b.age_groups.forEach((g) => groups.add(g)));
    return AGE_GROUP_ORDER.filter((g) => groups.has(g));
  }, [books]);

  const popularBook = useMemo(
    () => books.reduce((best, b) => (b.finished_count > (best?.finished_count ?? -1) ? b : best), null as BookStat | null),
    [books]
  );

  if (!isAdmin) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <span className="text-5xl animate-pulse">📊</span>
        <p className="text-muted-foreground font-medium">Loading admin data…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Admin header */}
      <header className="sticky top-0 z-40 bg-foreground text-background border-b border-foreground/20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-background/70 hover:text-background transition-colors text-sm font-semibold"
          >
            <ArrowLeft size={16} /> Family view
          </button>
          <div className="flex-1" />
          <span className="text-sm font-bold tracking-tight flex items-center gap-2">
            <span className="text-lg">📚</span>
            Bookie
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary tracking-wider uppercase">
              Admin
            </span>
          </span>
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="sticky top-14 z-30 bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 flex">
          {(["overview", "library", "insights"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "overview" ? "Overview" : t === "library" ? "Library" : "Insights"}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar (Library + Insights) */}
      {tab !== "overview" && (
        <div className="bg-muted/50 border-b border-border">
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-2">
            {/* Age group filter */}
            <div className="relative">
              <select
                value={ageGroupFilter}
                onChange={(e) => setAgeGroupFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All age groups</option>
                {availableAgeGroups.map((g) => (
                  <option key={g} value={g}>{AGE_GROUP_LABELS[g] ?? g}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>

            {/* Library-only controls */}
            {tab === "library" && (
              <>
                <div className="relative">
                  <select
                    value={sortBooks}
                    onChange={(e) => setSortBooks(e.target.value as typeof sortBooks)}
                    className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="reads">Most read</option>
                    <option value="rating">Top rated</option>
                    <option value="pages">Most pages</option>
                    <option value="alpha">A–Z</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
                <div className="relative flex-1 min-w-[160px]">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search title or author…"
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-card border border-border text-xs outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </>
            )}

            {ageGroupFilter !== "all" && (
              <button
                onClick={() => setAgeGroupFilter("all")}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-12 space-y-6">

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && overview && (
          <>
            {/* Primary KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Families", value: overview.total_families, icon: "🏠" },
                { label: "Members", value: overview.total_members, icon: "👥" },
                { label: "Books", value: overview.total_books, icon: "📚" },
                { label: "Pages Read", value: overview.pages_read.toLocaleString(), icon: "📄" },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
                  <span className="text-2xl block mb-1">{icon}</span>
                  <p className="font-display text-2xl font-bold">{value}</p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Finished", value: overview.total_finished, sub: `${overview.total_reading} reading`, icon: "✅" },
                { label: "Reviews", value: overview.total_reviews, sub: overview.avg_rating != null ? `Avg ${overview.avg_rating}★` : "No ratings yet", icon: "⭐" },
                { label: "Milestones", value: overview.total_milestones, sub: `${overview.total_children} child readers`, icon: "🏆" },
              ].map(({ label, value, sub, icon }) => (
                <div key={label} className="bg-card border border-border rounded-2xl p-3 text-center">
                  <span className="text-xl block mb-1">{icon}</span>
                  <p className="font-display text-xl font-bold">{value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium leading-tight mt-0.5">{label}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Reading status distribution */}
            <section className="bg-card border border-border rounded-2xl p-4">
              <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
                <BarChart2 size={16} className="text-primary" /> Reading Activity
              </h2>
              <div className="space-y-3">
                {[
                  { label: "Finished", count: overview.total_finished, color: "#3B6E52" },
                  { label: "Reading now", count: overview.total_reading, color: "#2D6B9F" },
                  { label: "Want to read", count: overview.total_want_to_read, color: "#C4922A" },
                ].map(({ label, count, color }) => {
                  const total = overview.total_finished + overview.total_reading + overview.total_want_to_read;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold" style={{ color }}>{label}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Age group coverage notice */}
            {overview.members_without_age_group > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <span className="text-xl mt-0.5">📊</span>
                <div>
                  <p className="text-sm font-bold text-amber-800">Age data incomplete</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {overview.members_without_age_group} member{overview.members_without_age_group !== 1 ? "s have" : " has"} not set an age group yet. Age-based insights will be partial.
                  </p>
                </div>
              </div>
            )}

            {/* Most popular book */}
            {popularBook && (
              <section className="bg-card border border-border rounded-2xl p-4">
                <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" /> Most Read Book
                </h2>
                <div className="flex gap-3 items-center">
                  {popularBook.cover_url ? (
                    <img src={popularBook.cover_url} alt={popularBook.title} className="w-12 h-18 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-16 rounded-lg bg-secondary flex items-center justify-center text-xl flex-shrink-0">📘</div>
                  )}
                  <div className="min-w-0">
                    <p className="font-display font-bold leading-tight line-clamp-2">{popularBook.title}</p>
                    <p className="text-sm text-muted-foreground">{popularBook.author}</p>
                    <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>✅ {popularBook.finished_count} finished</span>
                      {popularBook.avg_rating && <span>⭐ {popularBook.avg_rating}</span>}
                      {popularBook.review_count > 0 && <span>💬 {popularBook.review_count} reviews</span>}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ── LIBRARY TAB ── */}
        {tab === "library" && (
          <>
            <p className="text-xs text-muted-foreground font-semibold">
              {filteredBooks.length} book{filteredBooks.length !== 1 ? "s" : ""}
              {ageGroupFilter !== "all" ? ` · filtered by ${AGE_GROUP_LABELS[ageGroupFilter] ?? ageGroupFilter}` : ""}
            </p>

            <div className="space-y-3">
              {filteredBooks.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-2xl">
                  <span className="text-4xl block mb-3">📭</span>
                  <p className="font-semibold">No books match this filter</p>
                </div>
              ) : (
                filteredBooks.map((book) => (
                  <div key={book.id} className="bg-card border border-border rounded-2xl p-3 flex gap-3">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={book.title} className="w-12 h-16 object-cover rounded-lg flex-shrink-0 bg-secondary" />
                    ) : (
                      <div className="w-12 h-16 rounded-lg bg-secondary flex items-center justify-center text-xl flex-shrink-0">📘</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm leading-snug line-clamp-2">{book.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{book.author}</p>

                      {/* Stats row */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <StatChip icon="✅" value={`${book.finished_count}`} label="finished" />
                        <StatChip icon="📖" value={`${book.reading_count}`} label="reading" />
                        {book.avg_rating != null && <StatChip icon="⭐" value={`${book.avg_rating}`} label="avg" />}
                        {book.review_count > 0 && <StatChip icon="💬" value={`${book.review_count}`} label="reviews" />}
                        {book.page_count && <StatChip icon="📄" value={`${book.page_count}`} label="pages" />}
                      </div>

                      {/* Age group chips */}
                      {book.age_groups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {book.age_groups.map((ag) => (
                            <span
                              key={ag}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                background: (AGE_GROUP_COLORS[ag] ?? "#CBD5E0") + "22",
                                color: AGE_GROUP_COLORS[ag] ?? "#9AA5B4",
                                border: `1px solid ${(AGE_GROUP_COLORS[ag] ?? "#CBD5E0")}44`,
                              }}
                            >
                              {AGE_GROUP_LABELS[ag] ?? ag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── INSIGHTS TAB ── */}
        {tab === "insights" && (
          <>
            {/* Age group breakdown chart */}
            <section className="bg-card border border-border rounded-2xl p-4">
              <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
                <Users size={16} className="text-primary" /> Readers by Age Group
              </h2>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No age group data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)" }}
                      labelStyle={{ fontWeight: 700 }}
                      formatter={(value: number, name: string) => [value, name === "books_finished" ? "Books finished" : name === "member_count" ? "Members" : name]}
                    />
                    <Bar dataKey="books_finished" radius={[4, 4, 0, 0]} name="books_finished">
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            {/* Age breakdown table */}
            {chartData.length > 0 && (
              <section className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="font-display font-bold text-base">Age Group Detail</h2>
                </div>
                <div className="divide-y divide-border">
                  {ageBreakdown
                    .filter((ag) => ag.member_count > 0 || ag.books_finished > 0)
                    .map((ag) => (
                      <div
                        key={ag.age_group}
                        className={`px-4 py-3 flex items-center gap-3 ${ageGroupFilter === ag.age_group ? "bg-primary/5" : ""}`}
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: AGE_GROUP_COLORS[ag.age_group] ?? "#CBD5E0" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold">{AGE_GROUP_LABELS[ag.age_group] ?? ag.age_group}</p>
                          <p className="text-[11px] text-muted-foreground">{ag.member_count} member{ag.member_count !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="flex gap-4 text-right">
                          <div>
                            <p className="text-sm font-bold text-foreground">{ag.books_finished}</p>
                            <p className="text-[10px] text-muted-foreground">finished</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{ag.books_reading}</p>
                            <p className="text-[10px] text-muted-foreground">reading</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{ag.pages_read.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">pages</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Top authors */}
            <section className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Star size={15} className="text-primary" />
                <h2 className="font-display font-bold text-base">
                  Popular Authors
                  {ageGroupFilter !== "all" && (
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      · {AGE_GROUP_LABELS[ageGroupFilter] ?? ageGroupFilter} readers
                    </span>
                  )}
                </h2>
              </div>
              {filteredAuthors.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No author data for this filter.</div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredAuthors.map((author, i) => (
                    <div key={author.author} className="px-4 py-3 flex items-center gap-3">
                      <span className="w-6 text-center font-bold text-sm text-muted-foreground flex-shrink-0">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm leading-snug truncate">{author.author}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {author.book_count} book{author.book_count !== 1 ? "s" : ""} in library
                        </p>
                      </div>
                      <div className="flex gap-4 text-right flex-shrink-0">
                        <div>
                          <p className="text-sm font-bold">{author.finished_count}</p>
                          <p className="text-[10px] text-muted-foreground">reads</p>
                        </div>
                        {author.avg_rating != null && (
                          <div>
                            <p className="text-sm font-bold">{author.avg_rating}⭐</p>
                            <p className="text-[10px] text-muted-foreground">rating</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Reading depth: books with reviews */}
            {books.filter((b) => b.review_count > 0).length > 0 && (
              <section className="bg-card border border-border rounded-2xl p-4">
                <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-primary" /> Most Reviewed Books
                </h2>
                <div className="space-y-2">
                  {[...books]
                    .filter((b) => b.review_count > 0)
                    .sort((a, b) => b.review_count - a.review_count)
                    .slice(0, 5)
                    .map((b) => (
                      <div key={b.id} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{b.title}</p>
                          <p className="text-xs text-muted-foreground">{b.author}</p>
                        </div>
                        <span className="text-xs font-bold text-muted-foreground flex-shrink-0">
                          💬 {b.review_count}
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatChip({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-muted-foreground">
      {icon} {value} <span className="font-normal opacity-70">{label}</span>
    </span>
  );
}
