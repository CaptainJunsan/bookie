import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Plus, Copy, Check, Loader2, Trash2, GraduationCap,
  Users, ClipboardList, ChevronRight, ChevronDown, X, KeyRound, UserPlus,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import type { School, SchoolMember, SchoolGroup, SchoolGroupKind, Learner, LearnerGroupMembership, FamilyMember, SchoolRole } from "../lib/types";
import { toast } from "sonner";
import { APP_URL } from "../lib/shareCard";
import { cn } from "../app/components/ui/utils";

type Tab = "groups" | "staff" | "roster";

const GROUP_KINDS: SchoolGroupKind[] = ["phase", "grade", "class", "group"];

function pathLabel(groupId: string, groups: SchoolGroup[]): string {
  const names: string[] = [];
  let current = groups.find((g) => g.id === groupId);
  while (current) {
    names.unshift(current.name);
    current = current.parent_id ? groups.find((g) => g.id === current!.parent_id) : undefined;
  }
  return names.join(" · ");
}

function flattenGroups(groups: SchoolGroup[], parentId: string | null = null, depth = 0): Array<{ group: SchoolGroup; depth: number }> {
  return groups
    .filter((g) => g.parent_id === parentId)
    .sort((a, b) => a.order_index - b.order_index)
    .flatMap((g) => [{ group: g, depth }, ...flattenGroups(groups, g.id, depth + 1)]);
}

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { allMembers } = useAuth();
  const navigate = useNavigate();

  const [school, setSchool] = useState<School | null>(null);
  const [myRole, setMyRole] = useState<SchoolRole | null>(null);
  const [myStaffGroupIds, setMyStaffGroupIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<SchoolGroup[]>([]);
  const [staff, setStaff] = useState<Array<SchoolMember & { family_member?: FamilyMember }>>([]);
  const [learnersByGroup, setLearnersByGroup] = useState<Record<string, Learner[]>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("groups");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const isAdmin = myRole === "admin";
  const isStaff = myRole !== null;
  const myMemberIds = allMembers.map((m) => m.id);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [schoolRes, myStaffRes, groupsRes, staffRes, staffGroupIdsRes] = await Promise.all([
        supabase.from("schools").select("*").eq("id", id).single(),
        supabase.from("school_members").select("*").eq("school_id", id).in("family_member_id", myMemberIds),
        supabase.from("school_groups").select("*").eq("school_id", id).order("order_index"),
        supabase.from("school_members").select("*, family_member:family_members(*)").eq("school_id", id),
        supabase.rpc("get_my_staff_group_ids"),
      ]);

      setSchool(schoolRes.data as School);
      const myRows = myStaffRes.data ?? [];
      setMyRole(myRows.some((r) => r.role === "admin") ? "admin" : myRows.length ? "teacher" : null);
      setGroups((groupsRes.data as SchoolGroup[]) ?? []);
      setStaff((staffRes.data as Array<SchoolMember & { family_member?: FamilyMember }>) ?? []);
      setMyStaffGroupIds((staffGroupIdsRes.data as string[]) ?? []);

      const groupIds = (groupsRes.data ?? []).map((g) => g.id);
      if (groupIds.length) {
        const { data: memberships } = await supabase
          .from("learner_group_memberships")
          .select("group_id, learner:learners(*)")
          .in("group_id", groupIds);
        const grouped: Record<string, Learner[]> = {};
        (memberships as Array<{ group_id: string; learner: Learner }> ?? []).forEach((m) => {
          if (!m.learner) return;
          (grouped[m.group_id] ??= []).push(m.learner);
        });
        setLearnersByGroup(grouped);
      } else {
        setLearnersByGroup({});
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
            { key: "groups", label: "Groups", icon: <GraduationCap size={14} /> },
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
        {isAdmin && school.status === "pending" && (
          <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <p className="text-sm font-bold text-amber-800">Application under review</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              We're verifying {school.name} before it goes live — groups and staff invites unlock once a
              super admin approves it. We'll email {school.applicant_email ?? "you"} when that happens.
            </p>
          </div>
        )}
        {isAdmin && school.status === "rejected" && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-sm font-bold text-red-800">Application not approved</p>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              {school.rejection_reason || "Get in touch with us if you think this was a mistake."}
            </p>
          </div>
        )}
        {tab === "groups" && (
          <GroupsTab
            schoolId={school.id}
            isAdmin={isAdmin && school.status === "approved"}
            groups={groups}
            copiedCode={copiedCode}
            onCopy={copyToClipboard}
            onReload={load}
            onOpenRoster={() => setTab("roster")}
          />
        )}
        {tab === "staff" && (
          <StaffTab
            schoolId={school.id}
            isAdmin={isAdmin && school.status === "approved"}
            staff={staff}
            groups={groups}
            copiedCode={copiedCode}
            onCopy={copyToClipboard}
            onReload={load}
          />
        )}
        {tab === "roster" && (
          <RosterTab
            groups={groups}
            learnersByGroup={learnersByGroup}
            isAdmin={isAdmin && school.status === "approved"}
            isStaff={isStaff}
            myStaffGroupIds={myStaffGroupIds}
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

// ─── Groups (arbitrary-depth tree) ──────────────────────────────────────────

function GroupsTab({
  schoolId, isAdmin, groups, copiedCode, onCopy, onReload, onOpenRoster,
}: {
  schoolId: string; isAdmin: boolean; groups: SchoolGroup[];
  copiedCode: string | null; onCopy: (text: string, key: string) => void; onReload: () => void;
  onOpenRoster: () => void;
}) {
  const [addingChildFor, setAddingChildFor] = useState<string | null>("root");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<SchoolGroupKind>("group");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function addGroup(parentId: string | null) {
    if (!newName.trim()) return;
    setSaving(true);
    const siblingCount = groups.filter((g) => g.parent_id === parentId).length;
    const { error } = await supabase.from("school_groups").insert({
      school_id: schoolId, parent_id: parentId, name: newName.trim(), kind: newKind, order_index: siblingCount,
    });
    setSaving(false);
    if (error) { toast.error("Could not add group"); return; }
    setNewName(""); setNewKind("group"); setAddingChildFor(null);
    onReload();
  }

  async function deleteGroup(groupId: string) {
    await supabase.from("school_groups").delete().eq("id", groupId);
    setConfirmDelete(null);
    onReload();
  }

  function renderNode(group: SchoolGroup, depth: number) {
    const children = groups.filter((g) => g.parent_id === group.id).sort((a, b) => a.order_index - b.order_index);
    const isOpen = expanded[group.id] ?? true;

    return (
      <div key={group.id} className="bg-card border border-border rounded-2xl overflow-hidden" style={{ marginLeft: depth * 12 }}>
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setExpanded((e) => ({ ...e, [group.id]: !isOpen }))}
            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80"
          >
            {isOpen ? <ChevronDown size={14} className="text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
            <span className="font-display font-bold text-sm truncate">{group.name}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{group.kind}</span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onCopy(`${APP_URL}/join/${group.join_code}`, `group-${group.id}`)}
              className="flex items-center gap-1 text-[11px] text-school font-semibold hover:underline"
            >
              <KeyRound size={11} /> {group.join_code}
              {copiedCode === `group-${group.id}` ? <Check size={11} /> : <Copy size={11} />}
            </button>
            <button onClick={onOpenRoster} className="text-muted-foreground hover:text-foreground">
              <ClipboardList size={13} />
            </button>
            {isAdmin && (
              confirmDelete === group.id ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => deleteGroup(group.id)} className="text-[11px] font-bold text-destructive px-2 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20">Delete</button>
                  <button onClick={() => setConfirmDelete(null)} className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-lg bg-muted">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(group.id)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 size={13} />
                </button>
              )
            )}
          </div>
        </div>

        {isOpen && (
          <div className="pl-4 pr-4 pb-4 space-y-2">
            {children.map((c) => renderNode(c, depth + 1))}

            {isAdmin && (
              addingChildFor === group.id ? (
                <AddGroupForm
                  newName={newName} setNewName={setNewName} newKind={newKind} setNewKind={setNewKind}
                  saving={saving} onSave={() => addGroup(group.id)}
                  onCancel={() => { setAddingChildFor(null); setNewName(""); }}
                />
              ) : (
                <button
                  onClick={() => setAddingChildFor(group.id)}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-school hover:text-school transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={13} /> Add a group inside {group.name}
                </button>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  const roots = groups.filter((g) => g.parent_id === null).sort((a, b) => a.order_index - b.order_index);

  if (roots.length === 0 && !isAdmin) {
    return (
      <div className="bg-card border border-border rounded-2xl px-5 py-10 text-center">
        <span className="text-4xl mb-3 block">📋</span>
        <p className="font-semibold text-foreground mb-1">No groups set up yet</p>
        <p className="text-sm text-muted-foreground">Ask a school admin to add grades and classes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {roots.map((g) => renderNode(g, 0))}

      {isAdmin && (
        addingChildFor === "root" ? (
          <AddGroupForm
            newName={newName} setNewName={setNewName} newKind={newKind} setNewKind={setNewKind}
            saving={saving} onSave={() => addGroup(null)}
            onCancel={() => setNewName("")}
          />
        ) : (
          <button
            onClick={() => setAddingChildFor("root")}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-school hover:text-school transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add a top-level group
          </button>
        )
      )}
    </div>
  );
}

function AddGroupForm({
  newName, setNewName, newKind, setNewKind, saving, onSave, onCancel,
}: {
  newName: string; setNewName: (v: string) => void; newKind: SchoolGroupKind; setNewKind: (v: SchoolGroupKind) => void;
  saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex gap-2">
      <select
        value={newKind} onChange={(e) => setNewKind(e.target.value as SchoolGroupKind)}
        className="px-2 py-2.5 rounded-xl bg-background border border-border text-xs outline-none focus:ring-2 focus:ring-ring"
      >
        {GROUP_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <input
        autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
        placeholder="Name (e.g. Grade 4, or 4A)" maxLength={40}
        className="flex-1 px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <button onClick={onSave} disabled={saving} className="px-4 py-2.5 rounded-xl bg-school text-school-foreground text-sm font-bold">
        {saving ? <Loader2 size={14} className="animate-spin" /> : "Add"}
      </button>
      <button onClick={onCancel} className="px-3 text-muted-foreground"><X size={18} /></button>
    </div>
  );
}

// ─── Staff ──────────────────────────────────────────────────────────────────

function StaffTab({
  schoolId, isAdmin, staff, groups, copiedCode, onCopy, onReload,
}: {
  schoolId: string; isAdmin: boolean; staff: Array<SchoolMember & { family_member?: FamilyMember }>;
  groups: SchoolGroup[]; copiedCode: string | null;
  onCopy: (text: string, key: string) => void; onReload: () => void;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<SchoolRole>("teacher");
  const [inviteGroupId, setInviteGroupId] = useState<string>("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const flatGroups = flattenGroups(groups);

  async function createInvite() {
    setSaving(true);
    const { data, error } = await supabase.from("school_staff_invites").insert({
      school_id: schoolId,
      role: inviteRole,
      group_id: inviteRole === "teacher" && inviteGroupId ? inviteGroupId : null,
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
    setInviteGroupId("");
    setInviteRole("teacher");
  }

  return (
    <div className="space-y-3">
      {staff.map((s) => (
        <div key={s.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl">
          <span className="text-2xl shrink-0">{s.family_member?.avatar_emoji ?? "👤"}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{s.family_member?.nickname ?? "Unknown"}</p>
            <p className="text-xs text-muted-foreground">
              {s.role === "admin" ? "Admin" : "Teacher"}
              {s.group_id ? ` · ${pathLabel(s.group_id, groups)}` : ""}
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
                {inviteRole === "teacher" && flatGroups.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">Group <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <select
                      value={inviteGroupId} onChange={(e) => setInviteGroupId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Not scoped to a group</option>
                      {flatGroups.map(({ group, depth }) => (
                        <option key={group.id} value={group.id}>{"— ".repeat(depth)}{group.name}</option>
                      ))}
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
  groups, learnersByGroup, isAdmin, isStaff, myStaffGroupIds, schoolId, copiedCode, onCopy, onReload,
}: {
  groups: SchoolGroup[]; learnersByGroup: Record<string, Learner[]>;
  isAdmin: boolean; isStaff: boolean; myStaffGroupIds: string[]; schoolId: string;
  copiedCode: string | null; onCopy: (text: string, key: string) => void; onReload: () => void;
}) {
  const visibleGroups = isAdmin ? groups : groups.filter((g) => myStaffGroupIds.includes(g.id));
  const flatVisible = flattenGroups(visibleGroups);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(flatVisible[0]?.group.id ?? "");
  const [showAddLearner, setShowAddLearner] = useState(false);
  const [learnerNickname, setLearnerNickname] = useState("");
  const [learnerAvatar, setLearnerAvatar] = useState("🧒");
  const [savedHandoverCode, setSavedHandoverCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemoveLearner, setConfirmRemoveLearner] = useState<string | null>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const learners = learnersByGroup[selectedGroupId] ?? [];

  if (!isStaff) {
    return (
      <div className="bg-card border border-border rounded-2xl px-5 py-10 text-center">
        <span className="text-4xl mb-3 block">👀</span>
        <p className="font-semibold text-foreground mb-1">Roster is for staff</p>
        <p className="text-sm text-muted-foreground">Only teachers and admins can see a roster.</p>
      </div>
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl px-5 py-10 text-center">
        <span className="text-4xl mb-3 block">📋</span>
        <p className="font-semibold text-foreground mb-1">No groups yet</p>
        <p className="text-sm text-muted-foreground">{isAdmin ? "Add a group first." : "You haven't been assigned to a group yet."}</p>
      </div>
    );
  }

  async function addSchoolCreatedLearner() {
    if (!learnerNickname.trim() || !selectedGroupId) return;
    setSaving(true);
    const { data: learner, error } = await supabase.from("learners").insert({
      school_id: schoolId,
      nickname: learnerNickname.trim(),
      avatar_emoji: learnerAvatar,
      is_school_created: true,
    }).select().single();
    if (error) { setSaving(false); toast.error("Could not add learner"); return; }
    const { error: membershipError } = await supabase.from("learner_group_memberships").insert({
      learner_id: learner.id, group_id: selectedGroupId,
    });
    setSaving(false);
    if (membershipError) { toast.error("Could not add learner to this group"); return; }
    setSavedHandoverCode(learner.handover_code);
    onReload();
  }

  async function removeLearner(learnerId: string) {
    await supabase.from("learner_group_memberships").delete().eq("learner_id", learnerId).eq("group_id", selectedGroupId);
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
        {flatVisible.map(({ group, depth }) => (
          <button
            key={group.id}
            onClick={() => setSelectedGroupId(group.id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors",
              selectedGroupId === group.id ? "bg-school text-school-foreground border-school" : "bg-card border-border text-muted-foreground"
            )}
          >
            {"— ".repeat(depth)}{group.name}
          </button>
        ))}
      </div>

      {selectedGroup && (
        <button
          onClick={() => onCopy(`${APP_URL}/join/${selectedGroup.join_code}`, `roster-${selectedGroup.id}`)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-school/10 border border-school/20 text-sm"
        >
          <span className="text-school font-semibold">Share with parents to self-link an existing child: <strong>{selectedGroup.join_code}</strong></span>
          {copiedCode === `roster-${selectedGroup.id}` ? <Check size={15} className="text-school shrink-0" /> : <Copy size={15} className="text-school shrink-0" />}
        </button>
      )}

      <div className="space-y-2">
        {learners.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No learners in this group yet.</p>
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
