import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, BookOpen, Check, Trash2, Pencil } from "lucide-react";
import BookCover from "../components/BookCover";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import StarRating from "../components/StarRating";
import ShareSheet from "../components/ShareSheet";
import BookEditSheet from "../components/BookEditSheet";
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
  const [editingBook, setEditingBook] = useState(false);

  // Ratings tab state
  // reviewingAsId: which member the current user is reviewing as (for parents reviewing as child)
  const [reviewingAsId, setReviewingAsId] = useState<string | null>(null);
  const [draftReaderRating, setDraftReaderRating] = useState<number | null>(null);
  const [draftReview, setDraftReview] = useState<string>("");
  const [savingReview, setSavingReview] = useState(false);
  const [deletingReviewFor, setDeletingReviewFor] = useState<string | null>(null);
  const draftInitialized = useRef<string | null>(null); // tracks which memberId was used to init

  useEffect(() => {
    if (!id) return;
    loadBook();
  }, [id]);

  async function loadBook() {
    setLoading(true);
    setData(null);
    try {
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
    } catch (err) {
      console.error("Failed to load book:", err);
      toast.error("Failed to load book details");
    } finally {
      setLoading(false);
    }
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

  function canEdit(m: FamilyMember) {
    if (!member) return false;
    if (m.id === member.id) return true;
    if (member.is_child) return false;
    return m.is_child;
  }

  // Returns true if current user can edit/delete the review for targetMemberId
  function canEditReview(targetMemberId: string): boolean {
    if (!member) return false;
    if (targetMemberId === member.id) return true;
    if (member.is_child) return false;
    // Parents can edit/delete reviews of children
    const target = allMembers.find((m) => m.id === targetMemberId);
    return target?.is_child ?? false;
  }

  // Children a parent can review as (children only, not other adults)
  const reviewableAsMembers: FamilyMember[] = member && !member.is_child
    ? allMembers.filter((m) => m.is_child)
    : [];

  // The effective reviewer (either the switcher selection or ourselves)
  const effectiveReviewerId = reviewingAsId ?? member?.id ?? "";

  // Initialize draft when effective reviewer changes or ratings load
  useEffect(() => {
    if (!data || !effectiveReviewerId) return;
    if (draftInitialized.current === effectiveReviewerId) return;
    draftInitialized.current = effectiveReviewerId;
    const r = data.ratingByMember[effectiveReviewerId];
    setDraftReaderRating(r?.reader_rating ?? null);
    setDraftReview(r?.review ?? "");
  }, [effectiveReviewerId, data]);

  // When parent switches reviewer, re-init draft
  function switchReviewingAs(targetId: string | null) {
    draftInitialized.current = null; // force re-init
    setReviewingAsId(targetId);
  }

  // Auto-save parent_rating immediately for the current user (not the "reviewing as" person)
  async function saveParentRating(value: number | null) {
    if (!id || !member) return;
    const existing = data?.ratingByMember[member.id];
    if (existing) {
      await supabase.from("ratings").update({ parent_rating: value, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("ratings").insert({ book_id: id, member_id: member.id, parent_rating: value });
    }
    await loadBook();
  }

  async function saveReview() {
    if (!id || !effectiveReviewerId) return;
    setSavingReview(true);
    try {
      const existing = data?.ratingByMember[effectiveReviewerId];
      if (existing) {
        await supabase.from("ratings").update({
          reader_rating: draftReaderRating,
          review: draftReview.trim() || null,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("ratings").insert({
          book_id: id,
          member_id: effectiveReviewerId,
          reader_rating: draftReaderRating,
          review: draftReview.trim() || null,
        });
      }
      toast.success("Review saved!");
      draftInitialized.current = null; // force re-sync with fresh data
      await loadBook();
    } catch {
      toast.error("Failed to save review");
    } finally {
      setSavingReview(false);
    }
  }

  async function deleteReview(targetMemberId: string) {
    if (!id) return;
    setDeletingReviewFor(targetMemberId);
    try {
      const existing = data?.ratingByMember[targetMemberId];
      if (!existing) return;
      // Wipe reader_rating and review but keep parent_rating if it exists
      await supabase.from("ratings").update({
        reader_rating: null,
        review: null,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      toast.success("Review deleted");
      if (targetMemberId === effectiveReviewerId) {
        draftInitialized.current = null;
      }
      await loadBook();
    } catch {
      toast.error("Failed to delete review");
    } finally {
      setDeletingReviewFor(null);
    }
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
  const myRating = ratingByMember[member?.id ?? ""];

  // Has the reviewer posted a review (rating or text)
  const effectiveReview = ratingByMember[effectiveReviewerId];
  const reviewerIsMe = effectiveReviewerId === member?.id;
  const hasPostedReview = !!(effectiveReview?.reader_rating || effectiveReview?.review);
  const draftChanged =
    draftReaderRating !== (effectiveReview?.reader_rating ?? null) ||
    draftReview.trim() !== (effectiveReview?.review ?? "").trim();

  // Other members with posted reviews (not the "reviewing as" target — they're handled in the draft section)
  const othersWithReviews = allMembers.filter(
    (m) => m.id !== member?.id && m.id !== effectiveReviewerId && (ratingByMember[m.id]?.reader_rating || ratingByMember[m.id]?.review)
  );

  return (
    <div className="max-w-2xl mx-auto pb-24 lg:pb-10">
      {/* Hero */}
      <div className="relative">
        {book.cover_url || book.isbn ? (
          <div className="h-48 overflow-hidden">
            <BookCover
              src={book.cover_url}
              isbn={book.isbn}
              title={book.title}
              className="w-full h-full object-cover"
              fallbackClassName="h-32"
            />
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
        {/* Edit button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setEditingBook(true)}
            className="w-9 h-9 rounded-xl bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-card transition-colors shadow-sm"
            title="Edit book"
          >
            <Pencil size={15} />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-4 relative">
        <div className="flex gap-4 mb-5">
          {(book.cover_url || book.isbn) && (
            <div className="w-24 flex-shrink-0 -mt-12 rounded-xl overflow-hidden border-2 border-card shadow-lg bg-secondary">
              <BookCover
                src={book.cover_url}
                isbn={book.isbn}
                title={book.title}
                className="w-full aspect-[2/3] object-cover"
                fallbackClassName="w-full aspect-[2/3]"
                iconSize={20}
              />
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
              {tab === "progress" ? "📖 Progress" : "⭐ Reviews"}
            </button>
          ))}
        </div>

        {activeTab === "progress" && (
          <div className="space-y-3">
            {allMembers.map((m: FamilyMember) => {
              const prog = progressByMember[m.id];
              const isFinished = prog?.status === "finished";
              const pct = book.page_count && prog
                ? (isFinished ? 100 : Math.min(99, Math.round((prog.current_page / book.page_count) * 100)))
                : null;
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
                    {pct !== null && !isFinished && (
                      <span className="text-sm font-bold" style={{ color: m.color }}>{pct}%</span>
                    )}
                    {isFinished && <Check size={16} className="text-primary" />}
                  </div>

                  {pct !== null && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isFinished ? "var(--primary)" : m.color,
                        }}
                      />
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
            {/* Draft review section */}
            {member && (
              <div className="bg-card border border-border rounded-2xl p-4">

                {/* "Reviewing as" header — shows reviewer switcher for parents */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">
                      {allMembers.find((m) => m.id === effectiveReviewerId)?.avatar_emoji ?? member.avatar_emoji}
                    </span>
                    <div>
                      <p className="font-semibold text-sm">
                        {reviewingAsId
                          ? allMembers.find((m) => m.id === reviewingAsId)?.nickname
                          : member.nickname}
                        {!reviewingAsId && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold ml-1">you</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {hasPostedReview ? "Edit review" : "Write a review"}
                      </p>
                    </div>
                  </div>

                  {/* Reviewer switcher — parents only */}
                  {reviewableAsMembers.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Reviewing as</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => switchReviewingAs(null)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors border ${!reviewingAsId ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-transparent text-muted-foreground hover:border-border"}`}
                        >
                          {member.avatar_emoji}
                        </button>
                        {reviewableAsMembers.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => switchReviewingAs(child.id)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors border ${reviewingAsId === child.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-transparent text-muted-foreground hover:border-border"}`}
                            title={child.nickname}
                          >
                            {child.avatar_emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Draft reader rating */}
                <div className="space-y-3">
                  <StarRating
                    label={reviewingAsId
                      ? `${allMembers.find((m) => m.id === reviewingAsId)?.nickname}'s rating`
                      : "Your rating"}
                    value={draftReaderRating}
                    onChange={setDraftReaderRating}
                    size="lg"
                  />

                  {/* Draft review text */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Review (optional)</label>
                    <textarea
                      value={draftReview}
                      onChange={(e) => setDraftReview(e.target.value)}
                      placeholder="Write a short review..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>

                  {/* Post / Update button */}
                  <div className="flex gap-2">
                    <button
                      onClick={saveReview}
                      disabled={savingReview || (!draftReaderRating && !draftReview.trim())}
                      className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      {savingReview ? "Saving…" : hasPostedReview ? (draftChanged ? "Update review" : "Saved ✓") : "Post review"}
                    </button>

                    {/* Delete button — only show when a review exists and user can delete it */}
                    {hasPostedReview && canEditReview(effectiveReviewerId) && (
                      <button
                        onClick={() => deleteReview(effectiveReviewerId)}
                        disabled={deletingReviewFor === effectiveReviewerId}
                        className="px-3 py-2.5 rounded-xl bg-destructive/10 text-destructive font-semibold text-sm border border-destructive/20 hover:bg-destructive/20 transition-colors disabled:opacity-50"
                        title="Delete this review"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Separator before parent's own recommendation (only when reviewing as a child) */}
                {reviewingAsId && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Your recommendation (private)
                    </p>
                    <StarRating
                      label="Parent rating"
                      value={myRating?.parent_rating ?? null}
                      onChange={saveParentRating}
                      size="md"
                    />
                  </div>
                )}

                {/* Parent recommendation when reviewing as self */}
                {!reviewingAsId && !member.is_child && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <StarRating
                      label="Parent recommendation (private)"
                      value={myRating?.parent_rating ?? null}
                      onChange={saveParentRating}
                      size="md"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Other members' posted reviews */}
            {othersWithReviews.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">Family reviews</h3>
                <div className="space-y-3">
                  {othersWithReviews.map((m) => {
                    const r = ratingByMember[m.id];
                    const canDelete = canEditReview(m.id);
                    return (
                      <div key={m.id} className="bg-card border border-border rounded-2xl p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{m.avatar_emoji}</span>
                            <div>
                              <p className="font-semibold text-sm">{m.nickname}</p>
                              {r.reader_rating && <StarRating value={r.reader_rating} readonly size="sm" />}
                            </div>
                          </div>
                          {canDelete && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => {
                                  // Load this member's review into draft for editing
                                  switchReviewingAs(m.id === member?.id ? null : m.id);
                                  setActiveTab("ratings");
                                }}
                                className="px-2 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors flex items-center gap-1"
                                title="Edit this review"
                              >
                                <Pencil size={11} /> Edit
                              </button>
                              <button
                                onClick={() => deleteReview(m.id)}
                                disabled={deletingReviewFor === m.id}
                                className="px-2 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-50"
                                title="Delete this review"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                        {r.review && <p className="text-sm text-muted-foreground italic">"{r.review}"</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!hasPostedReview && othersWithReviews.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No reviews yet. Be the first to write one!
              </p>
            )}
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

      {/* Book edit sheet */}
      <BookEditSheet
        book={editingBook ? book : null}
        onClose={() => setEditingBook(false)}
        onSaved={(updated) => {
          setData((prev) => prev ? { ...prev, book: updated } : null);
          setEditingBook(false);
        }}
      />
    </div>
  );
}
