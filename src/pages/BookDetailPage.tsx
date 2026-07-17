import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, BookOpen, Check, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import StarRating from "../components/StarRating";
import ShareSheet from "../components/ShareSheet";
import type { Book, ReadingProgress, Rating, FamilyMember } from "../lib/types";
import { STATUS_LABELS, type ReadingStatus } from "../lib/types";
import { toast } from "sonner";

interface BookWithFull {
  book: Book;
  progressByMember: Record<string, ReadingProgress>;
  ratingByMember: Record<string, Rating>;
}

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member, allMembers } = useAuth();

  const [data, setData] = useState<BookWithFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"progress" | "ratings">("progress");
  const [pageInputs, setPageInputs] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadBook();
  }, [id]);

  async function loadBook() {
    const [bookRes, progressRes, ratingsRes] = await Promise.all([
      supabase.from("books").select("*").eq("id", id).single(),
      supabase.from("reading_progress").select("*").eq("book_id", id),
      supabase.from("ratings").select("*").eq("book_id", id),
    ]);

    if (!bookRes.data) { navigate("/books"); return; }

    const progressByMember: Record<string, ReadingProgress> = {};
    (progressRes.data as ReadingProgress[] || []).forEach((p) => { progressByMember[p.member_id] = p; });

    const ratingByMember: Record<string, Rating> = {};
    (ratingsRes.data as Rating[] || []).forEach((r) => { ratingByMember[r.member_id] = r; });

    setData({ book: bookRes.data as Book, progressByMember, ratingByMember });

    const inputs: Record<string, string> = {};
    Object.entries(progressByMember).forEach(([mid, prog]) => { inputs[mid] = String(prog.current_page); });
    setPageInputs(inputs);

    setLoading(false);
  }

  async function updateProgress(memberId: string, status: ReadingStatus, page?: number) {
    if (!id) return;
    setUpdatingMember(memberId);
    const existing = data?.progressByMember[memberId];
    const updates: Partial<ReadingProgress> = {
      status,
      current_page: page ?? existing?.current_page ?? 0,
      updated_at: new Date().toISOString(),
      started_at: existing?.started_at ?? (status === "reading" ? new Date().toISOString() : null) ?? undefined,
      finished_at: status === "finished" ? new Date().toISOString() : null,
    };
    if (existing) {
      await supabase.from("reading_progress").update(updates).eq("id", existing.id);
    } else {
      await supabase.from("reading_progress").insert({ book_id: id, member_id: memberId, ...updates });
    }
    await loadBook();
    setUpdatingMember(null);
  }

  async function updatePageForMember(memberId: string) {
    const pg = parseInt(pageInputs[memberId] ?? "");
    if (isNaN(pg) || pg < 0) { toast.error("Invalid page number"); return; }
    const status = data?.progressByMember[memberId]?.status ?? "reading";
    const finalStatus = data?.book.page_count && pg >= data.book.page_count ? "finished" : status === "want_to_read" ? "reading" : status;
    await updateProgress(memberId, finalStatus as ReadingStatus, pg);
    toast.success("Progress updated!");
  }

  // Parents can edit progress for any child member; children only edit their own (unless child_mode off)
  function canEdit(m: FamilyMember) {
    if (!member) return false;
    if (m.id === member.id) return true;
    if (member.is_child) return false; // children can't edit others
    return m.is_child; // parents can update any child's progress
  }

  async function updateRating(memberId: string, field: "parent_rating" | "reader_rating" | "review", value: number | string | null) {
    if (!id) return;
    const existing = data?.ratingByMember[memberId];
    if (existing) {
      await supabase.from("ratings").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("ratings").insert({ book_id: id, member_id: memberId, [field]: value });
    }
    await loadBook();
  }

  async function deleteBook() {
    if (!id) return;
    await supabase.from("books").delete().eq("id", id);
    toast.success("Book removed from library");
    navigate("/books");
  }

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><span className="text-4xl animate-bounce">📚</span></div>;
  }

  const { book, progressByMember, ratingByMember } = data;
  const myProgress = progressByMember[member?.id ?? ""];
  const myRating = ratingByMember[member?.id ?? ""];

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Hero */}
      <div className="relative">
        {book.cover_url ? (
          <div className="h-48 overflow-hidden">
            <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
          </div>
        ) : (
          <div className="h-32 bg-secondary" />
        )}
        <div className="absolute top-4 left-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-card transition-colors shadow-sm">
            <ArrowLeft size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-4 relative">
        <div className="flex gap-4 mb-5">
          {book.cover_url && (
            <div className="w-24 flex-shrink-0 -mt-12 rounded-xl overflow-hidden border-2 border-card shadow-lg bg-secondary">
              <img src={book.cover_url} alt={book.title} className="w-full aspect-[2/3] object-cover" />
            </div>
          )}
          <div className={`flex-1 ${book.cover_url ? "pt-0" : "pt-2"}`}>
            <h1 className="font-display text-2xl font-bold leading-tight text-foreground">{book.title}</h1>
            {book.author && <p className="text-muted-foreground mt-1">{book.author}</p>}
            {book.page_count && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <BookOpen size={12} /> {book.page_count} pages
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <ShareSheet book={book} rating={myRating} />
        </div>

        {/* Tabs */}
        <div className="flex bg-muted rounded-xl p-1 mb-5">
          {(["progress", "ratings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {tab === "progress" ? "📖 Progress" : "⭐ Ratings"}
            </button>
          ))}
        </div>

        {activeTab === "progress" && (
          <div className="space-y-3">
            {allMembers.map((m: FamilyMember) => {
              const prog = progressByMember[m.id];
              const pct = book.page_count && prog ? Math.min(100, Math.round((prog.current_page / book.page_count) * 100)) : null;
              const isMe = m.id === member?.id;
              const editable = canEdit(m);
              const isUpdating = updatingMember === m.id;

              return (
                <div key={m.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{m.avatar_emoji}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {m.nickname}
                        {isMe && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold ml-1">you</span>}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{prog ? STATUS_LABELS[prog.status] : "Not started"}</p>
                    </div>
                    {pct !== null && prog?.status !== "finished" && (
                      <span className="text-sm font-bold" style={{ color: m.color }}>{pct}%</span>
                    )}
                    {prog?.status === "finished" && <Check size={16} className="text-primary" />}
                  </div>

                  {pct !== null && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                    </div>
                  )}

                  {editable && (
                    <>
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {(["want_to_read", "reading", "finished"] as ReadingStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateProgress(m.id, s)}
                            disabled={isUpdating}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${prog?.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-transparent text-muted-foreground hover:border-border"}`}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                      {prog?.status === "reading" && (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={pageInputs[m.id] ?? ""}
                            onChange={(e) => setPageInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            placeholder="Current page"
                            min="0"
                            max={book.page_count ?? undefined}
                            className="flex-1 px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
                          />
                          <button
                            onClick={() => updatePageForMember(m.id)}
                            disabled={isUpdating}
                            className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-60"
                          >
                            {isUpdating ? "..." : "Save"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "ratings" && (
          <div className="space-y-4">
            {/* My rating first */}
            {member && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{member.avatar_emoji}</span>
                  <div>
                    <p className="font-semibold text-sm">{member.nickname}</p>
                    <p className="text-[11px] text-muted-foreground">Your rating</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <StarRating
                    label="Reader rating"
                    value={myRating?.reader_rating ?? null}
                    onChange={(v) => updateRating(member.id, "reader_rating", v)}
                    size="lg"
                  />
                  <StarRating
                    label="Parent recommendation (optional, private)"
                    value={myRating?.parent_rating ?? null}
                    onChange={(v) => updateRating(member.id, "parent_rating", v)}
                    size="md"
                  />
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Review (optional)</label>
                    <textarea
                      defaultValue={myRating?.review ?? ""}
                      onBlur={(e) => updateRating(member.id, "review", e.target.value || null)}
                      placeholder="Write a short review..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Other members */}
            {allMembers
              .filter((m) => m.id !== member?.id)
              .map((m) => {
                const r = ratingByMember[m.id];
                if (!r?.reader_rating && !r?.review) return null;
                return (
                  <div key={m.id} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{m.avatar_emoji}</span>
                      <div>
                        <p className="font-semibold text-sm">{m.nickname}</p>
                        {r.reader_rating && <StarRating value={r.reader_rating} readonly size="sm" />}
                      </div>
                    </div>
                    {r.review && <p className="text-sm text-muted-foreground italic">"{r.review}"</p>}
                  </div>
                );
              })}
          </div>
        )}

        {/* Delete */}
        <div className="mt-8 pt-6 border-t border-border">
          {confirmDelete ? (
            <div className="flex gap-3">
              <button onClick={deleteBook} className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm">Yes, delete this book</button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-bold text-sm">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="w-full py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors">
              <Trash2 size={15} /> Remove from library
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
