import { useState, useRef } from "react";
import {
  Search, Loader2, BookOpen, Plus, Heart, Check, X, ChevronRight, Users
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import type { FamilyMember } from "../lib/types";

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  first_publish_year?: number;
}

type AddStatus = "idle" | "adding" | "library" | "want";

interface SearchResult extends OLDoc {
  addStatus: AddStatus;
}

export default function SearchPage() {
  const { family, member, allMembers } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const isParent = member ? !member.is_child : false;
  const children = (allMembers as FamilyMember[]).filter((m) => m.is_child);

  // ── Search state ──
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // ── Detail sheet state ──
  const [detailResult, setDetailResult] = useState<SearchResult | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [loadingDesc, setLoadingDesc] = useState(false);

  // ── Member picker state (within detail sheet) ──
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMembers, setPickerMembers] = useState<string[]>([]);
  const [savingFor, setSavingFor] = useState<"library" | "want" | null>(null);

  // ── Search ────────────────────────────────────────────────────────────────

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setResults([]);
    try {
      const isIsbn = /^[0-9]{9,13}[0-9X]?$/.test(q.replace(/[-\s]/g, ""));
      const params = new URLSearchParams({
        limit: "20",
        fields: "key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year",
      });
      if (isIsbn) {
        params.set("isbn", q.replace(/[-\s]/g, ""));
      } else {
        params.set("q", q);
      }
      const res = await fetch(`https://openlibrary.org/search.json?${params}`);
      const data = await res.json();
      const docs: OLDoc[] = (data.docs ?? []).filter((d: OLDoc) => d.title);
      setResults(docs.map((d) => ({ ...d, addStatus: "idle" })));
    } catch {
      toast.error("Search failed — check your connection");
    } finally {
      setSearching(false);
      setHasSearched(true);
    }
  }

  function setResultStatus(key: string, status: AddStatus) {
    setResults((prev) => prev.map((r) => r.key === key ? { ...r, addStatus: status } : r));
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  }

  // ── Detail sheet ──────────────────────────────────────────────────────────

  async function openDetail(result: SearchResult) {
    setDetailResult(result);
    setDescription(null);
    setShowPicker(false);
    setPickerMembers([]);
    setLoadingDesc(true);
    try {
      const res = await fetch(`https://openlibrary.org${result.key}.json`);
      const data = await res.json();
      const desc = data.description;
      if (typeof desc === "string") setDescription(desc);
      else if (desc?.value) setDescription(desc.value as string);
    } catch { /* description optional */ }
    setLoadingDesc(false);
  }

  function closeDetail() {
    setDetailResult(null);
    setShowPicker(false);
  }

  // ── Add book ──────────────────────────────────────────────────────────────

  // Quick add from list card (always for current user only)
  async function quickAdd(result: SearchResult, wantToRead: boolean) {
    if (!member) return;
    await addBook(result, wantToRead ? [member.id] : [], wantToRead);
  }

  // "Want to read" from detail sheet — show picker for parents with children
  function handleWantToRead() {
    if (!detailResult || !member) return;
    if (isParent && children.length > 0) {
      setPickerMembers([member.id]); // default: self selected
      setShowPicker(true);
    } else {
      addBook(detailResult, [member.id], true);
    }
  }

  async function addBook(result: SearchResult, readingMemberIds: string[], wantToRead: boolean) {
    if (!family || !member) return;
    setSavingFor(wantToRead ? "want" : "library");
    // Also mark the card in the list while saving
    setResultStatus(result.key, "adding");
    try {
      const coverUrl = result.cover_i
        ? `https://covers.openlibrary.org/b/id/${result.cover_i}-L.jpg`
        : null;
      const isbn = result.isbn?.find((i) => i.length === 13) ?? result.isbn?.[0] ?? null;

      const { data: book, error } = await supabase
        .from("books")
        .insert({
          family_id: family.id,
          title: result.title,
          author: result.author_name?.[0] ?? null,
          isbn,
          cover_url: coverUrl,
          page_count: result.number_of_pages_median ?? null,
          added_by: member.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (wantToRead && book && readingMemberIds.length > 0) {
        await Promise.all(
          readingMemberIds.map((memberId) =>
            supabase.from("reading_progress").insert({
              book_id: book.id,
              member_id: memberId,
              status: "want_to_read",
              current_page: 0,
            })
          )
        );
      }

      setResultStatus(result.key, wantToRead ? "want" : "library");
      closeDetail();

      if (wantToRead) {
        const names = readingMemberIds.map(
          (id) => (allMembers as FamilyMember[]).find((m) => m.id === id)?.nickname ?? ""
        ).filter(Boolean);
        toast.success(`Added to ${names.length > 1 ? names.join(" & ") + "'s" : (names[0] ?? "your")} reading list!`);
      } else {
        toast.success("Added to library!");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add book");
      setResultStatus(result.key, "idle");
    } finally {
      setSavingFor(null);
    }
  }

  function togglePickerMember(id: string) {
    setPickerMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const detailAdded = detailResult
    ? detailResult.addStatus === "library" || detailResult.addStatus === "want"
    : false;

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-8">
      <h1 className="font-display text-2xl font-bold mb-5">Search Books</h1>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Title, author, or ISBN…"
            className="w-full pl-4 pr-10 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
            autoFocus
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          onClick={doSearch}
          disabled={searching || !query.trim()}
          className="px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>

      {/* Searching */}
      {searching && (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="text-sm font-medium">Searching Open Library…</p>
        </div>
      )}

      {/* Pre-search empty state */}
      {!searching && !hasSearched && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📖</div>
          <p className="font-display font-bold text-xl mb-1">Find your next adventure</p>
          <p className="text-sm text-muted-foreground">Search by title, author name, or ISBN</p>
        </div>
      )}

      {/* No results */}
      {!searching && hasSearched && results.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <p className="font-display font-bold text-xl mb-1">No books found</p>
          <p className="text-sm text-muted-foreground">Try a different title, author, or ISBN</p>
        </div>
      )}

      {/* Results list */}
      {!searching && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium px-1">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          {results.map((result) => {
            const coverUrl = result.cover_i
              ? `https://covers.openlibrary.org/b/id/${result.cover_i}-M.jpg`
              : null;
            const isAdded = result.addStatus === "library" || result.addStatus === "want";
            const isAdding = result.addStatus === "adding";

            return (
              <div key={result.key} className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Tappable area → opens detail */}
                <button
                  onClick={() => openDetail(result)}
                  className="w-full flex gap-4 p-4 text-left hover:bg-secondary/40 transition-colors"
                >
                  <div className="w-14 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-secondary flex items-center justify-center">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={result.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <BookOpen size={18} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight line-clamp-2 mb-0.5">
                      {result.title}
                    </p>
                    {result.author_name?.[0] && (
                      <p className="text-xs text-muted-foreground truncate">
                        {result.author_name[0]}
                        {result.first_publish_year ? ` · ${result.first_publish_year}` : ""}
                      </p>
                    )}
                    {result.number_of_pages_median && (
                      <p className="text-xs text-muted-foreground">{result.number_of_pages_median} pages</p>
                    )}
                    <p className="text-xs text-primary font-medium mt-1.5 flex items-center gap-0.5">
                      View details <ChevronRight size={11} />
                    </p>
                  </div>
                  {isAdded && (
                    <Check size={16} className="text-primary flex-shrink-0 mt-1" />
                  )}
                </button>

                {/* Quick-add actions */}
                {!isAdded && (
                  <div className="flex gap-2 px-4 pb-3 border-t border-border/50 pt-2.5">
                    <button
                      onClick={() => quickAdd(result, false)}
                      disabled={isAdding}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-60 hover:opacity-90 transition-opacity"
                    >
                      {isAdding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                      Add to library
                    </button>
                    <button
                      onClick={() => quickAdd(result, true)}
                      disabled={isAdding}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold disabled:opacity-60 hover:bg-muted transition-colors"
                    >
                      <Heart size={11} />
                      Want to read
                    </button>
                  </div>
                )}
                {isAdded && (
                  <p className="px-4 pb-3 text-xs text-primary font-semibold flex items-center gap-1.5">
                    <Check size={12} />
                    {result.addStatus === "want" ? "On reading list" : "In library"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detail Sheet ── */}
      <Dialog.Root open={!!detailResult} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl border-t border-border max-w-lg mx-auto max-h-[90vh] flex flex-col">
            {detailResult && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
                  <Dialog.Title className="font-display font-bold text-lg">Book details</Dialog.Title>
                  <Dialog.Close className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </Dialog.Close>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
                  {/* Cover + title row */}
                  <div className="flex gap-4">
                    <div className="w-24 h-36 flex-shrink-0 rounded-xl overflow-hidden bg-secondary flex items-center justify-center shadow-md">
                      {detailResult.cover_i ? (
                        <img
                          src={`https://covers.openlibrary.org/b/id/${detailResult.cover_i}-L.jpg`}
                          alt={detailResult.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <BookOpen size={28} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display font-bold text-xl leading-tight">{detailResult.title}</h2>
                      {detailResult.author_name?.[0] && (
                        <p className="text-muted-foreground mt-1">by {detailResult.author_name[0]}</p>
                      )}
                      {/* Metadata pills */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {detailResult.first_publish_year && (
                          <span className="px-2.5 py-1 rounded-lg bg-secondary text-xs font-semibold text-muted-foreground">
                            {detailResult.first_publish_year}
                          </span>
                        )}
                        {detailResult.number_of_pages_median && (
                          <span className="px-2.5 py-1 rounded-lg bg-secondary text-xs font-semibold text-muted-foreground">
                            {detailResult.number_of_pages_median} pages
                          </span>
                        )}
                        {detailResult.isbn?.[0] && (
                          <span className="px-2.5 py-1 rounded-lg bg-secondary text-xs font-semibold text-muted-foreground font-mono">
                            {detailResult.isbn.find((i) => i.length === 13) ?? detailResult.isbn[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {loadingDesc && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                      Loading description…
                    </div>
                  )}
                  {!loadingDesc && description && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">About</p>
                      <p className="text-sm text-foreground leading-relaxed line-clamp-6">{description}</p>
                    </div>
                  )}

                  {/* ── Action buttons ── */}
                  {detailAdded ? (
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Check size={15} />
                      {detailResult.addStatus === "want" ? "On your reading list" : "In your library"}
                    </div>
                  ) : !showPicker ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => addBook(detailResult, [], false)}
                        disabled={!!savingFor}
                        className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-opacity"
                      >
                        {savingFor === "library"
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Plus size={15} />
                        }
                        Add to library
                      </button>
                      <button
                        onClick={handleWantToRead}
                        disabled={!!savingFor}
                        className="flex-1 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-muted transition-colors"
                      >
                        {savingFor === "want"
                          ? <Loader2 size={15} className="animate-spin" />
                          : isParent && children.length > 0
                            ? <Users size={15} />
                            : <Heart size={15} />
                        }
                        Want to read
                      </button>
                    </div>
                  ) : (
                    /* ── Member picker ── */
                    <div className="bg-secondary rounded-2xl p-4 space-y-3">
                      <p className="font-semibold text-sm flex items-center gap-2">
                        <Users size={15} className="text-primary" />
                        Who is this for?
                      </p>
                      <div className="space-y-2">
                        {/* Self */}
                        {member && (
                          <MemberPickerRow
                            m={member as FamilyMember}
                            isYou
                            selected={pickerMembers.includes(member.id)}
                            onToggle={() => togglePickerMember(member.id)}
                          />
                        )}
                        {/* Children */}
                        {children.map((child) => (
                          <MemberPickerRow
                            key={child.id}
                            m={child}
                            selected={pickerMembers.includes(child.id)}
                            onToggle={() => togglePickerMember(child.id)}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setShowPicker(false)}
                          className="flex-1 py-2.5 rounded-xl bg-card text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => addBook(detailResult, pickerMembers, true)}
                          disabled={pickerMembers.length === 0 || !!savingFor}
                          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                          {savingFor === "want"
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Check size={14} />
                          }
                          Add{pickerMembers.length > 0 ? ` (${pickerMembers.length})` : ""}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// ─── Member picker row ────────────────────────────────────────────────────────

function MemberPickerRow({
  m, isYou = false, selected, onToggle,
}: {
  m: FamilyMember;
  isYou?: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
        selected ? "bg-primary/10 border border-primary/30" : "bg-card border border-border hover:border-primary/20"
      }`}
    >
      <span className="text-2xl">{m.avatar_emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">
          {m.nickname}
          {isYou && (
            <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
              you
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{m.role}</p>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        selected ? "bg-primary border-primary" : "border-border"
      }`}>
        {selected && <Check size={11} className="text-primary-foreground" />}
      </div>
    </button>
  );
}
