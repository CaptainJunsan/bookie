import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  LogOut, Plus, Trash2, Copy, Check, UserPlus,
  Pencil, X, ShieldCheck, KeyRound, Share2, Loader2, Heart, BarChart2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker from "../components/EmojiPicker";
import { MEMBER_COLORS, CHILD_ROLES, PARENT_ROLES, genderFromRole, AGE_GROUPS, AGE_GROUP_LABELS, AGE_GROUP_COLORS } from "../lib/types";
import type { Invite, FamilyMember } from "../lib/types";
import { toast } from "sonner";
import {
  generateAppShareCard, shareWithOS, APP_URL,
} from "../lib/shareCard";

export default function SettingsPage() {
  const { user, member, family, allMembers, isAdmin, signOut, refreshFamily } = useAuth();
  const navigate = useNavigate();
  const ageGroupRef = useRef<HTMLElement | null>(null);

  const isParent = member && !member.is_child;

  // Members sorted: parents first, children below
  const sortedMembers = [...allMembers].sort((a, b) => Number(a.is_child) - Number(b.is_child));

  const [invites, setInvites] = useState<Invite[]>([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Share Bookie
  const [sharingApp, setSharingApp] = useState(false);

  // Edit self
  const [editingProfile, setEditingProfile] = useState(false);
  const [editNickname, setEditNickname] = useState(member?.nickname ?? "");
  const [editAvatar, setEditAvatar] = useState(member?.avatar_emoji ?? "📚");
  const [editRole, setEditRole] = useState(member?.role ?? "");
  const [editAgeGroup, setEditAgeGroup] = useState(member?.age_group ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Add child
  const [childUsername, setChildUsername] = useState("");
  const [childRole, setChildRole] = useState("Son");
  const [childGender, setChildGender] = useState("");
  const [childAvatar, setChildAvatar] = useState("🧒");
  const [savingChild, setSavingChild] = useState(false);

  // Edit child
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editChildNickname, setEditChildNickname] = useState("");
  const [editChildRole, setEditChildRole] = useState("Son");
  const [editChildGender, setEditChildGender] = useState("");
  const [editChildAvatar, setEditChildAvatar] = useState("🧒");
  const [editChildMode, setEditChildMode] = useState(false);
  const [editChildAgeGroup, setEditChildAgeGroup] = useState("");
  const [savingEditChild, setSavingEditChild] = useState(false);

  // Child login invite
  const [childInvites, setChildInvites] = useState<Record<string, Invite>>({});
  const [grantingLoginFor, setGrantingLoginFor] = useState<string | null>(null);
  const [childLoginEmail, setChildLoginEmail] = useState("");
  const [savingChildInvite, setSavingChildInvite] = useState(false);

  // Invite adults
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  // Confirm delete
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null);

  useEffect(() => { loadInvites(); }, [family]);

  async function loadInvites() {
    if (!family) return;
    const { data } = await supabase
      .from("invites")
      .select("*")
      .eq("family_id", family.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    const all = (data as Invite[]) || [];
    // Separate adult invites from child-login invites (those with member_id set)
    setInvites(all.filter((i) => !i.member_id));
    const byChild: Record<string, Invite> = {};
    all.filter((i) => i.member_id).forEach((i) => { byChild[i.member_id!] = i; });
    setChildInvites(byChild);
  }

  async function saveProfile() {
    if (!member || !editNickname.trim()) return;
    setSavingProfile(true);
    await supabase.from("family_members").update({
      nickname: editNickname.trim(),
      avatar_emoji: editAvatar,
      role: editRole,
      age_group: editAgeGroup || null,
    }).eq("id", member.id);
    await refreshFamily();
    toast.success("Profile updated!");
    setSavingProfile(false);
    setEditingProfile(false);
  }

  function openEditChild(m: FamilyMember) {
    setEditingChildId(m.id);
    setEditChildNickname(m.nickname);
    setEditChildRole(m.role);
    setEditChildGender(m.gender || "");
    setEditChildAvatar(m.avatar_emoji);
    setEditChildMode(m.is_child_mode ?? false);
    setEditChildAgeGroup(m.age_group || "");
    setGrantingLoginFor(null);
    setChildLoginEmail("");
  }

  async function saveEditChild() {
    if (!editingChildId || !editChildNickname.trim()) return;
    setSavingEditChild(true);
    const { error } = await supabase.from("family_members").update({
      nickname: editChildNickname.trim(),
      role: editChildRole,
      gender: editChildGender || null,
      avatar_emoji: editChildAvatar,
      is_child_mode: editChildMode,
      age_group: editChildAgeGroup || null,
    }).eq("id", editingChildId);
    if (error) { toast.error("Could not save"); setSavingEditChild(false); return; }
    await refreshFamily();
    setEditingChildId(null);
    toast.success("Profile updated");
    setSavingEditChild(false);
  }

  async function addChild() {
    if (!childUsername.trim() || !family || !member) return;
    setSavingChild(true);
    const color = MEMBER_COLORS[allMembers.length % MEMBER_COLORS.length];
    await supabase.from("family_members").insert({
      family_id: family.id,
      user_id: null,
      role: childRole,
      nickname: childUsername.trim(),
      avatar_emoji: childAvatar,
      is_child: true,
      color,
      gender: childGender || null,
    });
    await refreshFamily();
    setChildUsername(""); setChildRole("Son"); setChildGender(""); setChildAvatar("🧒");
    setShowAddChild(false);
    toast.success("Child profile added!");
    setSavingChild(false);
  }

  async function deleteChild(childId: string) {
    await supabase.from("family_members").delete().eq("id", childId);
    await refreshFamily();
    setDeletingChildId(null);
    toast.success("Profile removed");
  }

  async function grantLoginAccess(childId: string, childNickname: string) {
    if (!childLoginEmail.trim() || !family || !member) return;
    setSavingChildInvite(true);
    const token = generate6DigitCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    const { error } = await supabase.from("invites").insert({
      family_id: family.id,
      invited_by: member.id,
      member_id: childId,
      name: childNickname,
      email: childLoginEmail.trim(),
      token,
      expires_at: expiresAt,
    });
    if (error) { toast.error("Failed to create login invite"); setSavingChildInvite(false); return; }
    setChildLoginEmail("");
    setGrantingLoginFor(null);
    await loadInvites();
    toast.success("Login invite created — share the code with them!");
    setSavingChildInvite(false);
  }

  async function cancelChildLoginInvite(inviteId: string, memberId: string) {
    const { error } = await supabase.from("invites")
      .update({ expires_at: new Date(0).toISOString() })
      .eq("id", inviteId);
    if (error) { toast.error("Could not cancel"); return; }
    setChildInvites((prev) => { const next = { ...prev }; delete next[memberId]; return next; });
    toast.success("Login invite cancelled");
  }

  async function cancelInvite(inviteId: string) {
    const { error } = await supabase.from("invites")
      .update({ expires_at: new Date(0).toISOString() })
      .eq("id", inviteId);
    if (error) { toast.error("Could not cancel invite"); return; }
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    toast.success("Invite cancelled");
  }

  function generate6DigitCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  function getInviteUrl(token: string) {
    return `${window.location.origin}/auth?invite=${token}`;
  }

  function buildInviteMessage(invite: Invite) {
    const url = getInviteUrl(invite.token);
    return [
      `Hi ${invite.name || "there"}, you've been invited to join ${family?.name} on Bookie! 📚`,
      ``,
      `Here's your 6-digit invite code: *${invite.token}*`,
      `Just follow the link to join the family!`,
      `(You can also manually enter it from the login page)`,
      ``,
      url,
      ``,
      `See you there :)`,
    ].join("\n");
  }

  async function sendInvite() {
    if (!inviteName.trim() || !family || !member) return;
    if (!inviteEmail && !invitePhone) { toast.error("Enter an email or phone number"); return; }
    setSendingInvite(true);
    const token = generate6DigitCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("invites").insert({
      family_id: family.id,
      invited_by: member.id,
      name: inviteName.trim(),
      email: inviteEmail || null,
      phone: invitePhone || null,
      token,
      expires_at: expiresAt,
    });
    if (error) { toast.error("Failed to create invite"); setSendingInvite(false); return; }
    await loadInvites();
    setInviteName(""); setInviteEmail(""); setInvitePhone(""); setShowInvite(false);
    toast.success("Invite created! Share the link or code below.");
    setSendingInvite(false);
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedToken(key);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function handleShareApp() {
    setSharingApp(true);
    try {
      const blob = await generateAppShareCard();
      const shareText = "📚 Bookie — track your family's reading journey together! Free at bookie-seven-pi.vercel.app";
      const result = await shareWithOS({
        blob,
        fileName: "bookie.png",
        title: "Bookie — Family Reading Tracker",
        text: shareText,
        url: APP_URL,
      });
      if (result === "fallback") {
        await navigator.clipboard.writeText(`${shareText}\n\n${APP_URL}`);
        toast.success("Message copied to clipboard!");
      }
    } catch {
      toast.error("Could not generate share card");
    } finally {
      setSharingApp(false);
    }
  }

  async function saveAgeGroup(memberId: string, ageGroup: string) {
    await supabase.from("family_members").update({ age_group: ageGroup }).eq("id", memberId);
    await refreshFamily();
  }

  const membersWithoutAgeGroup = allMembers.filter((m) => !m.age_group);
  const showAgeNotice = membersWithoutAgeGroup.length > 0;

  // Which members the current user can set age group for
  const ageGroupTargets = isAdmin || !member?.is_child
    ? allMembers
    : allMembers.filter((m) => m.id === member?.id);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  // ── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl lg:max-w-2xl mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-10 space-y-6">
      <h1 className="font-display text-2xl font-bold">Settings</h1>

      {/* Age group notification banner */}
      {showAgeNotice && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-3">
          <span className="text-xl mt-0.5 flex-shrink-0">📊</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-800">Set age groups for your readers</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Help us understand our audience —{" "}
              {membersWithoutAgeGroup.map((m) => m.nickname).join(", ")}{" "}
              {membersWithoutAgeGroup.length === 1 ? "needs" : "need"} an age group. Edit each profile below to set it.
            </p>
          </div>
        </div>
      )}

      {/* My profile */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Collapsed view — always visible */}
        <div className="flex items-center gap-3 p-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: (member?.color ?? "#3B6E52") + "22", border: `2px solid ${(member?.color ?? "#3B6E52")}40` }}
          >
            {member?.avatar_emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-tight">{member?.nickname}</p>
            <p className="text-xs text-muted-foreground truncate">{member?.role} · {user?.email}</p>
          </div>
          <button
            onClick={() => {
              if (!editingProfile) {
                setEditNickname(member?.nickname ?? "");
                setEditAvatar(member?.avatar_emoji ?? "📚");
                setEditRole(member?.role ?? "");
                setEditAgeGroup(member?.age_group ?? "");
              }
              setEditingProfile((v) => !v);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              editingProfile
                ? "bg-muted text-muted-foreground"
                : "bg-secondary text-foreground hover:bg-muted"
            }`}
          >
            {editingProfile ? <><X size={12} /> Cancel</> : <><Pencil size={12} /> Edit</>}
          </button>
        </div>

        {/* Expanded edit form */}
        {editingProfile && (
          <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 bg-muted/30">
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Nickname</label>
              <input
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Role</label>
              <div className="flex flex-wrap gap-2">
                {(member?.is_child ? CHILD_ROLES : PARENT_ROLES).map((r) => (
                  <button
                    key={r}
                    onClick={() => setEditRole(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      editRole === r ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-transparent"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Age Group</label>
              <div className="flex flex-wrap gap-1.5">
                {[...AGE_GROUPS].map((ag) => {
                  const selected = editAgeGroup === ag;
                  const color = AGE_GROUP_COLORS[ag];
                  return (
                    <button
                      key={ag}
                      type="button"
                      onClick={() => setEditAgeGroup(selected ? "" : ag)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all"
                      style={selected ? { background: color + "22", borderColor: color + "88", color } : {}}
                      {...(!selected ? { className: "px-2.5 py-1 rounded-lg text-xs font-semibold border bg-muted border-transparent text-muted-foreground hover:border-primary/40 transition-all" } : {})}
                    >
                      {AGE_GROUP_LABELS[ag]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Avatar</label>
              <EmojiPicker value={editAvatar} onChange={setEditAvatar} />
            </div>
            <button
              onClick={saveProfile}
              disabled={savingProfile || !editNickname.trim()}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-60"
            >
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </section>

      {/* Family */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-bold text-lg">{family?.name}</h2>
          <span className="text-xs text-muted-foreground font-medium">{allMembers.length} members</span>
        </div>

        {sortedMembers.map((m: FamilyMember) => {
          const isEditing = editingChildId === m.id;
          const isMe = m.id === member?.id;
          const childInvite = childInvites[m.id];

          return (
            <div key={m.id}>
              {/* Member row */}
              <div className="flex items-center gap-3 py-2">
                <span className="text-2xl">{m.avatar_emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {m.nickname}
                    {isMe && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">you</span>}
                    {m.is_child_mode && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">child mode</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.role}
                    {m.is_child && (m.user_id ? " · has login" : " · managed profile")}
                  </p>
                </div>
                {isParent && m.is_child && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => isEditing ? setEditingChildId(null) : openEditChild(m)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isEditing ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                    >
                      {isEditing ? <X size={14} /> : <Pencil size={14} />}
                    </button>
                    {deletingChildId === m.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => deleteChild(m.id)} className="text-[11px] font-bold text-destructive px-2 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20">Delete</button>
                        <button onClick={() => setDeletingChildId(null)} className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-lg bg-muted">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingChildId(m.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Inline edit panel */}
              {isEditing && (
                <div className="ml-10 mb-3 border border-border rounded-xl p-3 space-y-3 bg-muted/40">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Nickname</label>
                    <input value={editChildNickname} onChange={(e) => setEditChildNickname(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">Role</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CHILD_ROLES.map((r) => (
                        <button key={r}
                          onClick={() => { setEditChildRole(r); const g = genderFromRole(r); if (g) setEditChildGender(g); }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${editChildRole === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {["Male", "Female"].map((g) => (
                      <button key={g} type="button"
                        onClick={() => setEditChildGender(editChildGender === g ? "" : g)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${editChildGender === g ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-transparent text-muted-foreground"}`}>
                        {g === "Male" ? "♂ Male" : "♀ Female"}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">Age Group</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[...AGE_GROUPS].map((ag) => {
                        const selected = editChildAgeGroup === ag;
                        const color = AGE_GROUP_COLORS[ag];
                        return (
                          <button
                            key={ag}
                            type="button"
                            onClick={() => setEditChildAgeGroup(selected ? "" : ag)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${selected ? "" : "bg-muted border-transparent text-muted-foreground"}`}
                            style={selected ? { background: color + "22", borderColor: color + "88", color } : {}}
                          >
                            {AGE_GROUP_LABELS[ag]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">Avatar</label>
                    <EmojiPicker value={editChildAvatar} onChange={setEditChildAvatar} />
                  </div>

                  {/* Child mode toggle */}
                  <button
                    type="button"
                    onClick={() => setEditChildMode(!editChildMode)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${editChildMode ? "bg-amber-50 border-amber-200" : "bg-card border-border"}`}
                  >
                    <ShieldCheck size={16} className={editChildMode ? "text-amber-600" : "text-muted-foreground"} />
                    <div className="flex-1">
                      <p className={`text-xs font-bold ${editChildMode ? "text-amber-700" : "text-foreground"}`}>Child mode</p>
                      <p className="text-[11px] text-muted-foreground">Prevents leaving family or editing other profiles</p>
                    </div>
                    <div className={`w-9 h-5 rounded-full transition-colors relative ${editChildMode ? "bg-amber-400" : "bg-muted"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${editChildMode ? "left-4" : "left-0.5"}`} />
                    </div>
                  </button>

                  {/* Grant login access */}
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <KeyRound size={13} className="text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Login access</span>
                    </div>

                    {m.user_id ? (
                      <p className="text-xs text-primary font-semibold flex items-center gap-1.5">
                        <Check size={12} /> This profile has a login account
                      </p>
                    ) : childInvite ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Pending invite — share this code:</p>
                        <div className="flex items-center justify-between bg-card rounded-xl px-3 py-2 border border-border">
                          <span className="font-mono font-bold text-lg text-primary tracking-widest">{childInvite.token}</span>
                          <span className="text-[10px] text-muted-foreground">7 days</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyText(getInviteUrl(childInvite.token), childInvite.token)}
                            className="flex-1 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold flex items-center justify-center gap-1 hover:border-primary transition-colors"
                          >
                            {copiedToken === childInvite.token ? <><Check size={12} className="text-primary" /> Copied!</> : <><Copy size={12} /> Copy link</>}
                          </button>
                          <button
                            onClick={() => cancelChildLoginInvite(childInvite.id, m.id)}
                            className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : grantingLoginFor === m.id ? (
                      <div className="space-y-2">
                        <input
                          type="email"
                          value={childLoginEmail}
                          onChange={(e) => setChildLoginEmail(e.target.value)}
                          placeholder="Child's email address"
                          className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => grantLoginAccess(m.id, m.nickname)}
                            disabled={savingChildInvite || !childLoginEmail.trim()}
                            className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-60"
                          >
                            {savingChildInvite ? "Creating..." : "Create invite"}
                          </button>
                          <button onClick={() => setGrantingLoginFor(null)} className="px-3 py-2 rounded-xl bg-muted text-xs font-semibold">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setGrantingLoginFor(m.id)}
                        className="w-full py-2 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                      >
                        <KeyRound size={12} /> Grant login access
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEditChild} disabled={savingEditChild}
                      className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-60">
                      {savingEditChild ? "Saving..." : "Save changes"}
                    </button>
                    <button onClick={() => setEditingChildId(null)} className="px-4 py-2.5 rounded-xl bg-muted text-sm font-semibold">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add child — only parents see this */}
        {isParent && (
          showAddChild ? (
            <div className="border border-border rounded-xl p-3 space-y-3 bg-muted/50 mt-2">
              <h3 className="text-sm font-bold">Add a child profile</h3>
              <input value={childUsername} onChange={(e) => setChildUsername(e.target.value)} placeholder="Nickname" className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" autoFocus />
              <div className="flex gap-2 flex-wrap">
                {CHILD_ROLES.map((r) => (
                  <button key={r}
                    onClick={() => { setChildRole(r); const g = genderFromRole(r); if (g) setChildGender(g); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${childRole === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {["Male", "Female"].map((g) => (
                  <button key={g} type="button"
                    onClick={() => setChildGender(childGender === g ? "" : g)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${childGender === g ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-transparent text-muted-foreground"}`}>
                    {g === "Male" ? "♂ Male" : "♀ Female"}
                  </button>
                ))}
              </div>
              <EmojiPicker value={childAvatar} onChange={setChildAvatar} />
              <div className="flex gap-2">
                <button onClick={addChild} disabled={savingChild} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold">{savingChild ? "Adding..." : "Add child"}</button>
                <button onClick={() => setShowAddChild(false)} className="px-4 py-2.5 rounded-xl bg-muted text-sm font-semibold">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddChild(true)} className="w-full py-2.5 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 mt-2">
              <Plus size={15} /> Add a child
            </button>
          )
        )}
      </section>

      {/* Invite adults — only parents */}
      {isParent && (
        <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <h2 className="font-display font-bold text-lg flex items-center gap-2"><UserPlus size={18} /> Invite family members</h2>

          {invites.map((inv) => {
            const isCopiedLink = copiedToken === inv.token;
            const isCopiedMsg = copiedToken === inv.token + "_msg";
            return (
              <div key={inv.id} className="bg-secondary rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{inv.name}</p>
                    <p className="text-xs text-muted-foreground">{inv.email || inv.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-mono font-bold text-lg text-primary tracking-widest">{inv.token}</p>
                      <p className="text-[10px] text-muted-foreground">6-digit · 24h</p>
                    </div>
                    <button onClick={() => cancelInvite(inv.id)} className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors" title="Cancel invite">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyText(getInviteUrl(inv.token), inv.token)} className="flex-1 py-2 rounded-lg bg-card border border-border text-xs font-semibold flex items-center justify-center gap-1 hover:border-primary transition-colors">
                    {isCopiedLink ? <><Check size={13} className="text-primary" /> Copied!</> : <><Copy size={13} /> Copy link</>}
                  </button>
                  <button onClick={() => copyText(buildInviteMessage(inv), inv.token + "_msg")} className="flex-1 py-2 rounded-lg bg-card border border-border text-xs font-semibold flex items-center justify-center gap-1 hover:border-primary transition-colors">
                    {isCopiedMsg ? <><Check size={13} className="text-primary" /> Copied!</> : <><Copy size={13} /> Copy message</>}
                  </button>
                </div>
              </div>
            );
          })}

          {showInvite ? (
            <div className="border border-border rounded-xl p-3 space-y-3 bg-muted/50">
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Their name (e.g. Dad)" className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" autoFocus />
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
              <input type="tel" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="WhatsApp number (optional)" className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
              <div className="flex gap-2">
                <button onClick={sendInvite} disabled={sendingInvite} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold">{sendingInvite ? "Creating..." : "Create invite"}</button>
                <button onClick={() => setShowInvite(false)} className="px-4 py-2.5 rounded-xl bg-muted text-sm font-semibold">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowInvite(true)} className="w-full py-2.5 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
              <Plus size={15} /> Invite someone
            </button>
          )}
        </section>
      )}

      {/* Share Bookie */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Heart size={16} className="text-rose-400" />
          <h2 className="font-display font-bold text-lg">Share Bookie</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Know a family who loves reading? Share Bookie with them — it generates a beautiful branded card to send.
        </p>
        <button
            onClick={handleShareApp}
            disabled={sharingApp}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {sharingApp ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            {sharingApp ? "Generating…" : "Share with friends"}
          </button>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(APP_URL);
            toast.success("Link copied!");
          }}
          className="w-full py-2 rounded-xl border border-border text-xs font-mono text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Copy size={12} /> {APP_URL}
        </button>
      </section>

      {/* Super Admin switcher */}
      {isAdmin && (
        <section className="bg-foreground text-background rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 size={18} />
              <div>
                <p className="font-display font-bold text-sm">Super Admin</p>
                <p className="text-[11px] text-background/60 mt-0.5">Platform-wide analytics and reporting</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors text-xs font-bold"
            >
              Open admin view →
            </button>
          </div>
        </section>
      )}

      {/* Account */}
      <section className="bg-card border border-border rounded-2xl p-4">
        <h2 className="font-display font-bold text-lg mb-3">Account</h2>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">Email</span>
          <span className="text-sm font-medium">{user?.email}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="mt-4 w-full py-3 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </section>
    </div>
  );
}
