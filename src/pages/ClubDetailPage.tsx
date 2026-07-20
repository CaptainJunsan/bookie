import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Users, BookOpen, BarChart2, FileText,
  Globe, Lock, Copy, Check, Plus, X, Loader2,
  Trash2, Settings, ChevronDown, Download, Calendar,
  Crown, BookMarked, MapPin, Layers, UserCheck, UserX,
  BookmarkPlus, MessageSquare, Pin, ShieldOff, AlertTriangle,
  ChevronRight, Send, CornerDownRight, HelpCircle,
  ShieldCheck, UserCog, MessageCircleOff, BookKey,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import BookCover from "../components/BookCover";
import type {
  Club, ClubMember, ClubBook, ClubReadingProgress, ClubRole, FamilyMember,
  ReadingGroup, ClubJoinRequest, ClubTopic, ClubTopicComment,
} from "../lib/types";
import { filterProfanity } from "../lib/profanityFilter";
import { STATUS_LABELS } from "../lib/types";
import { toast } from "sonner";
import { cn } from "../app/components/ui/utils";

type Tab = "books" | "groups" | "members" | "progress" | "topics" | "reports";

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

interface ClubMemberRow {
  id: string;
  club_id: string;
  family_member_id: string;
  role: ClubRole;
  joined_at: string;
  family_members: FamilyMember | null;
}

interface JoinRequestRow extends ClubJoinRequest {
  family_members: FamilyMember | null;
}

const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { member, allMembers } = useAuth();
  const navigate = useNavigate();

  const [club, setClub] = useState<Club | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMemberRow[]>([]);
  const [readingGroups, setReadingGroups] = useState<ReadingGroup[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [books, setBooks] = useState<ClubBook[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("books");
  const [copied, setCopied] = useState(false);
  const [myRole, setMyRole] = useState<ClubRole | null>(null);
  const myMemberIds = allMembers.map((m) => m.id);

  // Add book — live search
  const [showAddBook, setShowAddBook] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [bookResults, setBookResults] = useState<Array<{ key: string; title: string; author_name?: string[]; cover_i?: number; isbn?: string[]; number_of_pages_median?: number }>>([]);
  const [bookHasSearched, setBookHasSearched] = useState(false);
  const [bookPreview, setBookPreview] = useState<Partial<ClubBook> | null>(null);
  const [addingBook, setAddingBook] = useState(false);
  const [addBookGroupId, setAddBookGroupId] = useState<string | null>(null);
  const bookDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Group Read
  const [showGroupReadSheet, setShowGroupReadSheet] = useState(false);
  const [groupReadBookId, setGroupReadBookId] = useState<string | null>(null);
  const [groupReadDate, setGroupReadDate] = useState("");
  const [savingGroupRead, setSavingGroupRead] = useState(false);

  // Reading groups management
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupAgeMin, setNewGroupAgeMin] = useState("");
  const [newGroupAgeMax, setNewGroupAgeMax] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showClubInfo, setShowClubInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editSuburb, setEditSuburb] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Reports
  const [reportFilter, setReportFilter] = useState<string>("all");
  const [memberReports, setMemberReports] = useState<MemberReport[]>([]);
  const [bookReports, setBookReports] = useState<BookReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Join sheet
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  const [joiningAs, setJoiningAs] = useState<string[]>([]);
  const [joining, setJoining] = useState(false);
  const [myPendingRequest, setMyPendingRequest] = useState<ClubJoinRequest | null>(null);

  // Moderation word list (loaded from DB; falls back to built-in defaults)
  const [wordList, setWordList] = useState<string[]>([]);

  // Topics
  const [topics, setTopics] = useState<ClubTopic[]>([]);
  const [activeTopic, setActiveTopic] = useState<ClubTopic | null>(null);
  const [topicComments, setTopicComments] = useState<ClubTopicComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicBody, setNewTopicBody] = useState("");
  const [newTopicCommentingAllowed, setNewTopicCommentingAllowed] = useState(true);
  const [newTopicThreadsAllowed, setNewTopicThreadsAllowed] = useState(true);
  const [savingTopic, setSavingTopic] = useState(false);
  const [blockedMemberIds, setBlockedMemberIds] = useState<string[]>([]);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [hasTopicNotifs, setHasTopicNotifs] = useState(false);

  // Settings extras
  const [editCommenting, setEditCommenting] = useState(false);
  const [editProfanity, setEditProfanity] = useState(true);

  // Reading group membership for the current user's family members
  const [myReadingGroupIds, setMyReadingGroupIds] = useState<string[]>([]);

  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";

  const load = useCallback(async () => {
    if (!id || !member) return;
    setLoading(true);
    try {
      const { data: clubData } = await supabase.from("clubs").select("*").eq("id", id).single();
      if (!clubData) { navigate("/clubs"); return; }
      setClub(clubData);
      setEditName(clubData.name);
      setEditDesc(clubData.description || "");
      setEditCity(clubData.city || "");
      setEditSuburb(clubData.suburb || "");
      setEditPublic(clubData.is_public);
      setEditCommenting(clubData.commenting_enabled ?? false);
      setEditProfanity(clubData.profanity_filter ?? true);

      // Load enabled profanity words from moderation table
      const { data: mwords } = await supabase
        .from("moderation_words").select("word").eq("enabled", true);
      setWordList((mwords || []).map((r: { word: string }) => r.word));

      // Members + profiles
      const { data: cm } = await supabase
        .from("club_members").select("*, family_members(*)").eq("club_id", id).order("joined_at");
      const rows = (cm || []) as ClubMemberRow[];
      setClubMembers(rows);

      const myEntry = rows.find((r) => myMemberIds.includes(r.family_member_id));
      setMyRole(myEntry ? myEntry.role : null);

      // Reading groups
      const { data: rgs } = await supabase.from("reading_groups").select("*").eq("club_id", id).order("created_at");
      setReadingGroups(rgs || []);

      // Which reading groups does the current user belong to?
      if (rgs && rgs.length) {
        const myClubMemberIds = rows
          .filter((r) => myMemberIds.includes(r.family_member_id))
          .map((r) => r.id);
        if (myClubMemberIds.length) {
          const { data: rgm } = await supabase
            .from("reading_group_members")
            .select("reading_group_id")
            .in("club_member_id", myClubMemberIds);
          const ids = (rgm || []).map((r: { reading_group_id: string }) => r.reading_group_id);
          setMyReadingGroupIds(ids);
          // Pre-select the group for "Add book" if the user belongs to exactly one
          if (ids.length === 1) setAddBookGroupId(ids[0]);
        } else {
          setMyReadingGroupIds([]);
        }
      } else {
        setMyReadingGroupIds([]);
      }

      // Join requests (owner/admin sees all pending; others see their own)
      const { data: reqs } = await supabase
        .from("club_join_requests")
        .select("*, family_members(*)")
        .eq("club_id", id)
        .order("requested_at");
      const reqRows = (reqs || []) as JoinRequestRow[];
      setJoinRequests(reqRows);

      // My own pending request (if not a member)
      if (!myEntry) {
        const pending = reqRows.find(
          (r) => myMemberIds.includes(r.family_member_id) && r.status === "pending",
        ) ?? null;
        setMyPendingRequest(pending);
      } else {
        setMyPendingRequest(null);
      }

      // Books
      const { data: bks } = await supabase
        .from("club_books").select("*").eq("club_id", id).order("added_at", { ascending: false });
      setBooks(bks || []);

      // Progress (club-only, no family sync)
      if (bks && bks.length) {
        const { data: prg } = await supabase
          .from("club_reading_progress")
          .select("*")
          .in("club_book_id", bks.map((b: ClubBook) => b.id));
        setProgress(
          (prg || []).map((p: ClubReadingProgress) => ({
            ...p,
            member: rows.find((r) => r.family_member_id === p.member_id)?.family_members ?? undefined,
            book: bks.find((b: ClubBook) => b.id === p.club_book_id),
          })),
        );
      }

      // Topics
      const { data: topicsData } = await supabase
        .from("club_topics").select("*").eq("club_id", id)
        .order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
      setTopics(topicsData || []);

      // Notification dot: show if any topic is newer than last Topics tab visit
      const lastSeen = localStorage.getItem(`bookie_topics_seen_${id}`) ?? "1970-01-01T00:00:00.000Z";
      const hasNew = (topicsData || []).some((t: ClubTopic) => t.created_at > lastSeen);
      setHasTopicNotifs(hasNew);

      // Blocked commenters (owner/admin only)
      const myEntryForBlocks = rows.find((r) => myMemberIds.includes(r.family_member_id));
      if (myEntryForBlocks && (myEntryForBlocks.role === "owner" || myEntryForBlocks.role === "admin")) {
        const { data: blocks } = await supabase.from("club_comment_blocks").select("member_id").eq("club_id", id);
        setBlockedMemberIds((blocks || []).map((b: { member_id: string }) => b.member_id));
      } else if (myMemberIds.length) {
        // Non-owners: check if they themselves are blocked
        const { data: blocks } = await supabase.from("club_comment_blocks").select("member_id").eq("club_id", id).in("member_id", myMemberIds);
        setBlockedMemberIds((blocks || []).map((b: { member_id: string }) => b.member_id));
      }

      // Mark notifications seen
      if (myMemberIds.length) {
        await supabase.from("club_notifications").update({ seen: true })
          .in("member_id", myMemberIds).eq("club_id", id);
      }
    } finally {
      setLoading(false);
    }
  }, [id, member]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (activeTab === "reports" && id) loadReports(); }, [activeTab, id]);
  useEffect(() => {
    if (activeTab === "topics" && id) {
      localStorage.setItem(`bookie_topics_seen_${id}`, new Date().toISOString());
      setHasTopicNotifs(false);
    }
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

  async function loadTopicComments(topicId: string) {
    setCommentsLoading(true);
    const { data } = await supabase
      .from("club_topic_comments")
      .select("*, author:family_members(*)")
      .eq("topic_id", topicId)
      .order("created_at");
    setTopicComments((data || []) as ClubTopicComment[]);
    setCommentsLoading(false);
  }

  async function handleOpenTopic(topic: ClubTopic) {
    setActiveTopic(topic);
    await loadTopicComments(topic.id);
  }

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!club || !member || !newTopicTitle.trim()) return;
    setSavingTopic(true);
    try {
      const { data: topic, error } = await supabase
        .from("club_topics")
        .insert({
          club_id: club.id,
          created_by: member.id,
          title: newTopicTitle.trim(),
          body: newTopicBody.trim() || null,
          commenting_allowed: newTopicCommentingAllowed,
          threads_allowed: newTopicCommentingAllowed ? newTopicThreadsAllowed : false,
          profanity_filter: club.profanity_filter,
        })
        .select().single();
      if (error) throw error;
      setTopics((prev) => [topic, ...prev]);
      setShowNewTopic(false);
      setNewTopicTitle("");
      setNewTopicBody("");
      setNewTopicCommentingAllowed(true);
      setNewTopicThreadsAllowed(true);
      // Notify other members
      const othersForTopic = clubMembers
        .filter((cm) => !myMemberIds.includes(cm.family_member_id))
        .map((cm) => cm.family_member_id);
      if (othersForTopic.length) {
        await supabase.from("club_notifications").insert(
          othersForTopic.map((mid) => ({ club_id: club.id, member_id: mid, type: "new_topic", title: `💬 New topic: ${newTopicTitle.trim()}` })),
        );
      }
      toast.success("Topic posted!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to post topic");
    } finally {
      setSavingTopic(false);
    }
  }

  async function handleSubmitComment() {
    if (!activeTopic || !member || !newComment.trim()) return;
    setSubmittingComment(true);
    const body = activeTopic.profanity_filter ? filterProfanity(newComment.trim(), wordList) : newComment.trim();
    const { data: comment, error } = await supabase
      .from("club_topic_comments")
      .insert({ topic_id: activeTopic.id, author_id: member.id, body, parent_id: null })
      .select("*, author:family_members(*)").single();
    if (error) { toast.error("Failed to post comment"); setSubmittingComment(false); return; }
    setTopicComments((prev) => [...prev, comment as ClubTopicComment]);
    setNewComment("");
    setSubmittingComment(false);
    // Notify others
    const othersForComment = clubMembers.filter((cm) => !myMemberIds.includes(cm.family_member_id)).map((cm) => cm.family_member_id);
    if (othersForComment.length && club) {
      await supabase.from("club_notifications").insert(
        othersForComment.map((mid) => ({ club_id: club.id, member_id: mid, type: "new_comment", title: `💬 New comment in: ${activeTopic.title}` })),
      );
    }
  }

  async function handleSubmitReply(parentId: string) {
    if (!activeTopic || !member || !replyText.trim()) return;
    setSubmittingComment(true);
    const body = activeTopic.profanity_filter ? filterProfanity(replyText.trim(), wordList) : replyText.trim();
    const { data: comment, error } = await supabase
      .from("club_topic_comments")
      .insert({ topic_id: activeTopic.id, author_id: member.id, body, parent_id: parentId })
      .select("*, author:family_members(*)").single();
    if (error) { toast.error("Failed to post reply"); setSubmittingComment(false); return; }
    setTopicComments((prev) => [...prev, comment as ClubTopicComment]);
    setReplyingToId(null);
    setReplyText("");
    setSubmittingComment(false);
    // Notify others
    const othersForReply = clubMembers.filter((cm) => !myMemberIds.includes(cm.family_member_id)).map((cm) => cm.family_member_id);
    if (othersForReply.length && club) {
      await supabase.from("club_notifications").insert(
        othersForReply.map((mid) => ({ club_id: club.id, member_id: mid, type: "new_comment", title: `💬 New reply in: ${activeTopic.title}` })),
      );
    }
  }

  async function handleDeleteComment(commentId: string) {
    // Cascade soft-delete to all descendants so orphaned replies don't linger
    function collectDescendants(id: string, all: ClubTopicComment[]): string[] {
      return [id, ...all.filter((c) => c.parent_id === id).flatMap((c) => collectDescendants(c.id, all))];
    }
    const toDelete = collectDescendants(commentId, topicComments);
    const { error } = await supabase.from("club_topic_comments").update({ is_deleted: true }).in("id", toDelete);
    if (error) { toast.error("Failed to delete comment"); return; }
    setTopicComments((prev) => prev.map((c) => toDelete.includes(c.id) ? { ...c, is_deleted: true } : c));
  }

  async function handleBlockCommenter(memberId: string) {
    if (!club) return;
    await supabase.from("club_comment_blocks").upsert({ club_id: club.id, member_id: memberId });
    setBlockedMemberIds((prev) => [...prev, memberId]);
    toast.success("Member blocked from commenting");
  }

  async function handleUnblockCommenter(memberId: string) {
    if (!club) return;
    await supabase.from("club_comment_blocks").delete().eq("club_id", club.id).eq("member_id", memberId);
    setBlockedMemberIds((prev) => prev.filter((id) => id !== memberId));
    toast.success("Member unblocked");
  }

  async function handleDeleteTopic(topicId: string) {
    const { error } = await supabase.from("club_topics").delete().eq("id", topicId);
    if (error) { toast.error("Failed to delete topic"); return; }
    setTopics((prev) => prev.filter((t) => t.id !== topicId));
    if (activeTopic?.id === topicId) setActiveTopic(null);
    toast.success("Topic deleted");
  }

  async function handlePinTopic(topic: ClubTopic) {
    const { error } = await supabase.from("club_topics").update({ is_pinned: !topic.is_pinned }).eq("id", topic.id);
    if (error) { toast.error("Failed to update topic"); return; }
    setTopics((prev) => prev.map((t) => t.id === topic.id ? { ...t, is_pinned: !topic.is_pinned } : t));
    if (activeTopic?.id === topic.id) setActiveTopic((t) => t ? { ...t, is_pinned: !t.is_pinned } : t);
  }

  async function handleCopyInvite() {
    if (!club) return;
    await navigator.clipboard.writeText(`${APP_URL}/clubs/invite/${club.invite_token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Invite link copied!");
  }

  async function doBookSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) return;
    setLookingUp(true);
    setBookResults([]);
    setBookHasSearched(false);
    try {
      const isIsbn = /^[0-9]{9,13}[0-9X]?$/.test(trimmed.replace(/[-\s]/g, ""));
      const params = new URLSearchParams({
        limit: "15",
        fields: "key,title,author_name,cover_i,isbn,number_of_pages_median",
      });
      if (isIsbn) params.set("isbn", trimmed.replace(/[-\s]/g, ""));
      else params.set("q", trimmed);
      const res = await fetch(`https://openlibrary.org/search.json?${params}`);
      const data = await res.json();
      setBookResults((data.docs ?? []).filter((d: { title?: string }) => d.title));
    } catch {
      toast.error("Search failed — check your connection");
    } finally {
      setLookingUp(false);
      setBookHasSearched(true);
    }
  }

  function handleBookSearchChange(value: string) {
    setBookSearch(value);
    setBookPreview(null);
    if (!value.trim()) { setBookResults([]); setBookHasSearched(false); return; }
    if (bookDebounceRef.current) clearTimeout(bookDebounceRef.current);
    bookDebounceRef.current = setTimeout(() => doBookSearch(value), 350);
  }

  function handleSelectBookResult(result: { key: string; title: string; author_name?: string[]; cover_i?: number; isbn?: string[]; number_of_pages_median?: number }) {
    const isbn = result.isbn?.find((i) => i.length === 13) ?? result.isbn?.[0] ?? null;
    const coverUrl = result.cover_i ? `https://covers.openlibrary.org/b/id/${result.cover_i}-L.jpg` : null;
    setBookPreview({ title: result.title, author: result.author_name?.[0] ?? null, isbn, cover_url: coverUrl, page_count: result.number_of_pages_median ?? null });
  }

  function resetAddBook() {
    setShowAddBook(false);
    setBookSearch("");
    setBookResults([]);
    setBookHasSearched(false);
    setBookPreview(null);
    setAddBookGroupId(null);
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
          reading_group_id: addBookGroupId || null,
        })
        .select().single();
      if (error) throw error;

      const others = clubMembers.filter((cm) => !myMemberIds.includes(cm.family_member_id)).map((cm) => cm.family_member_id);
      if (others.length) {
        await supabase.from("club_notifications").insert(
          others.map((mid) => ({ club_id: club.id, member_id: mid, type: "new_book", title: `📚 ${bookPreview.title} added to ${club.name}` })),
        );
      }

      setBooks((prev) => [inserted, ...prev]);
      resetAddBook();
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
      await supabase.from("club_books").update({ is_current_read: false }).eq("club_id", club.id);
      const { error } = await supabase.from("club_books")
        .update({ is_current_read: true, read_target_date: groupReadDate || null }).eq("id", groupReadBookId);
      if (error) throw error;
      setBooks((prev) => prev.map((b) => ({
        ...b,
        is_current_read: b.id === groupReadBookId,
        read_target_date: b.id === groupReadBookId ? groupReadDate || null : b.read_target_date,
      })));
      const others = clubMembers.filter((cm) => !myMemberIds.includes(cm.family_member_id)).map((cm) => cm.family_member_id);
      const book = books.find((b) => b.id === groupReadBookId);
      if (others.length && book) {
        await supabase.from("club_notifications").insert(
          others.map((mid) => ({ club_id: club.id, member_id: mid, type: "new_book", title: `📖 Group Read started: ${book.title}` })),
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
    const { error } = await supabase.from("club_books").update({ is_current_read: false, read_target_date: null }).eq("id", bookId);
    if (error) { toast.error("Failed to end group read"); return; }
    setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, is_current_read: false, read_target_date: null } : b));
    toast.success("Group Read ended");
  }

  // Club-only progress — NO family library sync
  async function handleUpdateProgress(
    bookId: string, newStatus: "want_to_read" | "reading" | "finished",
    memberId: string, currentPage?: number,
  ) {
    const now = new Date().toISOString();
    const updates = {
      status: newStatus, updated_at: now,
      current_page: currentPage ?? 0,
      started_at: newStatus !== "want_to_read" ? now : null,
      finished_at: newStatus === "finished" ? now : null,
    };
    const { error } = await supabase
      .from("club_reading_progress")
      .upsert({ club_book_id: bookId, member_id: memberId, ...updates }, { onConflict: "club_book_id,member_id" });
    if (error) { toast.error("Failed to update progress"); return; }

    setProgress((prev) => {
      const idx = prev.findIndex((p) => p.club_book_id === bookId && p.member_id === memberId);
      const entry: ProgressEntry = {
        ...(prev[idx] || {}),
        id: prev[idx]?.id || "",
        club_book_id: bookId, member_id: memberId,
        ...updates, status: newStatus, current_page: currentPage ?? 0,
        started_at: updates.started_at ?? null, finished_at: updates.finished_at ?? null,
        book: books.find((b) => b.id === bookId),
        member: allMembers.find((m) => m.id === memberId),
      };
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
      return [...prev, entry];
    });
  }

  // Add a club book to the user's personal family library (explicit action only)
  async function handleAddToPersonalLibrary(book: ClubBook, forMemberId: string) {
    const fm = allMembers.find((m) => m.id === forMemberId);
    if (!fm) return;
    try {
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
          added_by: forMemberId,
        }).select("id").single();
        familyBook = data;
      }

      // Sync current club progress if any
      const clubProgress = progress.find((p) => p.club_book_id === book.id && p.member_id === forMemberId);
      if (familyBook && clubProgress) {
        await supabase.from("reading_progress").upsert({
          book_id: familyBook.id, member_id: forMemberId,
          status: clubProgress.status, current_page: clubProgress.current_page,
          started_at: clubProgress.started_at, finished_at: clubProgress.finished_at,
          updated_at: new Date().toISOString(),
        }, { onConflict: "book_id,member_id" });
      }

      toast.success(`"${book.title}" added to ${fm.nickname}'s library!`);
    } catch {
      toast.error("Failed to add to personal library");
    }
  }

  async function handleRequestJoin() {
    if (!club || !joiningAs.length) return;
    setJoining(true);
    try {
      for (const fmId of joiningAs) {
        const { error } = await supabase.from("club_join_requests").insert({
          club_id: club.id, family_member_id: fmId, status: "pending",
        });
        if (error && error.code !== "23505") throw error;
      }

      // Notify owner/admins
      const ownerIds = clubMembers.filter((cm) => cm.role === "owner" || cm.role === "admin").map((cm) => cm.family_member_id);
      const names = joiningAs.map((mid) => allMembers.find((m) => m.id === mid)?.nickname).filter(Boolean).join(", ");
      if (ownerIds.length) {
        await supabase.from("club_notifications").insert(
          ownerIds.map((mid) => ({ club_id: club.id, member_id: mid, type: "join_request", title: `✋ ${names} requested to join ${club.name}` })),
        );
      }

      toast.success("Join request sent! Waiting for club owner approval.");
      setShowJoinSheet(false);
      setJoiningAs([]);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setJoining(false);
    }
  }

  async function handleApproveRequest(req: JoinRequestRow) {
    if (!club) return;
    const { error } = await supabase.from("club_members").insert({
      club_id: club.id, family_member_id: req.family_member_id, role: "member",
    });
    if (error && error.code !== "23505") { toast.error("Failed to approve"); return; }

    await supabase.from("club_join_requests").update({
      status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: member?.id,
    }).eq("id", req.id);

    // Notify the requester
    await supabase.from("club_notifications").insert({
      club_id: club.id, member_id: req.family_member_id, type: "new_member",
      title: `🎉 You've been approved to join ${club.name}!`,
    });

    toast.success(`${req.family_members?.nickname ?? "Member"} approved!`);
    load();
  }

  async function handleRejectRequest(req: JoinRequestRow) {
    await supabase.from("club_join_requests").update({
      status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: member?.id,
    }).eq("id", req.id);
    setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
    toast.success("Request rejected");
  }

  async function handleAddReadingGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!club || !newGroupName.trim()) return;
    setSavingGroup(true);
    const { data, error } = await supabase.from("reading_groups").insert({
      club_id: club.id, name: newGroupName.trim(),
      description: newGroupDesc.trim() || null,
      age_min: newGroupAgeMin ? parseInt(newGroupAgeMin) : null,
      age_max: newGroupAgeMax ? parseInt(newGroupAgeMax) : null,
    }).select().single();
    setSavingGroup(false);
    if (error) { toast.error("Failed to add group"); return; }
    setReadingGroups((prev) => [...prev, data]);
    setShowAddGroup(false);
    setNewGroupName("");
    setNewGroupDesc("");
    setNewGroupAgeMin("");
    setNewGroupAgeMax("");
    toast.success(`Reading group "${data.name}" added`);
  }

  async function handleDeleteReadingGroup(rgId: string) {
    const { error } = await supabase.from("reading_groups").delete().eq("id", rgId);
    if (error) { toast.error("Failed to delete group"); return; }
    setReadingGroups((prev) => prev.filter((g) => g.id !== rgId));
    toast.success("Reading group removed");
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!club || !editName.trim() || !editCity.trim()) return;
    setSavingSettings(true);
    const { error } = await supabase.from("clubs").update({
      name: editName.trim(), description: editDesc.trim() || null,
      is_public: editPublic, city: editCity.trim(), suburb: editSuburb.trim() || null,
      commenting_enabled: editCommenting, profanity_filter: editProfanity,
    }).eq("id", club.id);
    if (error) { toast.error("Failed to save"); setSavingSettings(false); return; }
    setClub((c) => c ? { ...c, name: editName, description: editDesc || null, is_public: editPublic, city: editCity, suburb: editSuburb || null, commenting_enabled: editCommenting, profanity_filter: editProfanity } : c);
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
    const filtered = reportFilter === "all" ? memberReports : memberReports.filter((r) => r.member_id === reportFilter);
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

  function resolveProfile(cm: ClubMemberRow): { nickname: string; avatar: string; familyRole: string } {
    if (cm.family_members) return { nickname: cm.family_members.nickname, avatar: cm.family_members.avatar_emoji, familyRole: cm.family_members.role };
    const local = allMembers.find((m) => m.id === cm.family_member_id);
    if (local) return { nickname: local.nickname, avatar: local.avatar_emoji, familyRole: local.role };
    return { nickname: "Club member", avatar: "👤", familyRole: "" };
  }

  const amIMember = myRole !== null;
  const notInClub = !amIMember && !myPendingRequest;
  const pendingRequests = joinRequests.filter((r) => r.status === "pending");
  const membersNotInClub = allMembers.filter((m) => !clubMembers.find((cm) => cm.family_member_id === m.id) && !joinRequests.find((r) => r.family_member_id === m.id && r.status === "pending"));
  const currentRead = books.find((b) => b.is_current_read);

  // Owners/admins see all books. Regular members only see:
  //   • books with no reading group (whole-club books)
  //   • books belonging to one of their own reading groups
  const visibleBooks = isOwnerOrAdmin || myReadingGroupIds.length === 0
    ? books
    : books.filter((b) => b.reading_group_id === null || myReadingGroupIds.includes(b.reading_group_id));

  const isOwner = myRole === "owner";

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: boolean }[] = [
    { id: "books", label: "Books", icon: <BookOpen size={12} /> },
    { id: "groups", label: "Groups", icon: <Layers size={12} /> },
    { id: "members", label: "Members", icon: <Users size={12} /> },
    ...(isOwnerOrAdmin ? [{ id: "progress" as Tab, label: "Progress", icon: <BarChart2 size={12} /> }] : []),
    ...(isOwner ? [{ id: "reports" as Tab, label: "Reports", icon: <FileText size={12} /> }] : []),
  ];

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 size={28} className="text-primary animate-spin" /></div>;
  }
  if (!club) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl lg:max-w-none mx-auto px-4 lg:px-10 pb-28 lg:pb-10">

        <div className="pt-4 lg:pt-8 mb-4">
          <button onClick={() => navigate("/clubs")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />All Clubs
          </button>
        </div>

        {/* ── Desktop two-column grid ── */}
        <div className="lg:grid lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px] lg:gap-8 lg:items-start">
        {/* Left / main column */}
        <div>

        {/* Club header */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-4">
          <div className="flex items-start gap-4">
            <span className="text-5xl">{club.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h1 className="font-display text-xl font-bold text-foreground leading-tight">{club.name}</h1>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setShowClubInfo(true)} className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="How clubs work">
                    <HelpCircle size={16} />
                  </button>
                  {isOwnerOrAdmin && (
                    <button onClick={() => setShowSettings(true)} className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                      <Settings size={16} />
                    </button>
                  )}
                </div>
              </div>
              {club.description && <p className="text-sm text-muted-foreground mt-1">{club.description}</p>}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {club.is_public ? <Globe size={11} /> : <Lock size={11} />}
                  {club.is_public ? "Public" : "Private"}
                </span>
                {(club.city || club.suburb) && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={11} />
                    {club.suburb ? `${club.suburb}, ${club.city}` : club.city}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users size={11} />{clubMembers.length} member{clubMembers.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Layers size={11} />{readingGroups.length} group{readingGroups.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
            {amIMember && (
              <button onClick={handleCopyInvite} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-muted hover:bg-secondary transition-colors">
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy invite link"}
              </button>
            )}
            {notInClub && (
              <button onClick={() => setShowJoinSheet(true)} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                <Plus size={12} />Request to join
              </button>
            )}
            {myPendingRequest && !amIMember && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-100 text-amber-700">
                ⏳ Join request pending approval
              </span>
            )}
            {amIMember && myRole !== "owner" && (
              <button onClick={handleLeaveClub} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-muted hover:bg-red-100 hover:text-red-600 transition-colors ml-auto">
                Leave club
              </button>
            )}
          </div>
        </div>

        {/* Group Read banner */}
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
              <button onClick={() => handleEndGroupRead(currentRead.id)} className="text-xs text-muted-foreground hover:text-red-500 transition-colors shrink-0 px-2 py-1 rounded-lg hover:bg-red-50">End</button>
            )}
          </div>
        )}

        {/* Pending join requests (owner/admin) */}
        {isOwnerOrAdmin && pendingRequests.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-3">
              {pendingRequests.length} pending join request{pendingRequests.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-2">
              {pendingRequests.map((req) => {
                const profile = req.family_members;
                return (
                  <div key={req.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-amber-100">
                    <span className="text-xl">{profile?.avatar_emoji || "👤"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{profile?.nickname || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(req.requested_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleApproveRequest(req)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                        <UserCheck size={12} />Approve
                      </button>
                      <button onClick={() => handleRejectRequest(req)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors">
                        <UserX size={12} />Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn("flex items-center gap-1 flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-lg transition-all relative",
                activeTab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <span className="relative">
                {t.icon}
                {t.badge && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />}
              </span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Topics CTA — full width on mobile, right-anchored on desktop ── */}
        {activeTab !== "topics" && amIMember && (
          <div className="flex justify-end mb-5">
            <button
              onClick={() => setActiveTab("topics")}
              className="w-full lg:w-auto flex items-center justify-between lg:justify-start gap-4 px-4 py-3 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="relative shrink-0">
                  <MessageSquare size={20} className="text-primary" />
                  {hasTopicNotifs && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-card" />
                  )}
                </span>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground leading-none mb-0.5">Topics</p>
                  <p className="text-xs text-muted-foreground leading-none">
                    {topics.length === 0
                      ? "No discussions yet"
                      : `${topics.length} discussion${topics.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </button>
          </div>
        )}

        {/* ── Tab: Books ── */}
        {activeTab === "books" && (
          <div>
            {isOwnerOrAdmin && (
              <div className="flex gap-2 mb-4">
                <button onClick={() => setShowAddBook(true)}
                  className="flex-1 flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <Plus size={16} />Add a book
                </button>
                <button onClick={() => setShowGroupReadSheet(true)}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-primary/40 rounded-2xl text-sm font-semibold text-primary hover:border-primary hover:bg-primary/5 transition-colors">
                  <BookMarked size={16} />Group Read
                </button>
              </div>
            )}

            {/* Filter by reading group */}
            {readingGroups.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                <ReadingGroupFilter label="All books" active={!addBookGroupId} onClick={() => setAddBookGroupId(null)} />
                {readingGroups.map((rg) => (
                  <ReadingGroupFilter key={rg.id} label={rg.name} active={false} onClick={() => {}} />
                ))}
              </div>
            )}

            {visibleBooks.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3">📚</span>
                <p className="font-semibold text-foreground">No books yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {books.length > 0
                    ? "No books assigned to your reading group yet."
                    : "Add the first book to get the club reading!"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleBooks.map((book) => (
                  <ClubBookRow key={book.id} book={book}
                    progress={progress.filter((p) => p.club_book_id === book.id)}
                    myMemberIds={myMemberIds} allMembers={allMembers}
                    clubMembers={clubMembers}
                    readingGroup={readingGroups.find((rg) => rg.id === book.reading_group_id)}
                    onUpdateProgress={handleUpdateProgress}
                    onAddToPersonal={handleAddToPersonalLibrary}
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

        {/* ── Tab: Reading Groups ── */}
        {activeTab === "groups" && (
          <div>
            {isOwnerOrAdmin && (
              <button onClick={() => setShowAddGroup(true)}
                className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors mb-4">
                <Plus size={16} />Add a reading group
              </button>
            )}
            {readingGroups.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3">🔖</span>
                <p className="font-semibold text-foreground">No reading groups yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isOwnerOrAdmin ? "Add age-based groups like \"Little Readers (0–3)\" or \"Junior Chapter Books (6–9)\"." : "The club owner hasn't set up reading groups yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {readingGroups.map((rg) => {
                  const groupBooks = books.filter((b) => b.reading_group_id === rg.id);
                  return (
                    <div key={rg.id} className="bg-card border border-border rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm">{rg.name}</h3>
                            {(rg.age_min != null || rg.age_max != null) && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                {rg.age_min != null && rg.age_max != null ? `${rg.age_min}–${rg.age_max} yrs`
                                  : rg.age_min != null ? `${rg.age_min}+ yrs` : `Up to ${rg.age_max} yrs`}
                              </span>
                            )}
                          </div>
                          {rg.description && <p className="text-xs text-muted-foreground mt-0.5">{rg.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{groupBooks.length} book{groupBooks.length !== 1 ? "s" : ""}</p>
                        </div>
                        {isOwnerOrAdmin && (
                          <button onClick={() => handleDeleteReadingGroup(rg.id)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-lg shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {groupBooks.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                          {groupBooks.map((b) => (
                            <div key={b.id} className="flex items-center gap-2">
                              <BookCover src={b.cover_url || undefined} isbn={b.isbn || undefined} title={b.title} className="w-6 h-8 rounded object-cover shrink-0" />
                              <span className="text-xs text-foreground line-clamp-1">{b.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Members ── */}
        {activeTab === "members" && (
          <div>
            {(notInClub || (amIMember && membersNotInClub.length > 0)) && (
              <button onClick={() => setShowJoinSheet(true)}
                className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors mb-4">
                <Plus size={16} />
                {notInClub ? "Request to join" : "Add more family members"}
              </button>
            )}
            {clubMembers.length === 0 ? (
              <div className="text-center py-12"><span className="text-4xl block mb-3">👥</span><p className="font-semibold">No members yet</p></div>
            ) : (
              <div className="space-y-2">
                {clubMembers.map((cm) => {
                  const { nickname, avatar, familyRole } = resolveProfile(cm);
                  const isMe = myMemberIds.includes(cm.family_member_id);
                  return (
                    <div key={cm.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                      <span className="text-2xl">{avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{nickname}</span>
                          {cm.role === "owner" && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              <Crown size={9} />Owner
                            </span>
                          )}
                          {cm.role === "admin" && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Admin</span>
                          )}
                          {isMe && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">You</span>}
                        </div>
                        {familyRole && <p className="text-xs text-muted-foreground">{familyRole}</p>}
                      </div>
                      {isOwnerOrAdmin && !isMe && cm.role !== "owner" && (
                        <button onClick={() => handleRemoveMember(cm.id)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-lg">
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
            {/* Privacy: non-owners in age-locked clubs only see their own progress */}
            {!isOwnerOrAdmin && readingGroups.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2 mb-4">
                <Lock size={12} className="shrink-0" />
                For privacy, you can only see your own reading progress in this club.
              </div>
            )}
            {books.length === 0 ? (
              <div className="text-center py-12"><span className="text-4xl block mb-3">📊</span><p className="font-semibold">No books to track yet</p></div>
            ) : (
              <div className="space-y-4">
                {visibleBooks.map((book) => {
                  const bookProgress = progress.filter((p) => p.club_book_id === book.id);
                  const visibleMembers = isOwnerOrAdmin || readingGroups.length === 0
                    ? clubMembers
                    : clubMembers.filter((cm) => myMemberIds.includes(cm.family_member_id));
                  const finishedCount = bookProgress.filter((p) => p.status === "finished").length;
                  return (
                    <div key={book.id} className="bg-card border border-border rounded-2xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <BookCover src={book.cover_url || undefined} isbn={book.isbn || undefined} title={book.title} className="w-10 h-14 rounded-md object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-sm line-clamp-1">{book.title}</p>
                            {book.is_current_read && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">Group Read</span>
                            )}
                          </div>
                          {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
                          {(isOwnerOrAdmin || readingGroups.length === 0) && (
                            <div className="mt-1.5">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
                                <span>{finishedCount}/{clubMembers.length} finished</span>
                                <span>{clubMembers.length ? Math.round((finishedCount / clubMembers.length) * 100) : 0}%</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${clubMembers.length ? (finishedCount / clubMembers.length) * 100 : 0}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {visibleMembers.map((cm) => {
                          const { nickname, avatar } = resolveProfile(cm);
                          const prg = bookProgress.find((p) => p.member_id === cm.family_member_id);
                          const pct = book.page_count && prg?.current_page ? Math.min(100, Math.round((prg.current_page / book.page_count) * 100)) : 0;
                          return (
                            <div key={cm.id} className="flex items-center gap-2">
                              <span className="text-sm">{avatar}</span>
                              <span className="text-xs text-muted-foreground w-20 truncate">{nickname}</span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full transition-all", prg?.status === "finished" ? "bg-primary" : "bg-amber-400")}
                                  style={{ width: `${prg?.status === "finished" ? 100 : pct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground w-20 text-right shrink-0">{prg ? STATUS_LABELS[prg.status] : "Not started"}</span>
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

        {/* ── Tab: Topics ── */}
        {activeTab === "topics" && !activeTopic && (
          <div>
            {isOwnerOrAdmin && (
              <button onClick={() => setShowNewTopic(true)}
                className="w-full flex items-center gap-2 px-4 py-3 mb-4 border-2 border-dashed border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                <Plus size={16} />New Topic
              </button>
            )}
            {!club?.commenting_enabled && !isOwnerOrAdmin && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2 mb-4">
                <MessageSquare size={12} className="shrink-0" />
                Commenting is disabled for this club. Owner messages will appear here.
              </div>
            )}
            {topics.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3">💬</span>
                <p className="font-semibold text-foreground">No topics yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isOwnerOrAdmin ? "Post the first topic to start a discussion." : "The owner hasn't posted any topics yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {topics.map((topic) => {
                  const isOwnerPost = topic.created_by === club?.created_by;
                  return (
                    <button key={topic.id} onClick={() => handleOpenTopic(topic)}
                      className={cn("w-full text-left p-4 rounded-2xl border transition-all hover:bg-muted/50",
                        isOwnerPost ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : "bg-card border-border")}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            {topic.is_pinned && <Pin size={11} className="text-primary shrink-0" />}
                            {isOwnerPost && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 shrink-0"><Crown size={8} className="inline mr-0.5 -mt-0.5" />Owner</span>}
                            <p className="font-semibold text-sm line-clamp-1">{topic.title}</p>
                          </div>
                          {topic.body && <p className="text-xs text-muted-foreground line-clamp-2">{topic.body}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1.5">{new Date(topic.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!topic.commenting_allowed && <MessageSquare size={12} className="text-muted-foreground opacity-40" />}
                          <ChevronRight size={16} className="text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Topic Detail (inline) ── */}
        {activeTab === "topics" && activeTopic && (
          <div>
            {/* Back */}
            <button onClick={() => { setActiveTopic(null); setTopicComments([]); setNewComment(""); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft size={16} />All Topics
            </button>

            {/* Topic post */}
            {(() => {
              const isOwnerPost = activeTopic.created_by === club?.created_by;
              return (
                <div className={cn("rounded-2xl border p-4 mb-4", isOwnerPost ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : "bg-card border-border")}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {activeTopic.is_pinned && <Pin size={12} className="text-primary" />}
                      {isOwnerPost && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"><Crown size={8} className="inline mr-0.5 -mt-0.5" />Owner</span>}
                      <h3 className="font-bold text-base">{activeTopic.title}</h3>
                    </div>
                    {isOwnerOrAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handlePinTopic(activeTopic)} title={activeTopic.is_pinned ? "Unpin" : "Pin"}
                          className="p-1.5 text-muted-foreground hover:text-primary rounded-lg transition-colors">
                          <Pin size={14} />
                        </button>
                        <button onClick={() => handleDeleteTopic(activeTopic.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  {activeTopic.body && <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{activeTopic.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(activeTopic.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                </div>
              );
            })()}

            {/* Comments / threaded discussion */}
            {(() => {
              const amIBlocked = allMembers.some((m) => blockedMemberIds.includes(m.id));
              // Owner always bypasses all comment restrictions
              const canComment = isOwner || (amIMember && activeTopic.commenting_allowed && (club?.commenting_enabled || isOwnerOrAdmin) && !amIBlocked);
              // Replies/threads: owner always allowed; members need threads_allowed on top of canComment
              const canReply = isOwner || (canComment && (activeTopic.threads_allowed ?? true));
              const commentsDisabled = !activeTopic.commenting_allowed;

              if (commentsDisabled && topicComments.length === 0) {
                // Fix 1: no discussion section at all, just the notice
                return (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2 mt-2">
                    <MessageSquare size={12} className="shrink-0" />
                    Comments are disabled for this topic.
                  </div>
                );
              }

              const commentTree = buildCommentTree(topicComments);

              return (
                <>
                  {/* Thread list */}
                  <div className="mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                      Discussion {topicComments.filter(c => !c.is_deleted).length > 0 && `· ${topicComments.filter(c => !c.is_deleted).length}`}
                    </h4>
                    {commentsLoading ? (
                      <div className="flex justify-center py-6"><Loader2 size={20} className="text-primary animate-spin" /></div>
                    ) : commentTree.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        {canComment ? "No comments yet — be the first to reply!" : "No comments yet."}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {commentTree.map((node) => (
                          <CommentThread
                            key={node.id}
                            comment={node}
                            depth={0}
                            clubCreatedBy={club?.created_by ?? null}
                            myMemberIds={myMemberIds}
                            allMembers={allMembers}
                            isOwnerOrAdmin={isOwnerOrAdmin}
                            blockedMemberIds={blockedMemberIds}
                            canComment={canComment}
                            canReply={canReply}
                            isOwner={isOwner}
                            replyingToId={replyingToId}
                            replyText={replyText}
                            submittingComment={submittingComment}
                            onSetReplying={(id) => { setReplyingToId(id); setReplyText(""); }}
                            onSetReplyText={setReplyText}
                            onReply={handleSubmitReply}
                            onDelete={handleDeleteComment}
                            onBlock={handleBlockCommenter}
                            onUnblock={handleUnblockCommenter}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Root comment input — only when commenting allowed */}
                  {canComment && (
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && newComment.trim()) { e.preventDefault(); handleSubmitComment(); } }}
                        placeholder="Write a comment…"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button onClick={handleSubmitComment} disabled={submittingComment || !newComment.trim()}
                        className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity">
                        {submittingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                  )}

                  {/* Blocked / club-disabled notice */}
                  {!canComment && !commentsDisabled && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2 mt-2">
                      {amIBlocked
                        ? <><ShieldOff size={12} className="shrink-0" />You have been blocked from commenting in this club.</>
                        : <><MessageSquare size={12} className="shrink-0" />Commenting is disabled for this club.</>}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── Tab: Reports ── */}
        {activeTab === "reports" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="relative">
                <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)}
                  className="appearance-none text-xs font-semibold bg-card border border-border rounded-xl pl-3 pr-8 py-2 outline-none focus:ring-2 focus:ring-ring">
                  <option value="all">All members</option>
                  {clubMembers.map((cm) => {
                    const { nickname } = resolveProfile(cm);
                    return <option key={cm.family_member_id} value={cm.family_member_id}>{nickname}</option>;
                  })}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-card border border-border rounded-xl hover:bg-muted transition-colors">
                <Download size={13} />Export CSV
              </button>
            </div>
            {reportsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={24} className="text-primary animate-spin" /></div>
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
                          <div><p className="font-bold text-sm text-primary">{r.books_finished}</p><p className="text-[10px] text-muted-foreground">Done</p></div>
                          <div><p className="font-bold text-sm text-amber-600">{r.books_reading}</p><p className="text-[10px] text-muted-foreground">Reading</p></div>
                          <div><p className="font-bold text-sm text-foreground">{r.pages_read}</p><p className="text-[10px] text-muted-foreground">Pages</p></div>
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
                            <div><p className="font-bold text-sm text-primary">{r.finished_count}</p><p className="text-[10px] text-muted-foreground">Done</p></div>
                            <div><p className="font-bold text-sm text-amber-600">{r.reading_count}</p><p className="text-[10px] text-muted-foreground">Reading</p></div>
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
        </div>{/* end left column */}

        {/* ── Right panel — desktop only ── */}
        <aside className="hidden lg:block space-y-4 lg:sticky lg:top-6">
          {/* Club card */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{club.emoji}</span>
              <div className="min-w-0">
                <p className="font-display font-bold text-sm leading-snug truncate">{club.name}</p>
                <p className="text-xs text-muted-foreground">{clubMembers.length} member{clubMembers.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            {club.description && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{club.description}</p>}
            {currentRead && (
              <div className="mt-2 pt-3 border-t border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Currently reading</p>
                <div className="flex gap-2 items-center">
                  <BookCover src={currentRead.cover_url || undefined} isbn={currentRead.isbn || undefined} title={currentRead.title} className="w-8 h-12 rounded object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-snug line-clamp-2">{currentRead.title}</p>
                    {currentRead.author && <p className="text-[11px] text-muted-foreground">{currentRead.author}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Members snapshot */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Members</p>
            <div className="space-y-2">
              {clubMembers.slice(0, 6).map((cm) => {
                const fm = cm.family_member as typeof allMembers[number] | undefined;
                if (!fm) return null;
                return (
                  <div key={cm.id} className="flex items-center gap-2">
                    <span className="text-base shrink-0">{fm.avatar_emoji}</span>
                    <span className="text-xs font-semibold flex-1 truncate">{fm.nickname}</span>
                    {cm.role !== "member" && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{cm.role}</span>
                    )}
                  </div>
                );
              })}
              {clubMembers.length > 6 && (
                <button onClick={() => setActiveTab("members")} className="text-xs text-primary hover:underline font-semibold mt-1">
                  +{clubMembers.length - 6} more
                </button>
              )}
            </div>
          </div>

          {/* Help button */}
          <button onClick={() => setShowClubInfo(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <HelpCircle size={14} /> How clubs work
          </button>
        </aside>

        </div>{/* end grid */}
      </div>

      {/* ── Club Info Modal ── */}
      {showClubInfo && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowClubInfo(false)} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl z-10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-primary" />
                <h2 className="font-display text-lg font-bold">How Clubs Work</h2>
              </div>
              <button onClick={() => setShowClubInfo(false)} className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto max-h-[70vh] px-6 py-5 space-y-5">

              {/* Joining & membership */}
              <div className="flex gap-3">
                <div className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Users size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Joining a club</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Public clubs can be joined directly. Private clubs require an invite link or a join request that the club owner approves. The owner controls who is a member and can remove or block members at any time.</p>
                </div>
              </div>

              {/* Reading & group reads */}
              <div className="flex gap-3">
                <div className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Books &amp; group reads</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Club owners and admins add books and mark the current group read. Members track their own reading progress. Educational clubs organise members into reading groups by age or level.</p>
                </div>
              </div>

              {/* Topics & discussion */}
              <div className="flex gap-3">
                <div className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Topics &amp; discussions</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Owners create discussion topics for the club. Members can comment and reply when the owner enables it. Threads can be turned on or off per topic — handy for simple Q&amp;A-style posts where you don't want nested replies.</p>
                </div>
              </div>

              {/* Moderation */}
              <div className="flex gap-3">
                <div className="mt-0.5 w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck size={15} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Owner as moderator</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">The club owner acts as the sole moderator. They have full, unrestricted control over membership, participation, and all content — including the ability to delete any comment or reply, block members from commenting, and disable discussions entirely, at any time and without notice.</p>
                </div>
              </div>

              {/* Content & commenting */}
              <div className="flex gap-3">
                <div className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageCircleOff size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Commenting &amp; replies</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Commenting is off by default in educational clubs and on by default in social clubs, but the owner can change this at any time in club settings. A profanity filter is active by default to keep discussions family-friendly.</p>
                </div>
              </div>

              {/* Starting your own club */}
              <div className="flex gap-3">
                <div className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookKey size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Starting your own club</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Anyone can create a club from the Clubs page. Choose <strong className="text-foreground">Social</strong> for an open book-club style group, or <strong className="text-foreground">Educational</strong> for an age-grouped, structured reading programme. As the creator you become the owner and moderator.</p>
                </div>
              </div>

              {/* Privacy */}
              <div className="flex gap-3">
                <div className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <UserCog size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Your participation</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">You can leave a club at any time from the Members tab. In age-locked educational clubs, members only see progress relevant to their own reading group. Your reading progress and comments are visible to all current club members.</p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border">
              <button onClick={() => setShowClubInfo(false)}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Topic Sheet ── */}
      {showNewTopic && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewTopic(false)} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold">New Topic</h2>
              <button onClick={() => setShowNewTopic(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTopic} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Title <span className="text-red-500">*</span></label>
                <input type="text" required value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)}
                  placeholder="e.g. What did you think of Chapter 3?"
                  maxLength={120}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Message <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea value={newTopicBody} onChange={(e) => setNewTopicBody(e.target.value)}
                  placeholder="Share your thoughts, a quote, a question…" rows={3} maxLength={1000}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              {/* Per-topic commenting toggle */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-semibold">Allow comments</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Members can reply to this topic.</p>
                </div>
                <button type="button" onClick={() => setNewTopicCommentingAllowed(!newTopicCommentingAllowed)}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${newTopicCommentingAllowed ? "bg-primary" : "bg-border"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${newTopicCommentingAllowed ? "translate-x-6" : ""}`} />
                </button>
              </div>
              {newTopicCommentingAllowed && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Enable replies &amp; threads</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Members can reply to each other's comments. Turn off for simple Q&amp;A-style topics.</p>
                  </div>
                  <button type="button" onClick={() => setNewTopicThreadsAllowed(!newTopicThreadsAllowed)}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${newTopicThreadsAllowed ? "bg-primary" : "bg-border"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${newTopicThreadsAllowed ? "translate-x-6" : ""}`} />
                  </button>
                </div>
              )}
              <button type="submit" disabled={savingTopic || !newTopicTitle.trim()}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {savingTopic ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                Post Topic
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Book Sheet ── */}
      {showAddBook && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={resetAddBook} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl z-10 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
              <h2 className="font-display text-xl font-bold">Add a Book</h2>
              <button onClick={resetAddBook} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>

            {/* Search input */}
            <div className="px-6 pb-3 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-background border border-border focus-within:ring-2 focus-within:ring-ring">
                {lookingUp
                  ? <Loader2 size={15} className="text-muted-foreground animate-spin shrink-0" />
                  : <BookOpen size={15} className="text-muted-foreground shrink-0" />}
                <input
                  autoFocus
                  type="text"
                  value={bookSearch}
                  onChange={(e) => handleBookSearchChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doBookSearch(bookSearch)}
                  placeholder="Title, author name, or ISBN…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {bookSearch && (
                  <button onClick={() => handleBookSearchChange("")} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 pb-2">
              {/* Selected preview */}
              {bookPreview && (() => {
                const previewDupe = books.some((b) => {
                  if (bookPreview.isbn && b.isbn && b.isbn === bookPreview.isbn) return true;
                  return b.title.trim().toLowerCase() === (bookPreview.title ?? "").trim().toLowerCase();
                });
                return (
                  <div className={`mb-3 p-3 rounded-xl border-2 flex gap-3 items-start ${previewDupe ? "border-amber-400 bg-amber-500/8" : "border-primary bg-primary/5"}`}>
                    <BookCover src={bookPreview.cover_url || undefined} isbn={bookPreview.isbn || undefined} title={bookPreview.title} className="w-12 h-16 rounded object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-snug">{bookPreview.title}</p>
                      {bookPreview.author && <p className="text-xs text-muted-foreground mt-0.5">{bookPreview.author}</p>}
                      {bookPreview.page_count && <p className="text-xs text-muted-foreground">{bookPreview.page_count} pages</p>}
                      {previewDupe && (
                        <p className="text-[11px] font-semibold text-amber-600 mt-1">⚠ Already in reading list</p>
                      )}
                      <button onClick={() => setBookPreview(null)} className="text-[11px] text-primary hover:underline mt-1">Change selection</button>
                    </div>
                  </div>
                );
              })()}

              {/* Result list */}
              {!bookPreview && (
                <>
                  {!bookSearch.trim() && !bookHasSearched && (
                    <p className="text-sm text-muted-foreground text-center py-8">Search by title, author name, or ISBN</p>
                  )}
                  {lookingUp && (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
                  )}
                  {!lookingUp && bookHasSearched && bookResults.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No results — try a different title or ISBN</p>
                  )}
                  {!lookingUp && bookResults.length > 0 && (
                    <div className="space-y-1.5 pb-2">
                      {bookResults.map((r) => {
                        const rIsbn = r.isbn?.find((i) => i.length === 13) ?? r.isbn?.[0];
                        const isDupe = books.some((b) => {
                          if (rIsbn && b.isbn && b.isbn === rIsbn) return true;
                          return b.title.trim().toLowerCase() === r.title.trim().toLowerCase();
                        });
                        return (
                          <button key={r.key} type="button" onClick={() => handleSelectBookResult(r)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${isDupe ? "bg-amber-500/8 hover:bg-amber-500/15" : "hover:bg-muted"}`}>
                            {r.cover_i
                              ? <img src={`https://covers.openlibrary.org/b/id/${r.cover_i}-M.jpg`} alt="" className="w-9 h-12 rounded object-cover shrink-0 bg-muted" />
                              : <div className="w-9 h-12 rounded bg-muted flex items-center justify-center shrink-0"><BookOpen size={14} className="text-muted-foreground" /></div>}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-snug truncate">{r.title}</p>
                              {r.author_name?.[0] && <p className="text-xs text-muted-foreground truncate">{r.author_name[0]}</p>}
                              {r.number_of_pages_median && <p className="text-xs text-muted-foreground">{r.number_of_pages_median} pages</p>}
                              {isDupe && <p className="text-[11px] font-semibold text-amber-600 mt-0.5">Already in reading list</p>}
                            </div>
                            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer — reading group + confirm */}
            {bookPreview && (
              <div className="px-6 pt-3 pb-6 border-t border-border shrink-0 space-y-3">
                {readingGroups.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Assign to reading group <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <select value={addBookGroupId || ""} onChange={(e) => setAddBookGroupId(e.target.value || null)}
                      className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Whole club</option>
                      {readingGroups.map((rg) => <option key={rg.id} value={rg.id}>{rg.name}</option>)}
                    </select>
                  </div>
                )}
                <button onClick={handleAddBook} disabled={addingBook}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                  {addingBook ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Add to Club
                </button>
              </div>
            )}
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
            <p className="text-sm text-muted-foreground mb-5">Pick the book the whole club will read together.</p>
            {books.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl block mb-3">📚</span>
                <p className="font-semibold mb-1">No books in the club yet</p>
                <p className="text-sm text-muted-foreground mb-4">Add a book to the club first, then start a Group Read.</p>
                <button type="button" onClick={() => { setShowGroupReadSheet(false); setShowAddBook(true); }}
                  className="flex items-center gap-2 mx-auto px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
                  <Plus size={16} />Add a book first
                </button>
              </div>
            ) : (
              <form onSubmit={handleStartGroupRead} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Select a book</label>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {books.map((b) => (
                      <button key={b.id} type="button" onClick={() => setGroupReadBookId(b.id)}
                        className={cn("w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left", groupReadBookId === b.id ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40")}>
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
                  <label className="block text-sm font-semibold mb-1.5">Target finish date <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <input type="date" value={groupReadDate} onChange={(e) => setGroupReadDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <button type="submit" disabled={savingGroupRead || !groupReadBookId}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingGroupRead ? <Loader2 size={16} className="animate-spin" /> : <BookMarked size={16} />}
                  Start Group Read
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Add Reading Group Sheet ── */}
      {showAddGroup && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddGroup(false)} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold">Add Reading Group</h2>
              <button onClick={() => setShowAddGroup(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddReadingGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Group name <span className="text-red-500">*</span></label>
                <input type="text" required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Little Readers, Junior Chapter Books"
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input type="text" value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g. Picture books and early readers"
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Age range <span className="text-muted-foreground font-normal">(optional)</span></label>
                <div className="flex gap-2">
                  <input type="number" value={newGroupAgeMin} onChange={(e) => setNewGroupAgeMin(e.target.value)}
                    placeholder="Min age" min={0} max={99}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                  <input type="number" value={newGroupAgeMax} onChange={(e) => setNewGroupAgeMax(e.target.value)}
                    placeholder="Max age" min={0} max={99}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <button type="submit" disabled={savingGroup || !newGroupName.trim()}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {savingGroup ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
                Add Group
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Join / Request Sheet ── */}
      {showJoinSheet && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowJoinSheet(false)} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl font-bold">{amIMember ? "Add Family Members" : "Request to Join"}</h2>
              <button onClick={() => setShowJoinSheet(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              {amIMember
                ? `Select family members to add to ${club.name}.`
                : `Your request will be sent to the club owner for approval.`}
            </p>
            <div className="space-y-2 mb-5">
              {membersNotInClub.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">All family members are already in or have pending requests for this club.</p>
              ) : (
                membersNotInClub.map((fm) => {
                  const selected = joiningAs.includes(fm.id);
                  return (
                    <button key={fm.id} onClick={() => setJoiningAs((prev) => selected ? prev.filter((x) => x !== fm.id) : [...prev, fm.id])}
                      className={cn("w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left", selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40")}>
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
            <button onClick={handleRequestJoin} disabled={joining || joiningAs.length === 0}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
              {joining ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
              {amIMember ? `Add ${joiningAs.length} member${joiningAs.length !== 1 ? "s" : ""}` : "Send join request"}
            </button>
          </div>
        </div>
      )}

      {/* ── Club Settings Sheet ── */}
      {showSettings && isOwnerOrAdmin && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl p-6 z-10 max-h-[90vh] overflow-y-auto">
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
              <div>
                <label className="block text-sm font-semibold mb-1.5"><MapPin size={13} className="inline mr-1 -mt-0.5 text-muted-foreground" />Location</label>
                <div className="flex gap-2">
                  <input type="text" required value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="City *"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                  <input type="text" value={editSuburb} onChange={(e) => setEditSuburb(e.target.value)} placeholder="Suburb"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{editPublic ? "Public" : "Private / invite-only"}</p>
                  <p className="text-xs text-muted-foreground">{editPublic ? "Anyone can find and request to join." : "Only invite link holders can join."}</p>
                </div>
                <button type="button" onClick={() => setEditPublic(!editPublic)}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${editPublic ? "bg-primary" : "bg-border"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editPublic ? "translate-x-6" : ""}`} />
                </button>
              </div>
              {/* Commenting toggle */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-semibold">Member commenting</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow members to comment on Topics. Off by default for educational clubs.</p>
                </div>
                <button type="button" onClick={() => setEditCommenting(!editCommenting)}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${editCommenting ? "bg-primary" : "bg-border"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editCommenting ? "translate-x-6" : ""}`} />
                </button>
              </div>

              {/* Profanity filter toggle (only shown when commenting on) */}
              {editCommenting && (
                <div>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Profanity filter</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Automatically asterisk-out offensive words in comments. Recommended on.</p>
                    </div>
                    <button type="button" onClick={() => setEditProfanity(!editProfanity)}
                      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${editProfanity ? "bg-primary" : "bg-border"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editProfanity ? "translate-x-6" : ""}`} />
                    </button>
                  </div>
                  {!editProfanity && (
                    <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                      <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">With the filter off, explicit language may appear in comments. Only disable this for appropriate adult groups.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Invite link (bypasses approval)</p>
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

// ── Comment tree helpers ──────────────────────────────────────────────────────

interface CommentNode extends ClubTopicComment {
  children: CommentNode[];
}

function buildCommentTree(flat: ClubTopicComment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: CommentNode[] = [];
  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

interface CommentThreadProps {
  comment: CommentNode;
  depth: number;
  clubCreatedBy: string | null;
  myMemberIds: string[];
  allMembers: FamilyMember[];
  isOwnerOrAdmin: boolean;
  isOwner: boolean;
  blockedMemberIds: string[];
  canComment: boolean;
  canReply: boolean;
  replyingToId: string | null;
  replyText: string;
  submittingComment: boolean;
  onSetReplying: (id: string | null) => void;
  onSetReplyText: (v: string) => void;
  onReply: (parentId: string) => void;
  onDelete: (id: string) => void;
  onBlock: (memberId: string) => void;
  onUnblock: (memberId: string) => void;
}

const MAX_VISUAL_DEPTH = 5;

function CommentThread({
  comment, depth, clubCreatedBy, myMemberIds, allMembers,
  isOwnerOrAdmin, isOwner, blockedMemberIds, canComment, canReply,
  replyingToId, replyText, submittingComment,
  onSetReplying, onSetReplyText, onReply, onDelete, onBlock, onUnblock,
}: CommentThreadProps) {
  const isReplying = replyingToId === comment.id;
  const authorIsOwner = comment.author_id === clubCreatedBy;
  const authorMember = comment.author as FamilyMember | undefined;
  const isMyComment = myMemberIds.includes(comment.author_id);
  const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH);

  return (
    <div style={{ paddingLeft: depth > 0 ? `${Math.min(visualDepth, 4) * 14}px` : 0 }}>
      <div className="relative">
        {/* Thread connector line */}
        {depth > 0 && (
          <div className="absolute left-[-10px] top-0 bottom-0 w-px bg-border/60" />
        )}

        {comment.is_deleted ? (
          <div className="px-3 py-1.5 rounded-lg bg-muted mb-1.5">
            <p className="text-xs text-muted-foreground italic">[comment removed]</p>
          </div>
        ) : (
          <div className={cn(
            "rounded-xl border p-3 mb-1.5",
            authorIsOwner
              ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
              : "bg-card border-border",
          )}>
            <div className="flex items-start gap-2">
              <span className="text-sm shrink-0 mt-0.5">{authorMember?.avatar_emoji || "👤"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-semibold leading-none">{authorMember?.nickname || "Member"}</span>
                  {authorIsOwner && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 leading-none">
                      <Crown size={7} className="inline mr-0.5 -mt-0.5" />Owner
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {new Date(comment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{comment.body}</p>

                {/* Action row */}
                <div className="flex items-center gap-3 mt-1.5">
                  {canReply && depth < MAX_VISUAL_DEPTH && (
                    <button
                      onClick={() => onSetReplying(isReplying ? null : comment.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                    >
                      <CornerDownRight size={11} />
                      {isReplying ? "Cancel" : "Reply"}
                    </button>
                  )}
                  {comment.children.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {comment.children.length} {comment.children.length === 1 ? "reply" : "replies"}
                    </span>
                  )}
                </div>
              </div>

              {/* Owner moderation controls — delete any comment, block/unblock others */}
              {isOwnerOrAdmin && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => onDelete(comment.id)} title="Remove comment"
                    className="p-1 text-muted-foreground hover:text-red-500 rounded transition-colors">
                    <Trash2 size={12} />
                  </button>
                  {!isMyComment && (!blockedMemberIds.includes(comment.author_id) ? (
                    <button onClick={() => onBlock(comment.author_id)} title="Block from commenting"
                      className="p-1 text-muted-foreground hover:text-red-500 rounded transition-colors">
                      <ShieldOff size={12} />
                    </button>
                  ) : (
                    <button onClick={() => onUnblock(comment.author_id)} title="Unblock"
                      className="p-1 text-muted-foreground hover:text-green-600 rounded transition-colors">
                      <UserCheck size={12} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inline reply input */}
        {isReplying && (
          <div className="flex gap-2 mb-2 ml-2">
            <input
              type="text"
              value={replyText}
              autoFocus
              onChange={(e) => onSetReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && replyText.trim()) { e.preventDefault(); onReply(comment.id); } }}
              placeholder={`Reply to ${authorMember?.nickname ?? "member"}…`}
              className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => onReply(comment.id)}
              disabled={submittingComment || !replyText.trim()}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {submittingComment ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </div>
        )}

        {/* Recursive children */}
        {comment.children.length > 0 && (
          <div className="space-y-0">
            {comment.children.map((child) => (
              <CommentThread
                key={child.id}
                comment={child}
                depth={depth + 1}
                clubCreatedBy={clubCreatedBy}
                myMemberIds={myMemberIds}
                allMembers={allMembers}
                isOwnerOrAdmin={isOwnerOrAdmin}
                isOwner={isOwner}
                blockedMemberIds={blockedMemberIds}
                canComment={canComment}
                canReply={canReply}
                replyingToId={replyingToId}
                replyText={replyText}
                submittingComment={submittingComment}
                onSetReplying={onSetReplying}
                onSetReplyText={onSetReplyText}
                onReply={onReply}
                onDelete={onDelete}
                onBlock={onBlock}
                onUnblock={onUnblock}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReadingGroupFilter({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all",
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40")}>
      {label}
    </button>
  );
}

function ClubBookRow({
  book, progress, myMemberIds, allMembers, clubMembers, readingGroup,
  onUpdateProgress, onAddToPersonal, isManager, onRemove,
}: {
  book: ClubBook;
  progress: ProgressEntry[];
  myMemberIds: string[];
  allMembers: FamilyMember[];
  clubMembers: ClubMemberRow[];
  readingGroup?: ReadingGroup;
  onUpdateProgress: (bookId: string, status: "want_to_read" | "reading" | "finished", memberId: string, page?: number) => void;
  onAddToPersonal: (book: ClubBook, memberId: string) => void;
  isManager: boolean;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const finishedCount = progress.filter((p) => p.status === "finished").length;
  const totalMembers = clubMembers.length;
  const pct = totalMembers ? Math.round((finishedCount / totalMembers) * 100) : 0;

  return (
    <div className={cn("bg-card border rounded-2xl overflow-hidden", book.is_current_read ? "border-primary/30" : "border-border")}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors">
        <BookCover src={book.cover_url || undefined} isbn={book.isbn || undefined} title={book.title} className="w-10 h-14 rounded object-cover shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <p className="font-semibold text-sm line-clamp-1">{book.title}</p>
            {book.is_current_read && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">Group Read</span>}
            {readingGroup && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{readingGroup.name}</span>}
          </div>
          {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{finishedCount}/{totalMembers} done</span>
          </div>
          {book.is_current_read && book.read_target_date && (
            <p className="text-[10px] text-primary mt-0.5"><Calendar size={9} className="inline mr-0.5" />Due {new Date(book.read_target_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isManager && (
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {myMemberIds.map((myId) => {
            const fm = allMembers.find((m) => m.id === myId);
            if (!clubMembers.find((cm) => cm.family_member_id === myId)) return null;
            const prg = progress.find((p) => p.member_id === myId);
            return (
              <div key={myId}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{fm?.avatar_emoji || "👤"}</span>
                    <span className="text-xs font-semibold">{fm?.nickname}</span>
                  </div>
                  {/* Add to personal library — explicit action, no auto-sync */}
                  <button onClick={() => onAddToPersonal(book, myId)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5 border border-transparent hover:border-primary/20">
                    <BookmarkPlus size={12} />
                    Add to my library
                  </button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(["want_to_read", "reading", "finished"] as const).map((s) => (
                    <button key={s} onClick={() => onUpdateProgress(book.id, s, myId)}
                      className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors border",
                        prg?.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50")}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                {prg?.status === "reading" && book.page_count && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Page</span>
                    <input type="number" min={0} max={book.page_count} defaultValue={prg.current_page || 0}
                      onBlur={(e) => { const page = Math.min(book.page_count!, Math.max(0, parseInt(e.target.value) || 0)); onUpdateProgress(book.id, "reading", myId, page); }}
                      className="w-20 px-2 py-1 text-xs rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-ring" />
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
