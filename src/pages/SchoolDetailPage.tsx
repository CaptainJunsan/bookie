import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Plus, Copy, Check, Loader2, Trash2, GraduationCap,
  Users, ClipboardList, ChevronRight, ChevronDown, X, KeyRound, UserPlus,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { School, SchoolMember, Grade, SchoolClass, ClassLearner, FamilyMember, SchoolRole } from "../lib/types";
import { toast } from "sonner";
import { APP_URL } from "../lib/shareCard";
import { cn } from "../app/components/ui/utils";

type Tab = "grades" | "staff" | "roster";

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { allMembers } = useAuth();
  const navigate = useNavigate();

  const [school, setSchool] = useState<School | null>(null);
  const [myRole, setMyRole] = useState<SchoolRole | null>(null);
  const [myTeachingClassIds, setMyTeachingClassIds] = useState<string[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [staff, setStaff] = useState<Array<SchoolMember & { family_member?: FamilyMember }>>([]);
  const [learnersByClass, setLearnersByClass] = useState<Record<string, ClassLearner[]>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("grades");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const isAdmin = myRole === "admin";
  const isStaff = myRole !== null;
  const myMemberIds = allMembers.map((m) => m.id);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [schoolRes, myStaffRes, gradesRes, classesRes, staffRes] = await Promise.all([
        supabase.from("schools").select("*").eq("id", id).single(),
        supabase.from("school_members").select("*").eq("school_id", id).in("family_member_id", myMemberIds),
        supabase.from("grades").select("*").eq("school_id", id).order("order_index"),
        supabase.from("classes").select("*").eq("school_id", id),
        supabase.from("school_members").select("*, family_member:family_members(*)").eq("school_id", id),
      ]);

      setSchool(schoolRes.data as School);
      const myRows = myStaffRes.data ?? [];
      setMyRole(myRows.some((r) => r.role === "admin") ? "admin" : myRows.length ? "teacher" : null);
      setMyTeachingClassIds(myRows.filter((r) => r.class_id).map((r) => r.class_id));
      setGrades((gradesRes.data as Grade[]) ?? []);
      setClasses((classesRes.data as SchoolClass[]) ?? []);
      setStaff((staffRes.data as Array<SchoolMember & { family_member?: FamilyMember }>) ?? []);

      const classIds = (classesRes.data ?? []).map((c) => c.id);
      if (classIds.length) {
        const { data: learners } = await supabase.from("class_learners").select("*").in("class_id", classIds);
        const grouped: Record<string, ClassLearner[]> = {};
        (learners as ClassLearner[] ?? []).forEach((l) => {
          (grouped[l.class_id] ??= []).push(l);
        });
        setLearnersByClass(grouped);
      }
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode((k) => (k === key ? null : k)), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="text-school animate-spin" />
      </div>
    );
  }

  if (!school) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-5">
        <span className="text-4xl">🏫</span>
        <p className="font-semibold">School not found</p>
        <button onClick={() => navigate("/schools")} className="text-sm text-primary font-semibold hover:underline">Back to Schools</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate("/schools")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </button>
          <span className="text-xl">{school.emoji}</span>
          <div className="min-w-0">
            <p className="font-display font-bold text-sm truncate">{school.name}</p>
            {school.city && <p className="text-[11px] text-muted-foreground truncate">{school.suburb ? `${school.suburb}, ${school.city}` : school.city}</p>}
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 flex gap-1 border-t border-border">
          {([
            { key: "grades", label: "Grades & Classes", icon: <GraduationCap size={14} /> },
            { key: "staff", label: "Staff", icon: <Users size={14} /> },
            { key: "roster", label: "Roster", icon: <ClipboardList size={14} /> },
          ] as { key: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-colors",
                tab === t.key ? "border-school text-school" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 lg:pb-10">
        {tab === "grades" && (
          <GradesTab
            schoolId={school.id}
            isAdmin={isAdmin}
            grades={grades}
            classes={classes}
            copiedCode={copiedCode}
            onCopy={copyToClipboard}
            onReload={load}
            onOpenRoster={() => setTab("roster")}
          />
        )}
        {tab === "staff" && (
          <StaffTab
            schoolId={school.id}
            isAdmin={isAdmin}
            staff={staff}
            classes={classes}
            grades={grades}
            copiedCode={copiedCode}
            onCopy={copyToClipboard}
            onReload={load}
          />
        )}
        {tab === "roster" && (
          <RosterTab
            classes={classes}
            grades={grades}
            learnersByClass={learnersByClass}
            isAdmin={isAdmin}
            isStaff={isStaff}
            myTeachingClassIds={myTeachingClassIds}
            schoolId={school.id}
            copiedCode={copiedCode}
            onCopy={copyToClipboard}
            onReload={load}
          />
        )}
      </div>
    </div>
  );
}

// ─── Grades & Classes ───────────────────────────────────────────────────────

function GradesTab({
  schoolId, isAdmin, grades, classes, copiedCode, onCopy, onReload, onOpenRoster,
}: {
  schoolId: string; isAdmin: boolean; grades: Grade[]; classes: SchoolClass[];
  copiedCode: string | null; onCopy: (text: string, key: string) => void; onReload: () => void;
  onOpenRoster: () => void;
}) {
  const [addingGrade, setAddingGrade] = useState(false);
  const [newGradeName, setNewGradeName] = useState("");
  const [addingClassFor, setAddingClassFor] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDeleteGrade, setConfirmDeleteGrade] = useState<string | null>(null);
  const [confirmDeleteClass, setConfirmDeleteClass] = useState<string | null>(null);

  async function addGrade() {
    if (!newGradeName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("grades").insert({
      school_id: schoolId, name: newGradeName.trim(), order_index: grades.length,
    });
    setSaving(false);
    if (error) { toast.error("Could not add grade"); return; }
    setNewGradeName(""); setAddingGrade(false);
    onReload();
  }

  async function addClass(gradeId: string) {
    if (!newClassName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("classes").insert({
      school_id: schoolId, grade_id: gradeId, name: newClassName.trim(),
    });
    setSaving(false);
    if (error) { toast.error("Could not add class"); return; }
    setNewClassName(""); setAddingClassFor(null);
    onReload();
  }

  async function deleteGrade(gradeId: string) {
    await supabase.from("grades").delete().eq("id", gradeId);
    setConfirmDeleteGrade(null);
    onReload();
  }

  async function deleteClass(classId: string) {
    await supabase.from("classes").delete().eq("id", classId);
    setConfirmDeleteClass(null);
    onReload();
  }

  if (grades.length === 0 && !isAdmin) {
    return (
      <div className="bg-card border border-border rounded-2xl px-5 py-10 text-center">
        <span className="text-4xl mb-3 block">📋</span>
        <p className="font-semibold text-foreground mb-1">No grades set up yet</p>
        <p className="text-sm text-muted-foreground">Ask a school admin to add grades and classes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grades.map((grade) => {
        const gradeClasses = classes.filter((c) => c.grade_id === grade.id);
        const isOpen = expanded[grade.id] ?? true;
        return (
          <div key={grade.id} className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpanded((e) => ({ ...e, [grade.id]: !isOpen }))}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <span className="font-display font-bold text-sm">{grade.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{gradeClasses.length} class{gradeClasses.length !== 1 ? "es" : ""}</span>
                {isOpen ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-2">
                {gradeClasses.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <button
                        onClick={() => onCopy(`${APP_URL}/join/${c.join_code}`, `class-${c.id}`)}
                        className="flex items-center gap-1.5 text-xs text-school font-semibold mt-0.5 hover:underline"
                      >
                        <KeyRound size={11} /> Code: {c.join_code}
                        {copiedCode === `class-${c.id}` ? <Check size={11} /> : <Copy size={11} />}
                      </button>
                    </div>
                    <button onClick={onOpenRoster} className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1">
                      Roster <ChevronRight size={13} />
                    </button>
                    {isAdmin && (
                      confirmDeleteClass === c.id ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => deleteClass(c.id)} className="text-[11px] font-bold text-destructive px-2 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20">Delete</button>
                          <button onClick={() => setConfirmDeleteClass(null)} className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-lg bg-muted">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteClass(c.id)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 size={13} />
                        </button>
                      )
                    )}
                  </div>
                ))}

                {isAdmin && (
                  addingClassFor === grade.id ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus value={newClassName} onChange={(e) => setNewClassName(e.target.value)}
                        placeholder="Class name (e.g. 4A)" maxLength={40}
                        className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button onClick={() => addClass(grade.id)} disabled={saving} className="px-3 py-2 rounded-lg bg-school text-school-foreground text-xs font-bold">Add</button>
                      <button onClick={() => { setAddingClassFor(null); setNewClassName(""); }} className="px-2 text-muted-foreground"><X size={16} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingClassFor(grade.id)}
                      className="w-full py-2 rounded-xl border-2 border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-school hover:text-school transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus size={13} /> Add a class
                    </button>
                  )
                )}

                {isAdmin && (
                  confirmDeleteGrade === grade.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">Delete {grade.name} and all its classes?</span>
                      <button onClick={() => deleteGrade(grade.id)} className="text-[11px] font-bold text-destructive px-2 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20">Delete</button>
                      <button onClick={() => setConfirmDeleteGrade(null)} className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-lg bg-muted">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteGrade(grade.id)} className="text-[11px] text-muted-foreground hover:text-destructive">
                      Remove {grade.name}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}

      {isAdmin && (
        addingGrade ? (
          <div className="flex gap-2">
            <input
              autoFocus value={newGradeName} onChange={(e) => setNewGradeName(e.target.value)}
              placeholder="Grade name (e.g. Grade 4)" maxLength={40}
              className="flex-1 px-3 py-2.5 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button onClick={addGrade} disabled={saving} className="px-4 py-2.5 rounded-xl bg-school text-school-foreground text-sm font-bold">
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Add"}
            </button>
            <button onClick={() => { setAddingGrade(false); setNewGradeName(""); }} className="px-3 text-muted-foreground"><X size={18} /></button>
          </div>
        ) : (
          <button
            onClick={() => setAddingGrade(true)}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-school hover:text-school transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add a grade
          </button>
        )
      )}
    </div>
  );
}

// ─── Staff ──────────────────────────────────────────────────────────────────

function StaffTab({
  schoolId, isAdmin, staff, classes, grades, copiedCode, onCopy, onReload,
}: {
  schoolId: string; isAdmin: boolean; staff: Array<SchoolMember & { family_member?: FamilyMember }>;
  classes: SchoolClass[]; grades: Grade[]; copiedCode: string | null;
  onCopy: (text: string, key: string) => void; onReload: () => void;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<SchoolRole>("teacher");
  const [inviteClassId, setInviteClassId] = useState<string>("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function createInvite() {
    setSaving(true);
    const { data, error } = await supabase.from("school_staff_invites").insert({
      school_id: schoolId,
      role: inviteRole,
      class_id: inviteRole === "teacher" && inviteClassId ? inviteClassId : null,
    }).select().single();
    setSaving(false);
    if (error) { toast.error("Could not create invite"); return; }
    setGeneratedCode(data.code);
  }

  async function removeStaff(memberId: string) {
    await supabase.from("school_members").delete().eq("id", memberId);
    setConfirmRemove(null);
    onReload();
  }

  function closeInvite() {
    setShowInvite(false);
    setGeneratedCode(null);
    setInviteClassId("");
    setInviteRole("teacher");
  }

  const classLabel = (classId: string | null) => {
    if (!classId) return null;
    const c = classes.find((x) => x.id === classId);
    if (!c) return null;
    const g = grades.find((x) => x.id === c.grade_id);
    return g ? `${g.name} · ${c.name}` : c.name;
  };

  return (
    <div className="space-y-3">
      {staff.map((s) => (
        <div key={s.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl">
          <span className="text-2xl shrink-0">{s.family_member?.avatar_emoji ?? "👤"}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{s.family_member?.nickname ?? "Unknown"}</p>
            <p className="text-xs text-muted-foreground">
              {s.role === "admin" ? "Admin" : "Teacher"}
              {classLabel(s.class_id) ? ` · ${classLabel(s.class_id)}` : ""}
            </p>
          </div>
          {isAdmin && (
            confirmRemove === s.id ? (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => removeStaff(s.id)} className="text-[11px] font-bold text-destructive px-2 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20">Remove</button>
                <button onClick={() => setConfirmRemove(null)} className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-lg bg-muted">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmRemove(s.id)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 size={14} />
              </button>
            )
          )}
        </div>
      ))}

      {isAdmin && (
        <button
          onClick={() => setShowInvite(true)}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-school hover:text-school transition-colors flex items-center justify-center gap-2"
        >
          <UserPlus size={16} /> Invite a teacher or admin
        </button>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeInvite} />
          <div className="relative w-full max-w-sm bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl z-10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Invite staff</h3>
              <button onClick={closeInvite} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>

            {!generatedCode ? (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-2">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["teacher", "admin"] as SchoolRole[]).map((r) => (
                      <button key={r} type="button" onClick={() => setInviteRole(r)}
                        className={cn("p-2.5 rounded-xl border-2 text-sm font-semibold transition-all", inviteRole === r ? "border-school bg-school/5 text-school" : "border-border")}>
                        {r === "admin" ? "Admin" : "Teacher"}
                      </button>
                    ))}
                  </div>
                </div>
                {inviteRole === "teacher" && classes.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">Class <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <select
                      value={inviteClassId} onChange={(e) => setInviteClassId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Not scoped to a class</option>
                      {classes.map((c) => {
                        const g = grades.find((x) => x.id === c.grade_id);
                        return <option key={c.id} value={c.id}>{g ? `${g.name} · ${c.name}` : c.name}</option>;
                      })}
                    </select>
                  </div>
                )}
                <button onClick={createInvite} disabled={saving} className="w-full py-3 rounded-xl bg-school text-school-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : "Generate invite link"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Share this link — it works for 7 days.</p>
                <button
                  onClick={() => onCopy(`${APP_URL}/join/${generatedCode}`, "staff-invite")}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-muted border border-border text-sm font-semibold"
                >
                  <span className="truncate">{APP_URL}/join/{generatedCode}</span>
                  {copiedCode === "staff-invite" ? <Check size={15} className="text-school shrink-0" /> : <Copy size={15} className="shrink-0" />}
                </button>
                <button onClick={() => { closeInvite(); onReload(); }} className="w-full py-2.5 rounded-xl bg-muted text-sm font-semibold">Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Roster ─────────────────────────────────────────────────────────────────

function RosterTab({
  classes, grades, learnersByClass, isAdmin, isStaff, myTeachingClassIds, schoolId, copiedCode, onCopy, onReload,
}: {
  classes: SchoolClass[]; grades: Grade[]; learnersByClass: Record<string, ClassLearner[]>;
  isAdmin: boolean; isStaff: boolean; myTeachingClassIds: string[]; schoolId: string;
  copiedCode: string | null; onCopy: (text: string, key: string) => void; onReload: () => void;
}) {
  const visibleClasses = isAdmin ? classes : classes.filter((c) => myTeachingClassIds.includes(c.id));
  const [selectedClassId, setSelectedClassId] = useState<string>(visibleClasses[0]?.id ?? "");
  const [showAddLearner, setShowAddLearner] = useState(false);
  const [learnerNickname, setLearnerNickname] = useState("");
  const [learnerAvatar, setLearnerAvatar] = useState("🧒");
  const [savedHandoverCode, setSavedHandoverCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemoveLearner, setConfirmRemoveLearner] = useState<string | null>(null);

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const learners = learnersByClass[selectedClassId] ?? [];

  if (!isStaff) {
    return (
      <div className="bg-card border border-border rounded-2xl px-5 py-10 text-center">
        <span className="text-4xl mb-3 block">👀</span>
        <p className="font-semibold text-foreground mb-1">Roster is for staff</p>
        <p className="text-sm text-muted-foreground">Only teachers and admins can see a class roster.</p>
      </div>
    );
  }

  if (visibleClasses.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl px-5 py-10 text-center">
        <span className="text-4xl mb-3 block">📋</span>
        <p className="font-semibold text-foreground mb-1">No classes yet</p>
        <p className="text-sm text-muted-foreground">{isAdmin ? "Add a grade and class first." : "You haven't been assigned to a class yet."}</p>
      </div>
    );
  }

  async function addSchoolCreatedLearner() {
    if (!learnerNickname.trim() || !selectedClassId) return;
    setSaving(true);
    const { data, error } = await supabase.from("class_learners").insert({
      class_id: selectedClassId,
      school_id: schoolId,
      nickname: learnerNickname.trim(),
      avatar_emoji: learnerAvatar,
      is_school_created: true,
    }).select().single();
    setSaving(false);
    if (error) { toast.error("Could not add learner"); return; }
    setSavedHandoverCode(data.handover_code);
    onReload();
  }

  async function removeLearner(learnerId: string) {
    await supabase.from("class_learners").delete().eq("id", learnerId);
    setConfirmRemoveLearner(null);
    onReload();
  }

  function closeAddLearner() {
    setShowAddLearner(false);
    setLearnerNickname("");
    setLearnerAvatar("🧒");
    setSavedHandoverCode(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {visibleClasses.map((c) => {
          const g = grades.find((x) => x.id === c.grade_id);
          return (
            <button
              key={c.id}
              onClick={() => setSelectedClassId(c.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors",
                selectedClassId === c.id ? "bg-school text-school-foreground border-school" : "bg-card border-border text-muted-foreground"
              )}
            >
              {g ? `${g.name} · ${c.name}` : c.name}
            </button>
          );
        })}
      </div>

      {selectedClass && (
        <button
          onClick={() => onCopy(`${APP_URL}/join/${selectedClass.join_code}`, `roster-${selectedClass.id}`)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-school/10 border border-school/20 text-sm"
        >
          <span className="text-school font-semibold">Share with parents to self-link an existing child: <strong>{selectedClass.join_code}</strong></span>
          {copiedCode === `roster-${selectedClass.id}` ? <Check size={15} className="text-school shrink-0" /> : <Copy size={15} className="text-school shrink-0" />}
        </button>
      )}

      <div className="space-y-2">
        {learners.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No learners in this class yet.</p>
        ) : (
          learners.map((l) => (
            <div key={l.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl">
              <span className="text-2xl shrink-0">{l.avatar_emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{l.nickname}</p>
                <p className="text-xs text-muted-foreground">
                  {l.claimed_at ? "Claimed by a parent" : l.is_school_created ? "Awaiting handover" : "Linked by parent"}
                </p>
                {l.is_school_created && !l.claimed_at && l.handover_code && (
                  <button
                    onClick={() => onCopy(`${APP_URL}/join/${l.handover_code}`, `handover-${l.id}`)}
                    className="flex items-center gap-1.5 text-xs text-school font-semibold mt-1 hover:underline"
                  >
                    <KeyRound size={11} /> Handover code: {l.handover_code}
                    {copiedCode === `handover-${l.id}` ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                )}
              </div>
              {confirmRemoveLearner === l.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => removeLearner(l.id)} className="text-[11px] font-bold text-destructive px-2 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20">Remove</button>
                  <button onClick={() => setConfirmRemoveLearner(null)} className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-lg bg-muted">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmRemoveLearner(l.id)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => setShowAddLearner(true)}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-school hover:text-school transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={16} /> Add a learner without a Bookie account yet
      </button>

      {showAddLearner && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeAddLearner} />
          <div className="relative w-full max-w-sm bg-card rounded-t-3xl lg:rounded-2xl border border-border shadow-2xl z-10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Add a learner</h3>
              <button onClick={closeAddLearner} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>

            {!savedHandoverCode ? (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Only their nickname is needed — no email or surname. You'll get a handover code to give their parent, who claims the full profile into their own family account.
                </p>
                <input
                  autoFocus value={learnerNickname} onChange={(e) => setLearnerNickname(e.target.value)}
                  placeholder="Nickname (e.g. Thabo)" maxLength={40}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  value={learnerAvatar} onChange={(e) => setLearnerAvatar(e.target.value)}
                  placeholder="🧒" maxLength={4}
                  className="w-20 px-3 py-2.5 rounded-xl bg-background border border-border text-lg text-center outline-none focus:ring-2 focus:ring-ring"
                />
                <button onClick={addSchoolCreatedLearner} disabled={saving || !learnerNickname.trim()} className="w-full py-3 rounded-xl bg-school text-school-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : "Add & get handover code"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Give this code (or link) to the learner's parent or guardian.</p>
                <button
                  onClick={() => onCopy(`${APP_URL}/join/${savedHandoverCode}`, "new-handover")}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-muted border border-border text-sm font-semibold"
                >
                  <span className="truncate">{APP_URL}/join/{savedHandoverCode}</span>
                  {copiedCode === "new-handover" ? <Check size={15} className="text-school shrink-0" /> : <Copy size={15} className="shrink-0" />}
                </button>
                <button onClick={closeAddLearner} className="w-full py-2.5 rounded-xl bg-muted text-sm font-semibold">Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
