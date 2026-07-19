import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Users, BookOpen, BarChart2, FileText,
  Globe, Lock, Copy, Check, Plus, X, Loader2,
  Trash2, Settings, ChevronDown, Download, Calendar,
  Crown, BookMarked,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import BookCover from "../components/BookCover";
import { fetchBookByIsbn } from "../lib/supabase";
import type {
  Club, ClubMember, ClubBook, ClubReadingProgress, ClubRole, FamilyMember,
} from "../lib/types";
import { STATUS_LABELS } from "../lib/types";
import { toast } from "sonner";
import { cn } from "../app/components/ui/utils";

type Tab = "books" | "members" | "progress" | "reports";

interface MemberReport {
  member_id: string;
  nickname: string;
  avatar_emoji: string;
  age_group: string | null;
  role: string;
  club_role: ClubRole;
  books_finished: number;
  books_reading: number;
  books_want: number;
  pages_read: number;
}

interface BookReport {
  book_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  cover_url: string | null;
  page_count: number | null;
  finished_count: number;
  reading_count: number;
  want_count: number;
  avg_page: number | null;
}

interface ProgressEntry extends ClubReadingProgress {
  member?: FamilyMember;
  book?: ClubBook;
}

// Enriched club member row after join
interface ClubMemberRow {
  id: string;
  club_id: string;
  family_member_id: string;
  role: ClubRole;
  joined_at: string;
  family_members: FamilyMember | null; // null when cross-family RLS blocks it
}

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { member, allMembers } = useAuth();
  const navigate = useNavigate();

  const [club, setClub] = useState<Club | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMemberRow[]>([]);
  const [books, setBooks] = useState<ClubBook[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("books");
  const [copied, setCopied] = useState(false);
  const [myRole, setMyRole] = useState<ClubRole | null>(null);
  const myMemberIds = allMembers.map((m) => m.id);

  // Add book
  const [showAddBook, setShowAddBook] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [bookPreview, setBookPreview] = useState<Partial<ClubBook> | null>(null);
  const [addingBook, setAddingBook] = useState(false);

  // Group Read
  const [showGroupReadSheet, setShowGroupReadSheet] = useState(false);
  const [groupReadBookId, setGroupReadBookId] = useState<string | null>(null);
  const [groupReadDate, setGroupReadDate] = useState("");
  const [savingGroupRead, setSavingGroupRead] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Reports
  const [reportFilter, setReportFilter] = useState<string>("all");
  const [memberReports, setMemberReports] = useState<MemberReport[]>([]);
  const [bookReports, setBookReports] = useState<BookReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Join / add members
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  const [joiningAs, setJoiningAs] = useState<string[]>([]);
  const [joining, setJoining] = useState(false);

  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";

  const load = useCallback(async () => {
    if (!id || !member) return;
    setLoading(true);
    try {
      // Club
      const { data: clubData } = await supabase
        .from("clubs")
        .select("*")
        .eq("id", id)
        .single();
      if (!clubData) { navigate("/clubs"); return; }
      setClub(clubData);
      setEditName(clubData.name);
      setEditDesc(clubData.description || "");
      setEditPublic(clubData.is_public);

      // Club members + family_member profiles (cross-family visible after SQL patch)
      const { data: cm } = await supabase
        .from("club_members")
        .select("*, family_members(*)")
        .eq("club_id", id)
        .order("joined_at");
      const rows = (cm || []) as ClubMemberRow[];
      setClubMembers(rows);

      // My role
      const myEntry = rows.find((r) => myMemberIds.includes(r.family_member_id));
      setMyRole(myEntry ? myEntry.role : null);

      // Books
      const { data: bks } = await supabase
        .from("club_books")
        .select("*")
        .eq("club_id", id)
        .order("added_at", { ascending: false });
      setBooks(bks || []);

      // Progress
      if (bks && bks.length) {
        const bookIds = bks.map((b: ClubBook) => b.id);
        const { data: prg } = await supabase
          .from("club_reading_progress")
          .select("*")
          .in("club_book_id", bookIds);
        const entries: ProgressEntry[] = (prg || []).map((p: ClubReadingProgress) => ({
          ...p,
          member: rows.find((r) => r.family_member_id === p.member_id)?.family_members ?? undefined,
          book: bks.find((b: ClubBook) => b.id === p.club_book_id),
        }));
        setProgress(entries);
      }

      // Mark notifications seen
      if (myMemberIds.length) {
        await supabase
          .from("club_notifications")
          .update({ seen: true })
          .in("member_id", myMemberIds)
          .eq("club_id", id);
      }
    } finally {
      setLoading(false);
    }
  }, [id, member]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeTab === "reports" && id) loadReports();
  }, [activeTab, id]);

  async function loadReports() {
    if (!id) return;
    setReportsLoading(true);
    const [{ data: mr }, { data: br }] = await Promise.all([
      supabase.rpc("club_member_report", { p_club_id: id }),
      supabase.rpc("club_books_report", { p_club_id: id }),
    ]);
    setMemberReports(mr || []);
    setBookReports(br || []);
    setReportsLoading(false);
  }

  async function handleCopyInvite() {
    if (!club) return;
    const link = `${APP_URL}/clubs/invite/${club.invite_token}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Invite link copied!");
  }

  async function handleLookupBook() {
    if (!bookSearch.trim()) return;
    setLookingUp(true);
    setBookPreview(null);
    try {
      const isbnLike = bookSearch.replace(/[\s-]/g, "");
      const data = await fetchBookByIsbn(isbnLike);
      if (data) {
        setBookPreview({
          title: data.title,
          author: data.author || null,
          isbn: isbnLike,
          cover_url: data.cover_url || null,
          page_count: data.page_count || null,
        });
      } else {
        setBookPreview({ title: bookSearch.trim(), author: null, isbn: null, cover_url: null, page_count: null });
      }
    } finally {
      setLookingUp(false);
    }
  }

  async function handleAddBook() {
    if (!bookPreview || !club || !member) return;
    setAddingBook(true);
    try {
      const { data: inserted, error } = await supabase
        .from("club_books")
        .insert({
          club_id: club.id,
          title: bookPreview.title,
          author: bookPreview.author || null,
          isbn: bookPreview.isbn || null,
          cover_url: bookPreview.cover_url || null,
          page_count: bookPreview.page_count || null,
          added_by: member.id,
        })
        .select()
        .single();
      if (error) throw error;

      const otherMemberIds = clubMembers
        .filter((cm) => !myMemberIds.includes(cm.family_member_id))
        .map((cm) => cm.family_member_id);
      if (otherMemberIds.length) {
        await supabase.from("club_notifications").insert(
          otherMemberIds.map((mid) => ({
            club_id: club.id,
            member_id: mid,
            type: "new_book",
            title: `📚 ${bookPreview.title} added to ${club.name}`,
          })),
        );
      }

      setBooks((prev) => [inserted, ...prev]);
      setShowAddBook(false);
      setBookSearch("");
      setBookPreview(null);
      toast.success(`"${bookPreview.title}" added to the club!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add book");
    } finally {
      setAddingBook(false);
    }
  }

  async function handleStartGroupRead(e: React.FormEvent) {
    e.preventDefault();
    if (!groupReadBookId || !club) return;
    setSavingGroupRead(true);
    try {
      // Clear any existing group read first
      await supabase
        .from("club_books")
        .update({ is_current_read: false })
        .eq("club_id", club.id);

      // Set the new one
      const { error } = await supabase
        .from("club_books")
        .update({
          is_current_read: true,
          read_target_date: groupReadDate || null,
        })
        .eq("id", groupReadBookId);
      if (error) throw error;

      setBooks((prev) =>
        prev.map((b) => ({
          ...b,
          is_current_read: b.id === groupReadBookId,
          read_target_date: b.id === groupReadBookId ? groupReadDate || null : b.read_target_date,
        })),
      );

      // Notify members
      const otherIds = clubMembers
        .filter((cm) => !myMemberIds.includes(cm.family_member_id))
        .map((cm) => cm.family_member_id);
      const book = books.find((b) => b.id === groupReadBookId);
      if (otherIds.length && book) {
        await supabase.from("club_notifications").insert(
          otherIds.map((mid) => ({
            club_id: club.id,
            member_id: mid,
            type: "new_book",
            title: `📖 Group Read started: ${book.title}`,
          })),
        );
      }

      setShowGroupReadSheet(false);
      setGroupReadBookId(null);
      setGroupReadDate("");
      toast.success("Group Read started!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start group read");
    } finally {
      setSavingGroupRead(false);
    }
  }

  async function handleEndGroupRead(bookId: string) {
    const { error } = await supabase
      .from("club_books")
      .update({ is_current_read: false, read_target_date: null })
      .eq("id", bookId);
    if (error) { toast.error("Failed to end group read"); return; }
    setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, is_current_read: false, read_target_date: null } : b));
    toast.success("Group Read ended");
  }

  async function handleUpdateProgress(
    bookId: string,
    newStatus: "want_to_read" | "reading" | "finished",
    memberId: string,
    currentPage?: number,
  ) {
    const book = books.find((b) => b.id === bookId);
    const now = new Date().toISOString();
    const updates: Partial<ClubReadingProgress> = {
      status: newStatus,
      updated_at: now,
      current_page: currentPage ?? 0,
      started_at: newStatus !== "want_to_read" ? now : null,
      finished_at: newStatus === "finished" ? now : null,
    };

    const { error } = await supabase
      .from("club_reading_progress")
      .upsert({ club_book_id: bookId, member_id: memberId, ...updates }, { onConflict: "club_book_id,member_id" });

    if (error) { toast.error("Failed to update progress"); return; }

    // Sync to family library
    if (member && book) {
      try {
        const fm = allMembers.find((m) => m.id === memberId);
        if (fm) {
          let familyBook = null;
          if (book.isbn) {
            const { data } = await supabase.from("books").select("id")
              .eq("family_id", fm.family_id).eq("isbn", book.isbn).maybeSingle();
            familyBook = data;
          }
          if (!familyBook) {
            const { data } = await supabase.from("books").select("id")
              .eq("family_id", fm.family_id).ilike("title", book.title).maybeSingle();
            familyBook = data;
          }
          if (!familyBook) {
            const { data } = await supabase.from("books").insert({
              family_id: fm.family_id, title: book.title, author: book.author,
              isbn: book.isbn, cover_url: book.cover_url, page_count: book.page_count,
              added_by: memberId,
            }).select("id").single();
            familyBook = data;
          }
          if (familyBook) {
            await supabase.from("reading_progress")
              .upsert({ book_id: familyBook.id, member_id: memberId, ...updates }, { onConflict: "book_id,member_id" });
          }
        }
      } catch { /* sync failure non-critical */ }
    }

    setProgress((prev) => {
      const existing = prev.findIndex((p) => p.club_book_id === bookId && p.member_id === memberId);
      const entry: ProgressEntry = {
        ...(prev[existing] || {}),
        id: prev[existing]?.id || "",
        club_book_id: bookId,
        member_id: memberId,
        ...updates,
        status: newStatus,
        current_page: currentPage ?? 0,
        started_at: updates.started_at ?? null,
        finished_at: updates.finished_at ?? null,
        book: books.find((b) => b.id === bookId),
        member: allMembers.find((m) => m.id === memberId),
      };
      if (existing >= 0) { const next = [...prev]; next[existing] = entry; return next; }
      return [...prev, entry];
    });
  }

  async function handleJoinClub() {
    if (!club || !joiningAs.length) return;
    setJoining(true);
    try {
      const rows = joiningAs.map((fmId) => ({
        club_id: club.id,
        family_member_id: fmId,
        role: "member" as ClubRole,
      }));
      const { error } = await supabase.from("club_members").insert(rows);
      if (error && error.code !== "23505") throw error;

      const existingIds = clubMembers.map((cm) => cm.family_member_id);
      if (existingIds.length) {
        const names = joiningAs.map((mid) => allMembers.find((m) => m.id === mid)?.nickname).filter(Boolean).join(", ");
        await supabase.from("club_notifications").insert(
          existingIds.map((mid) => ({
            club_id: club.id, member_id: mid, type: "new_member",
            title: `👋 ${names} joined ${club.name}`,
          })),
        );
      }

      toast.success("Joined the club!");
      setShowJoinSheet(false);
      setJoiningAs([]);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!club || !editName.trim()) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from("clubs")
      .update({ name: editName.trim(), description: editDesc.trim() || null, is_public: editPublic })
      .eq("id", club.id);
    if (error) { toast.error("Failed to save"); setSavingSettings(false); return; }
    setClub((c) => c ? { ...c, name: editName, description: editDesc || null, is_public: editPublic } : c);
    setShowSettings(false);
    setSavingSettings(false);
    toast.success("Club settings saved");
  }

  async function handleRemoveMember(cmId: string) {
    const { error } = await supabase.from("club_members").delete().eq("id", cmId);
    if (error) { toast.error("Failed to remove member"); return; }
    setClubMembers((prev) => prev.filter((cm) => cm.id !== cmId));
  }

  async function handleLeaveClub() {
    if (!club) return;
    const myEntries = clubMembers.filter((cm) => myMemberIds.includes(cm.family_member_id));
    for (const e of myEntries) await supabase.from("club_members").delete().eq("id", e.id);
    toast.success(`Left ${club.name}`);
    navigate("/clubs");
  }

  function exportCSV() {
    const filtered = reportFilter === "all"
      ? memberReports
      : memberReports.filter((r) => r.member_id === reportFilter);
    const rows = [
      ["Member", "Role", "Club Role", "Age Group", "Books Finished", "Books Reading", "Want to Read", "Pages Read"],
      ...filtered.map((r) => [r.nickname, r.role, r.club_role, r.age_group || "—", r.books_finished, r.books_reading, r.books_want, r.pages_read]),
    ];
    const csv = rows.map((r) => r.map(String).map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${club?.name ?? "club"}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Helper: resolve display name + avatar for a club member row
  function resolveProfile(cm: ClubMemberRow): { nickname: string; avatar: string; familyRole: string } {
    if (cm.family_members) {
      return {
        nickname: cm.family_members.nickname,
        avatar: cm.family_members.avatar_emoji,
        familyRole: cm.family_members.role,
      };
    }
    // Cross-family member not yet visible (run clubs_schema_patch.sql to fix)
    const local = allMembers.find((m) => m.id === cm.family_member_id);
    if (local) return { nickname: local.nickname, avatar: local.avatar_emoji, familyRole: local.role };
    return { nickname: "Club member", avatar: "👤", familyRole: "" };
  }

  const amIMember = myRole !== null;
  const notInClub = !amIMember;
  const membersNotInClub = allMembers.filter((m) => !clubMembers.find((cm) => cm.family_member_id === m.id));
  const currentRead = books.find((b) => b.is_current_read);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={28} className="text-primary animate-spin" />
      </div>
    );
  }

  if (!club) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pb-28 lg:pb-10">

        {/* Back */}
        <div className="pt-4 lg:pt-8 mb-4">
          <button
            onClick={() => navigate("/clubs")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            All Clubs
          </button>
        </div>

        {/* Club header */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-4">
          <div className="flex items-start gap-4">
            <span className="text-5xl">{club.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h1 className="font-display text-xl font-bold text-foreground leading-tight">{club.name}</h1>
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                  >
                    <Settings size={16} />
                  </button>
                )}
              </div>
              {club.description && <p className="text-sm text-muted-foreground mt-1">{club.description}</p>}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {club.is_public ? <Globe size={11} /> : <Lock size={11} />}
                  {club.is_public ? "Public" : "Private"}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users size={11} />
                  {clubMembers.length} member{clubMembers.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BookOpen size={11} />
                  {books.length} book{books.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
            {amIMember && (
              <button
                onClick={handleCopyInvite}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-muted hover:bg-secondary transition-colors"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy invite link"}
              </button>
            )}
            {notInClub && (
              <button
                onClick={() => setShowJoinSheet(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus size={12} />
                Join Club
              </button>
            )}
            {amIMember && myRole !== "owner" && (
              <button
                onClick={handleLeaveClub}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-muted hover:bg-red-100 hover:text-red-600 transition-colors ml-auto"
              >
                Leave club
              </button>
            )}
          </div>
        </div>

        {/* ── Group Read banner ── */}
        {currentRead && (
          <div className="bg-primary/8 border border-primary/20 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <BookMarked size={20} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-primary mb-0.5">Currently reading together</p>
              <p className="font-semibold text-sm text-foreground line-clamp-1">{currentRead.title}</p>
              {currentRead.read_target_date && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  <Calendar size={10} className="inline mr-1" />
                  Target: {new Date(currentRead.read_target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
            {isOwnerOrAdmin && (
              <button
                onClick={() => handleEndGroupRead(currentRead.id)}
                className="text-xs text-muted-foreground hover:text-red-500 transition-colors shrink-0 px-2 py-1 rounded-lg hover:bg-red-50"
              >
                End
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5">
          {(["books", "members", "progress", "reports"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "flex-1 py-2 text-xs font-semibold rounded-lg transition-all capitalize",
                activeTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "books" && <BookOpen size={12} className="inline mr-1 -mt-0.5" />}
              {t === "members" && <Users size={12} className="inline mr-1 -mt-0.5" />}
              {t === "progress" && <BarChart2 size={12} className="inline mr-1 -mt-0.5" />}
              {t === "reports" && <FileText size={12} className="inline mr-1 -mt-0.5" />}
              {t}
            </button>
          ))}
        </div>

        {/* ── Tab: Books ── */}
        {activeTab === "books" && (
          <div>
            {amIMember && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setShowAddBook(true)}
                  className="flex-1 flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus size={16} />
                  Add a book
                </button>
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => setShowGroupReadSheet(true)}
                    className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-primary/40 rounded-2xl text-sm font-semibold text-primary hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <BookMarked size={16} />
                    Group Read
                  </button>
                )}
              </div>
            )}
            {books.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3">📚</span>
                <p className="font-semibold text-foreground">No books yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add the first book to get the club reading!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {books.map((book) => (
                  <ClubBookRow
                    key={book.id}
                    book={book}
                    progress={progress.filter((p) => p.club_book_id === book.id)}
                    myMemberIds={myMemberIds}
                    allMembers={allMembers}
                    clubMembers={clubMembers}
                    onUpdateProgress={handleUpdateProgress}
                    isManager={isOwnerOrAdmin}
                    onRemove={async () => {
                      await supabase.from("club_books").delete().eq("id", book.id);
                      setBooks((prev) => prev.filter((b) => b.id !== book.id));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Members ── */}
        {activeTab === "members" && (
          <div>
            {(notInClub || (amIMember && membersNotInClub.length > 0)) && (
              <button
                onClick={() => setShowJoinSheet(true)}
                className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors mb-4"
              >
                <Plus size={16} />
                {notInClub ? "Add yourself or family members" : "Add more family members"}
              </button>
            )}
            {clubMembers.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3">👥</span>
                <p className="font-semibold text-foreground">No members yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {clubMembers.map((cm) => {
                  const { nickname, avatar, familyRole } = resolveProfile(cm);
                  const isMe = myMemberIds.includes(cm.family_member_id);
                  const isOwnerRow = cm.role === "owner";
                  return (
                    <div key={cm.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                      <span className="text-2xl">{avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{nickname}</span>
                          {isOwnerRow && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              <Crown size={9} />
                              Owner
                            </span>
                          )}
                          {cm.role === "admin" && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Admin</span>
                          )}
                          {isMe && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">You</span>}
                        </div>
                        {familyRole && <p className="text-xs text-muted-foreground">{familyRole}</p>}
                      </div>
                      {isOwnerOrAdmin && !isMe && !isOwnerRow && (
                        <button
                          onClick={() => handleRemoveMember(cm.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Progress ── */}
        {activeTab === "progress" && (
          <div>
            {books.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3">📊</span>
                <p className="font-semibold text-foreground">No books to track yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {books.map((book) => {
                  const bookProgress = progress.filter((p) => p.club_book_id === book.id);
                  const finishedCount = bookProgress.filter((p) => p.status === "finished").length;
                  const memberCount = clubMembers.length;
                  return (
                    <div key={book.id} className="bg-card border border-border rounded-2xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <BookCover
                          src={book.cover_url || undefined}
                          isbn={book.isbn || undefined}
                          title={book.title}
                          className="w-10 h-14 rounded-md object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-sm leading-tight line-clamp-1">{book.title}</p>
                            {book.is_current_read && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                                Group Read
                              </span>
                            )}
                          </div>
                          {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
                          <div className="mt-1.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
                              <span>{finishedCount} of {memberCount} finished</span>
                              <span>{memberCount ? Math.round((finishedCount / memberCount) * 100) : 0}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${memberCount ? (finishedCount / memberCount) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {clubMembers.map((cm) => {
                          const { nickname, avatar } = resolveProfile(cm);
                          const prg = bookProgress.find((p) => p.member_id === cm.family_member_id);
                          const pct = book.page_count && prg?.current_page
                            ? Math.min(100, Math.round((prg.current_page / book.page_count) * 100))
                            : 0;
                          return (
                            <div key={cm.id} className="flex items-center gap-2">
                              <span className="text-sm">{avatar}</span>
                              <span className="text-xs text-muted-foreground w-20 truncate">{nickname}</span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all", prg?.status === "finished" ? "bg-primary" : "bg-amber-400")}
                                  style={{ width: `${prg?.status === "finished" ? 100 : pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground w-20 text-right shrink-0">
                                {prg ? STATUS_LABELS[prg.status] : "Not started"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Reports ── */}
        {activeTab === "reports" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="relative">
                <select
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value)}
                  className="appearance-none text-xs font-semibold bg-card border border-border rounded-xl pl-3 pr-8 py-2 outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All members</option>
                  {clubMembers.map((cm) => {
                    const { nickname } = resolveProfile(cm);
                    return (
                      <option key={cm.family_member_id} value={cm.family_member_id}>{nickname}</option>
                    );
                  })}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <Download size={13} />
                Export CSV
              </button>
            </div>

            {reportsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="text-primary animate-spin" />
              </div>
            ) : (
              <>
                <section className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Reading Progress</h3>
                  <div className="space-y-2">
                    {(reportFilter === "all" ? memberReports : memberReports.filter((r) => r.member_id === reportFilter)).map((r) => (
                      <div key={r.member_id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                        <span className="text-2xl">{r.avatar_emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{r.nickname}</p>
                          <p className="text-xs text-muted-foreground">{r.role} · {r.age_group || "—"}</p>
                        </div>
                        <div className="flex gap-4 text-center shrink-0">
                          <div>
                            <p className="font-bold text-sm text-primary">{r.books_finished}</p>
                            <p className="text-[10px] text-muted-foreground">Done</p>
                          </div>
                          <div>
                            <p className="font-bold text-sm text-amber-600">{r.books_reading}</p>
                            <p className="text-[10px] text-muted-foreground">Reading</p>
                          </div>
                          <div>
                            <p className="font-bold text-sm text-foreground">{r.pages_read}</p>
                            <p className="text-[10px] text-muted-foreground">Pages</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {reportFilter === "all" && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Books in Club</h3>
                    <div className="space-y-2">
                      {bookReports.map((r) => (
                        <div key={r.book_id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                          <BookCover src={r.cover_url || undefined} isbn={r.isbn || undefined} title={r.title} className="w-8 h-12 rounded object-cover shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm line-clamp-1">{r.title}</p>
                            {r.author && <p className="text-xs text-muted-foreground">{r.author}</p>}
                          </div>
                          <div className="flex gap-3 text-center shrink-0">
                            <div>
                              <p className="font-bold text-sm text-primary">{r.finished_count}</p>
                              <p className="text-[10px] text-muted-foreground">Done</p>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-amber-600">{r.reading_count}</p>
                              <p className="text-[10px] text-muted-foreground">Reading</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Add Book Sheet ── */}
      {showAddBook && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowAddBook(false); setBookPreview(null); setBookSearch(""); }} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold">Add a Book</h2>
              <button onClick={() => { setShowAddBook(false); setBookPreview(null); setBookSearch(""); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookupBook()}
                placeholder="ISBN or book title..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleLookupBook}
                disabled={lookingUp || !bookSearch.trim()}
                className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5"
              >
                {lookingUp ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
              </button>
            </div>
            {bookPreview ? (
              <div className="bg-background border border-border rounded-xl p-3 flex gap-3 mb-4">
                <BookCover src={bookPreview.cover_url || undefined} isbn={bookPreview.isbn || undefined} title={bookPreview.title} className="w-12 h-16 rounded object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight">{bookPreview.title}</p>
                  {bookPreview.author && <p className="text-xs text-muted-foreground">{bookPreview.author}</p>}
                  {bookPreview.page_count && <p className="text-xs text-muted-foreground">{bookPreview.page_count} pages</p>}
                </div>
              </div>
            ) : (
              <div className="bg-muted rounded-xl p-3 mb-4">
                <p className="text-xs text-muted-foreground">Enter an ISBN or book title and press search. Metadata is looked up automatically.</p>
              </div>
            )}
            <button
              onClick={handleAddBook}
              disabled={addingBook || !bookPreview}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {addingBook ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Add to Club
            </button>
          </div>
        </div>
      )}

      {/* ── Group Read Sheet ── */}
      {showGroupReadSheet && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGroupReadSheet(false)} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl font-bold">Start a Group Read</h2>
              <button onClick={() => setShowGroupReadSheet(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Pick the book the whole club will read together. Everyone's progress will be highlighted and tracked collectively.
            </p>
            {books.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl block mb-3">📚</span>
                <p className="font-semibold text-foreground mb-1">No books in the club yet</p>
                <p className="text-sm text-muted-foreground mb-4">Add a book to the club first, then start a Group Read.</p>
                <button
                  type="button"
                  onClick={() => { setShowGroupReadSheet(false); setShowAddBook(true); }}
                  className="flex items-center gap-2 mx-auto px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Plus size={16} />
                  Add a book first
                </button>
              </div>
            ) : (
            <form onSubmit={handleStartGroupRead} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Select a book</label>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {books.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setGroupReadBookId(b.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                        groupReadBookId === b.id ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40",
                      )}
                    >
                      <BookCover src={b.cover_url || undefined} isbn={b.isbn || undefined} title={b.title} className="w-8 h-12 rounded object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm line-clamp-1">{b.title}</p>
                        {b.author && <p className="text-xs text-muted-foreground">{b.author}</p>}
                      </div>
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0", groupReadBookId === b.id ? "border-primary bg-primary" : "border-muted-foreground")}>
                        {groupReadBookId === b.id && <Check size={11} className="text-primary-foreground" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Target finish date <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={groupReadDate}
                  onChange={(e) => setGroupReadDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                type="submit"
                disabled={savingGroupRead || !groupReadBookId}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {savingGroupRead ? <Loader2 size={16} className="animate-spin" /> : <BookMarked size={16} />}
                Start Group Read
              </button>
            </form>
            )}
          </div>
        </div>
      )}

      {/* ── Join / Add Members Sheet ── */}
      {showJoinSheet && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowJoinSheet(false)} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl font-bold">Join Club</h2>
              <button onClick={() => setShowJoinSheet(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Select which family members will join <strong>{club.name}</strong>. Join as yourself, on behalf of your kids, or add any family members.
            </p>
            <div className="space-y-2 mb-5">
              {membersNotInClub.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">All family members are already in this club.</p>
              ) : (
                membersNotInClub.map((fm) => {
                  const selected = joiningAs.includes(fm.id);
                  return (
                    <button
                      key={fm.id}
                      onClick={() => setJoiningAs((prev) => selected ? prev.filter((x) => x !== fm.id) : [...prev, fm.id])}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                        selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40",
                      )}
                    >
                      <span className="text-2xl">{fm.avatar_emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{fm.nickname}</p>
                        <p className="text-xs text-muted-foreground">{fm.role}{fm.is_child ? " · child" : ""}</p>
                      </div>
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selected ? "border-primary bg-primary" : "border-muted-foreground")}>
                        {selected && <Check size={11} className="text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <button
              onClick={handleJoinClub}
              disabled={joining || joiningAs.length === 0}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {joining ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
              {joining ? "Joining..." : `Join as ${joiningAs.length} member${joiningAs.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Club Settings Sheet ── */}
      {showSettings && isOwnerOrAdmin && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold">Club Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Club name</label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Description</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{editPublic ? "Public" : "Private / invite-only"}</p>
                  <p className="text-xs text-muted-foreground">{editPublic ? "Anyone can find and join." : "Only invite link holders can join."}</p>
                </div>
                <button type="button" onClick={() => setEditPublic(!editPublic)}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${editPublic ? "bg-primary" : "bg-border"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editPublic ? "translate-x-6" : ""}`} />
                </button>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Invite link</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-foreground flex-1 truncate font-mono">{APP_URL}/clubs/invite/{club.invite_token}</p>
                  <button type="button" onClick={handleCopyInvite} className="text-muted-foreground hover:text-primary p-1">
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={savingSettings}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ClubBookRow ───────────────────────────────────────────────────────────────
function ClubBookRow({
  book, progress, myMemberIds, allMembers, clubMembers, onUpdateProgress, isManager, onRemove,
}: {
  book: ClubBook;
  progress: ProgressEntry[];
  myMemberIds: string[];
  allMembers: FamilyMember[];
  clubMembers: ClubMemberRow[];
  onUpdateProgress: (bookId: string, status: "want_to_read" | "reading" | "finished", memberId: string, page?: number) => void;
  isManager: boolean;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const finishedCount = progress.filter((p) => p.status === "finished").length;
  const totalMembers = clubMembers.length;
  const pct = totalMembers ? Math.round((finishedCount / totalMembers) * 100) : 0;

  return (
    <div className={cn("bg-card border rounded-2xl overflow-hidden transition-colors", book.is_current_read ? "border-primary/30" : "border-border")}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <BookCover src={book.cover_url || undefined} isbn={book.isbn || undefined} title={book.title} className="w-10 h-14 rounded object-cover shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <p className="font-semibold text-sm leading-tight line-clamp-1">{book.title}</p>
            {book.is_current_read && (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                Group Read
              </span>
            )}
          </div>
          {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{finishedCount}/{totalMembers} done</span>
          </div>
          {book.is_current_read && book.read_target_date && (
            <p className="text-[10px] text-primary mt-0.5">
              <Calendar size={9} className="inline mr-0.5" />
              Due {new Date(book.read_target_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isManager && (
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-2.5">
          {myMemberIds.map((myId) => {
            const fm = allMembers.find((m) => m.id === myId);
            if (!clubMembers.find((cm) => cm.family_member_id === myId)) return null;
            const prg = progress.find((p) => p.member_id === myId);
            return (
              <div key={myId}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">{fm?.avatar_emoji || "👤"}</span>
                  <span className="text-xs font-semibold">{fm?.nickname}</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(["want_to_read", "reading", "finished"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onUpdateProgress(book.id, s, myId)}
                      className={cn(
                        "text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors border",
                        prg?.status === s
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                {prg?.status === "reading" && book.page_count && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Page</span>
                    <input
                      type="number"
                      min={0}
                      max={book.page_count}
                      defaultValue={prg.current_page || 0}
                      onBlur={(e) => {
                        const page = Math.min(book.page_count!, Math.max(0, parseInt(e.target.value) || 0));
                        onUpdateProgress(book.id, "reading", myId, page);
                      }}
                      className="w-20 px-2 py-1 text-xs rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-[11px] text-muted-foreground">of {book.page_count}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
