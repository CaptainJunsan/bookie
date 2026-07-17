import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { LogOut, Plus, Trash2, Copy, Check, MessageCircle, UserPlus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker from "../components/EmojiPicker";
import { MEMBER_COLORS, CHILD_ROLES, PARENT_ROLES } from "../lib/types";
import type { Invite, FamilyMember } from "../lib/types";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, member, family, allMembers, signOut, refreshFamily } = useAuth();
  const navigate = useNavigate();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Edit self
  const [editNickname, setEditNickname] = useState(member?.nickname ?? "");
  const [editAvatar, setEditAvatar] = useState(member?.avatar_emoji ?? "📚");
  const [editRole, setEditRole] = useState(member?.role ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Add child
  const [childUsername, setChildUsername] = useState("");
  const [childRole, setChildRole] = useState("Son");
  const [childGender, setChildGender] = useState("");
  const [childAvatar, setChildAvatar] = useState("🧒");
  const [savingChild, setSavingChild] = useState(false);

  // Invite
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    loadInvites();
  }, [family]);

  async function loadInvites() {
    if (!family) return;
    const { data } = await supabase
      .from("invites")
      .select("*")
      .eq("family_id", family.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    setInvites((data as Invite[]) || []);
  }

  async function saveProfile() {
    if (!member || !editNickname.trim()) return;
    setSavingProfile(true);
    await supabase.from("family_members").update({
      nickname: editNickname.trim(),
      avatar_emoji: editAvatar,
      role: editRole,
    }).eq("id", member.id);
    await refreshFamily();
    toast.success("Profile updated!");
    setSavingProfile(false);
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
    toast.success("Profile removed");
  }

  async function sendInvite() {
    if (!inviteName.trim() || !family || !member) return;
    if (!inviteEmail && !invitePhone) { toast.error("Enter an email or phone number"); return; }
    setSendingInvite(true);
    const { data, error } = await supabase
      .from("invites")
      .insert({
        family_id: family.id,
        invited_by: member.id,
        name: inviteName.trim(),
        email: inviteEmail || null,
        phone: invitePhone || null,
      })
      .select()
      .single();
    if (error) { toast.error("Failed to create invite"); setSendingInvite(false); return; }
    await loadInvites();
    setInviteName(""); setInviteEmail(""); setInvitePhone(""); setShowInvite(false);
    toast.success("Invite created! Share the link below.");
    setSendingInvite(false);
    void data;
  }

  function getInviteUrl(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  async function copyInviteLink(token: string) {
    await navigator.clipboard.writeText(getInviteUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  function shareViaWhatsApp(invite: Invite) {
    const url = getInviteUrl(invite.token);
    const msg = `Hi ${invite.name}! 👋\n\nI'd like you to join our family reading library on Bookie. Click the link to get started:\n\n${url}\n\n📚 Let's read together!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
      <h1 className="font-display text-2xl font-bold">Settings</h1>

      {/* My profile */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <h2 className="font-display font-bold text-lg">My profile</h2>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{editAvatar}</span>
          <div>
            <p className="font-bold">{member?.nickname}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1 text-muted-foreground">Nickname</label>
            <input value={editNickname} onChange={(e) => setEditNickname(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 text-muted-foreground">Role</label>
            <div className="flex flex-wrap gap-2">
              {PARENT_ROLES.map((r) => (
                <button key={r} onClick={() => setEditRole(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${editRole === r ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-transparent"}`}>{r}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 text-muted-foreground">Avatar</label>
            <EmojiPicker value={editAvatar} onChange={setEditAvatar} />
          </div>
          <button onClick={saveProfile} disabled={savingProfile} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-60">
            {savingProfile ? "Saving..." : "Save changes"}
          </button>
        </div>
      </section>

      {/* Family */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">{family?.name}</h2>
          <span className="text-xs text-muted-foreground font-medium">{allMembers.length} members</span>
        </div>

        {allMembers.map((m: FamilyMember) => (
          <div key={m.id} className="flex items-center gap-3 py-1">
            <span className="text-2xl">{m.avatar_emoji}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm">{m.nickname}</p>
              <p className="text-xs text-muted-foreground capitalize">{m.role}{m.is_child ? " · child profile" : ""}</p>
            </div>
            {m.is_child && m.id !== member?.id && (
              <button onClick={() => deleteChild(m.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}

        {showAddChild ? (
          <div className="border border-border rounded-xl p-3 space-y-3 bg-muted/50">
            <h3 className="text-sm font-bold">Add a child</h3>
            <input value={childUsername} onChange={(e) => setChildUsername(e.target.value)} placeholder="Username" className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="flex gap-2 flex-wrap">
              {CHILD_ROLES.map((r) => (
                <button key={r} onClick={() => setChildRole(r)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${childRole === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>{r}</button>
              ))}
            </div>
            <select value={childGender} onChange={(e) => setChildGender(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none">
              <option value="">Gender (optional)</option>
              <option value="Boy">Boy</option>
              <option value="Girl">Girl</option>
              <option value="Non-binary">Non-binary</option>
            </select>
            <EmojiPicker value={childAvatar} onChange={setChildAvatar} />
            <div className="flex gap-2">
              <button onClick={addChild} disabled={savingChild} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold">{savingChild ? "Adding..." : "Add child"}</button>
              <button onClick={() => setShowAddChild(false)} className="px-4 py-2.5 rounded-xl bg-muted text-sm font-semibold">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddChild(true)} className="w-full py-2.5 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
            <Plus size={15} /> Add a child
          </button>
        )}
      </section>

      {/* Invites */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2"><UserPlus size={18} /> Invite family members</h2>

        {invites.map((inv) => {
          const url = getInviteUrl(inv.token);
          const isCopied = copiedToken === inv.token;
          return (
            <div key={inv.id} className="bg-secondary rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{inv.name}</p>
                  <p className="text-xs text-muted-foreground">{inv.email || inv.phone}</p>
                </div>
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => copyInviteLink(inv.token)} className="flex-1 py-2 rounded-lg bg-card border border-border text-xs font-semibold flex items-center justify-center gap-1 hover:border-primary transition-colors">
                  {isCopied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
                  {isCopied ? "Copied!" : "Copy link"}
                </button>
                <button onClick={() => shareViaWhatsApp(inv)} className="flex-1 py-2 rounded-lg bg-[#25D366] text-white text-xs font-semibold flex items-center justify-center gap-1">
                  <MessageCircle size={13} /> WhatsApp
                </button>
              </div>
            </div>
          );
        })}

        {showInvite ? (
          <div className="border border-border rounded-xl p-3 space-y-3 bg-muted/50">
            <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Their name (e.g. Dad)" className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
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

      {/* Account */}
      <section className="bg-card border border-border rounded-2xl p-4">
        <h2 className="font-display font-bold text-lg mb-3">Account</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
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
