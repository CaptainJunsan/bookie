import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Plus, X, Loader2, MapPin, ChevronRight, GraduationCap, ShieldCheck, BookOpen,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { School, SchoolRole } from "../lib/types";
import { toast } from "sonner";

const SCHOOL_EMOJIS = ["🏫", "🎓", "📚", "🍎", "✏️", "🧑‍🏫", "🏆", "🌟"];

interface SchoolWithMeta extends School {
  my_role: SchoolRole | null; // staff role, if any
  is_parent: boolean;         // has an enrolled child here, whether or not also staff
}

export default function SchoolsPage() {
  const { member, allMembers } = useAuth();
  const navigate = useNavigate();

  const [schools, setSchools] = useState<SchoolWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createCity, setCreateCity] = useState("");
  const [createSuburb, setCreateSuburb] = useState("");
  const [createEmoji, setCreateEmoji] = useState("🏫");

  const myMemberIds = allMembers.map((m) => m.id);

  useEffect(() => { loadSchools(); }, [member]);

  async function loadSchools() {
    if (!member) return;
    setLoading(true);
    try {
      const [staffRes, learnerRes] = await Promise.all([
        supabase.from("school_members").select("school_id, role").in("family_member_id", myMemberIds),
        supabase.from("class_learners").select("school_id").in("family_member_id", myMemberIds),
      ]);

      const staffRows = staffRes.data ?? [];
      const learnerSchoolIds = new Set((learnerRes.data ?? []).map((r) => r.school_id));
      const roleBySchool: Record<string, SchoolRole> = {};
      staffRows.forEach((r) => { roleBySchool[r.school_id] = r.role as SchoolRole; });

      const allIds = [...new Set([...staffRows.map((r) => r.school_id), ...learnerSchoolIds])];
      if (allIds.length === 0) { setSchools([]); setLoading(false); return; }

      const { data } = await supabase.from("schools").select("*").in("id", allIds).order("created_at", { ascending: false });
      setSchools(
        (data ?? []).map((s) => ({
          ...s,
          my_role: roleBySchool[s.id] ?? null,
          is_parent: learnerSchoolIds.has(s.id),
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setCreateName(""); setCreateDesc(""); setCreateCity(""); setCreateSuburb(""); setCreateEmoji("🏫");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!member || !createName.trim() || !createCity.trim()) return;
    setCreating(true);
    try {
      const { data: school, error } = await supabase
        .from("schools")
        .insert({
          name: createName.trim(),
          description: createDesc.trim() || null,
          emoji: createEmoji,
          city: createCity.trim(),
          suburb: createSuburb.trim() || null,
          created_by: member.id,
        })
        .select().single();
      if (error) throw error;

      // Creator becomes the first admin
      const { error: memberError } = await supabase
        .from("school_members")
        .insert({ school_id: school.id, family_member_id: member.id, role: "admin" });
      if (memberError) throw memberError;

      toast.success(`${createEmoji} ${school.name} created!`);
      setShowCreate(false);
      resetForm();
      navigate(`/schools/${school.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create school");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 lg:py-10 pb-28 lg:pb-10">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Schools</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Set up your school, or manage the ones you're part of</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-school text-school-foreground text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={16} />
            New school
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="text-school animate-spin" />
          </div>
        ) : schools.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl px-5 py-10 text-center">
            <span className="text-4xl mb-3 block">🏫</span>
            <p className="font-semibold text-foreground mb-1">No schools yet</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              If your child's school is already on Bookie, ask their teacher for a class code instead — head to Explore and tap "Enter class code."
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {schools.map((school) => <SchoolCard key={school.id} school={school} onClick={() => navigate(`/schools/${school.id}`)} />)}
          </div>
        )}
      </div>

      {/* ── Create School Sheet ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl z-10 flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <h2 className="font-display text-xl font-bold">Set up a school</h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form id="create-school-form" onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2">School emoji</label>
                  <div className="flex flex-wrap gap-2">
                    {SCHOOL_EMOJIS.map((e) => (
                      <button key={e} type="button" onClick={() => setCreateEmoji(e)}
                        className={`w-10 h-10 text-xl rounded-xl flex items-center justify-center transition-all ${createEmoji === e ? "bg-school/15 ring-2 ring-school" : "bg-muted hover:bg-secondary"}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1.5">School name <span className="text-red-500">*</span></label>
                  <input type="text" required value={createName} onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Sunnydale Primary" maxLength={80}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1.5">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)}
                    placeholder="A short line about your school" rows={2} maxLength={200}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>

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

                <div className="flex items-start gap-2.5 p-3 bg-muted rounded-xl text-xs text-muted-foreground leading-relaxed">
                  <ShieldCheck size={15} className="text-school shrink-0 mt-0.5" />
                  <p>You'll be the school's first admin. You can add grades, classes, and other teachers or admins once it's set up.</p>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-border shrink-0">
              <button form="create-school-form" type="submit" disabled={creating || !createName.trim() || !createCity.trim()}
                className="w-full py-3 rounded-xl bg-school text-school-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {creating ? <Loader2 size={16} className="animate-spin" /> : <GraduationCap size={16} />}
                {creating ? "Setting up…" : "Create school"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SchoolCard({ school, onClick }: { school: SchoolWithMeta; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-school/40 hover:bg-school/5 transition-all text-left group">
      <span className="text-3xl shrink-0">{school.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">{school.name}</span>
          {school.my_role === "admin" && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">Admin</span>
          )}
          {school.my_role === "teacher" && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">Teacher</span>
          )}
          {school.is_parent && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-school/10 text-school shrink-0">
              <BookOpen size={9} className="inline mr-0.5 -mt-0.5" />Parent
            </span>
          )}
        </div>
        {school.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{school.description}</p>}
        {school.city && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
            <MapPin size={11} />
            {school.suburb ? `${school.suburb}, ${school.city}` : school.city}
          </span>
        )}
      </div>
      <ChevronRight size={16} className="text-muted-foreground group-hover:text-school transition-colors shrink-0" />
    </button>
  );
}
