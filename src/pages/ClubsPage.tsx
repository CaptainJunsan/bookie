import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Search, Plus, Users, Globe, Lock, ChevronRight,
  X, Loader2, Check, BookOpen, MapPin, Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { Club, ClubRole } from "../lib/types";
import { toast } from "sonner";
import { cn } from "../app/components/ui/utils";

const CLUB_EMOJIS = ["📖","📚","🔖","🌟","🦉","🦋","🌱","🏡","🎯","🌈","🧩","🎨","🌍","🧠","🎭"];

interface ClubWithMeta extends Club {
  member_count: number;
  my_role?: ClubRole;
  i_am_member: boolean;
}

interface DraftGroup {
  name: string;
  description: string;
  age_min: string;
  age_max: string;
}

const blankGroup = (): DraftGroup => ({ name: "", description: "", age_min: "", age_max: "" });

export default function ClubsPage() {
  const { member, allMembers } = useAuth();
  const navigate = useNavigate();

  const [myClubs, setMyClubs] = useState<ClubWithMeta[]>([]);
  const [publicClubs, setPublicClubs] = useState<ClubWithMeta[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClubWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create club state
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createCity, setCreateCity] = useState("");
  const [createSuburb, setCreateSuburb] = useState("");
  const [createEmoji, setCreateEmoji] = useState("📖");
  const [createPublic, setCreatePublic] = useState(true);
  const [createClubType, setCreateClubType] = useState<"social" | "educational">("educational");
  const [draftGroups, setDraftGroups] = useState<DraftGroup[]>([blankGroup()]);
  const [creating, setCreating] = useState(false);

  const myMemberIds = allMembers.map((m) => m.id);

  useEffect(() => { loadClubs(); }, [member]);

  async function loadClubs() {
    if (!member) return;
    setLoading(true);
    try {
      const { data: myRows } = await supabase
        .from("club_members")
        .select("club_id, role, family_member_id")
        .in("family_member_id", myMemberIds);

      const myClubIds = [...new Set((myRows || []).map((r) => r.club_id))];

      if (myClubIds.length) {
        const { data: clubs } = await supabase
          .from("clubs").select("*").in("id", myClubIds)
          .order("created_at", { ascending: false });
        setMyClubs(await enrichClubs(clubs || [], myRows || [], myClubIds));
      } else {
        setMyClubs([]);
      }

      const { data: pub } = await supabase
        .from("clubs").select("*").eq("is_public", true)
        .not("id", "in", `(${myClubIds.join(",") || "null"})`)
        .order("created_at", { ascending: false }).limit(20);
      setPublicClubs(await enrichClubs(pub || [], [], []));
    } finally {
      setLoading(false);
    }
  }

  async function enrichClubs(
    clubs: Club[],
    myRows: { club_id: string; role: ClubRole; family_member_id: string }[],
    myClubIds: string[],
  ): Promise<ClubWithMeta[]> {
    if (!clubs.length) return [];
    const ids = clubs.map((c) => c.id);
    const { data: counts } = await supabase.from("club_members").select("club_id").in("club_id", ids);
    const countMap: Record<string, number> = {};
    (counts || []).forEach((r) => { countMap[r.club_id] = (countMap[r.club_id] || 0) + 1; });
    return clubs.map((c) => {
      const myRow = myRows.find((r) => r.club_id === c.id);
      return { ...c, member_count: countMap[c.id] || 0, my_role: myRow?.role as ClubRole | undefined, i_am_member: myClubIds.includes(c.id) };
    });
  }

  // Search with 350ms debounce — by name, city, or suburb
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchRef.current) clearTimeout(searchRef.current);
    setSearching(true);
    searchRef.current = setTimeout(async () => {
      const q = `%${searchQuery}%`;
      const { data } = await supabase
        .from("clubs").select("*").eq("is_public", true)
        .or(`name.ilike.${q},city.ilike.${q},suburb.ilike.${q}`)
        .limit(20);
      setSearchResults(await enrichClubs(data || [], [], myClubs.map((c) => c.id)));
      setSearching(false);
    }, 350);
  }, [searchQuery]);

  function addGroup() { setDraftGroups((prev) => [...prev, blankGroup()]); }
  function removeGroup(i: number) { setDraftGroups((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateGroup(i: number, field: keyof DraftGroup, val: string) {
    setDraftGroups((prev) => prev.map((g, idx) => idx === i ? { ...g, [field]: val } : g));
  }

  function resetForm() {
    setCreateName(""); setCreateDesc(""); setCreateCity(""); setCreateSuburb("");
    setCreateEmoji("📖"); setCreatePublic(true); setCreateClubType("educational"); setDraftGroups([blankGroup()]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!member || !createName.trim() || !createCity.trim()) return;

    const validGroups = draftGroups.filter((g) => g.name.trim());
    if (createClubType === "educational" && validGroups.length === 0) {
      toast.error("Add at least one reading group (e.g. \"Little Readers 0–3\")");
      return;
    }

    setCreating(true);
    try {
      const { data: club, error } = await supabase
        .from("clubs")
        .insert({
          name: createName.trim(),
          description: createDesc.trim() || null,
          emoji: createEmoji,
          is_public: createPublic,
          city: createCity.trim(),
          suburb: createSuburb.trim() || null,
          created_by: member.id,
          club_type: createClubType,
          commenting_enabled: createClubType === "social",
          profanity_filter: true,
        })
        .select().single();
      if (error) throw error;

      // Creator as owner
      await supabase.from("club_members").insert({ club_id: club.id, family_member_id: member.id, role: "owner" });

      // Create reading groups (required for educational, optional for social)
      if (validGroups.length) {
        await supabase.from("reading_groups").insert(
          validGroups.map((g) => ({
            club_id: club.id,
            name: g.name.trim(),
            description: g.description.trim() || null,
            age_min: g.age_min ? parseInt(g.age_min) : null,
            age_max: g.age_max ? parseInt(g.age_max) : null,
          })),
        );
      }

      toast.success(`${createEmoji} ${club.name} created!`);
      setShowCreate(false);
      resetForm();
      navigate(`/clubs/${club.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create club");
    } finally {
      setCreating(false);
    }
  }

  const displayedPublic = searchQuery.trim() ? searchResults : publicClubs;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 lg:py-10 pb-28 lg:pb-10">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Reading Clubs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Read together, beyond the family</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={16} />
            New Club
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by club name, city, or suburb…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {searching && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="text-primary animate-spin" />
          </div>
        ) : (
          <>
            {!searchQuery.trim() && (
              <section className="mb-8">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">My Clubs</h2>
                {myClubs.length === 0 ? (
                  <div className="bg-card border border-border rounded-2xl px-5 py-8 text-center">
                    <span className="text-4xl mb-3 block">📖</span>
                    <p className="font-semibold text-foreground mb-1">No clubs yet</p>
                    <p className="text-sm text-muted-foreground">Create a club or search for one to join.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myClubs.map((club) => <ClubCard key={club.id} club={club} onClick={() => navigate(`/clubs/${club.id}`)} />)}
                  </div>
                )}
              </section>
            )}

            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                {searchQuery.trim() ? "Search Results" : "Browse Public Clubs"}
              </h2>
              {displayedPublic.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl px-5 py-8 text-center">
                  <span className="text-4xl mb-3 block">🔍</span>
                  <p className="font-semibold text-foreground mb-1">
                    {searchQuery.trim() ? "No clubs found" : "Nothing to browse yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery.trim() ? "Try a different search term." : "Be the first to create a public club!"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedPublic.map((club) => <ClubCard key={club.id} club={club} onClick={() => navigate(`/clubs/${club.id}`)} />)}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Create Club Sheet ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl z-10 flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <h2 className="font-display text-xl font-bold">Start a Reading Club</h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form id="create-club-form" onSubmit={handleCreate} className="space-y-5">

                {/* Club type */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Club type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["educational", "social"] as const).map((type) => (
                      <button key={type} type="button" onClick={() => setCreateClubType(type)}
                        className={cn("p-3 rounded-xl border-2 text-left transition-all", createClubType === type ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/30")}>
                        <p className="font-bold text-sm">{type === "educational" ? "📚 Educational" : "💬 Social"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {type === "educational" ? "Age-based reading groups, no comments by default" : "Book club with discussions and topic threads"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emoji */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Club emoji</label>
                  <div className="flex flex-wrap gap-2">
                    {CLUB_EMOJIS.map((e) => (
                      <button key={e} type="button" onClick={() => setCreateEmoji(e)}
                        className={cn("w-10 h-10 text-xl rounded-xl flex items-center justify-center transition-all", createEmoji === e ? "bg-primary/15 ring-2 ring-primary" : "bg-muted hover:bg-secondary")}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Club name <span className="text-red-500">*</span></label>
                  <input type="text" required value={createName} onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. The Page Turners" maxLength={60}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)}
                    placeholder="What kind of books does your club read?" rows={2} maxLength={200}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">
                    <MapPin size={13} className="inline mr-1 -mt-0.5 text-muted-foreground" />
                    Location <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input type="text" required value={createCity} onChange={(e) => setCreateCity(e.target.value)}
                      placeholder="City *" maxLength={80}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                    <input type="text" value={createSuburb} onChange={(e) => setCreateSuburb(e.target.value)}
                      placeholder="Suburb" maxLength={80}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>

                {/* Reading groups */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold">
                      Reading groups {createClubType === "educational" ? <span className="text-red-500">*</span> : <span className="text-muted-foreground font-normal">(optional)</span>}
                    </label>
                    <button type="button" onClick={addGroup}
                      className="flex items-center gap-1 text-xs text-primary font-semibold hover:opacity-75 transition-opacity">
                      <Plus size={13} />
                      Add group
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {createClubType === "educational"
                      ? "Define age-based groups (e.g. \"Little Readers 0–3\", \"Junior 6–9\", \"Adult Fiction\")."
                      : "Optionally organise members by age group. Leave empty for a general social book club."}
                  </p>
                  <div className="space-y-3">
                    {draftGroups.map((g, i) => (
                      <div key={i} className="p-3 bg-muted rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={g.name} onChange={(e) => updateGroup(i, "name", e.target.value)}
                            placeholder={`Group name *  (e.g. Little Readers)`} maxLength={60}
                            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                          {draftGroups.length > 1 && (
                            <button type="button" onClick={() => removeGroup(i)}
                              className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-lg">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <input type="text" value={g.description} onChange={(e) => updateGroup(i, "description", e.target.value)}
                          placeholder="Description (optional)" maxLength={120}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                        <div className="flex gap-2">
                          <input type="number" value={g.age_min} onChange={(e) => updateGroup(i, "age_min", e.target.value)}
                            placeholder="Min age" min={0} max={99}
                            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                          <input type="number" value={g.age_max} onChange={(e) => updateGroup(i, "age_max", e.target.value)}
                            placeholder="Max age" min={0} max={99}
                            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visibility */}
                <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{createPublic ? "Public club" : "Private / invite-only"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {createPublic ? "Anyone can find and request to join." : "Only people with your invite link can join."}
                    </p>
                  </div>
                  <button type="button" onClick={() => setCreatePublic(!createPublic)}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${createPublic ? "bg-primary" : "bg-border"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${createPublic ? "translate-x-6" : ""}`} />
                  </button>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-border shrink-0">
              <button form="create-club-form" type="submit" disabled={creating || !createName.trim() || !createCity.trim()}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {creating ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                {creating ? "Creating…" : "Create Club!"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClubCard({ club, onClick }: { club: ClubWithMeta; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-primary/40 hover:bg-primary/5 transition-all text-left group">
      <span className="text-3xl shrink-0">{club.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">{club.name}</span>
          {club.my_role === "owner" && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">Owner</span>
          )}
          {club.my_role === "admin" && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">Admin</span>
          )}
          {club.i_am_member && !club.my_role && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
              <Check size={9} className="inline mr-0.5 -mt-0.5" />Member
            </span>
          )}
        </div>
        {club.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{club.description}</p>}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users size={11} />
            {club.member_count} member{club.member_count !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {club.is_public ? <Globe size={11} /> : <Lock size={11} />}
            {club.is_public ? "Public" : "Private"}
          </span>
          {club.city && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={11} />
              {club.suburb ? `${club.suburb}, ${club.city}` : club.city}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}
