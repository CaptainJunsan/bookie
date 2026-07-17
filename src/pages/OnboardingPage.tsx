import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Trash2, Send, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker from "../components/EmojiPicker";
import { MEMBER_COLORS, PARENT_ROLES, CHILD_ROLES } from "../lib/types";
import { toast } from "sonner";

interface ChildProfile {
  username: string;
  role: string;
  gender: string;
  avatar_emoji: string;
}

interface InvitePerson {
  name: string;
  email: string;
  phone: string;
}

const STEPS = ["Your profile", "Family name", "Add children", "Invite family"];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshFamily } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0: profile
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState("Mom");
  const [avatar, setAvatar] = useState("📚");

  // Step 1: family
  const [familyName, setFamilyName] = useState("");

  // Step 2: children
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [newChild, setNewChild] = useState<ChildProfile>({ username: "", role: "Son", gender: "", avatar_emoji: "🧒" });
  const [addingChild, setAddingChild] = useState(false);

  // Step 3: invites
  const [invites, setInvites] = useState<InvitePerson[]>([]);
  const [newInvite, setNewInvite] = useState<InvitePerson>({ name: "", email: "", phone: "" });
  const [addingInvite, setAddingInvite] = useState(false);

  function nextStep() {
    if (step === 0 && !nickname.trim()) { toast.error("Please enter a nickname"); return; }
    if (step === 1 && !familyName.trim()) { toast.error("Please enter your family name"); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function addChild() {
    if (!newChild.username.trim()) { toast.error("Please enter a username for the child"); return; }
    setChildren((prev) => [...prev, { ...newChild }]);
    setNewChild({ username: "", role: "Son", gender: "", avatar_emoji: "🧒" });
    setAddingChild(false);
  }

  function addInvite() {
    if (!newInvite.name.trim()) { toast.error("Please enter a name"); return; }
    if (!newInvite.email && !newInvite.phone) { toast.error("Please enter an email or phone"); return; }
    setInvites((prev) => [...prev, { ...newInvite }]);
    setNewInvite({ name: "", email: "", phone: "" });
    setAddingInvite(false);
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Create family
      const { data: family, error: fErr } = await supabase
        .from("families")
        .insert({ name: familyName.trim(), created_by: user.id })
        .select()
        .single();
      if (fErr || !family) throw fErr || new Error("Failed to create family");

      // 2. Create parent member
      const parentColor = MEMBER_COLORS[0];
      const { data: parentMember, error: mErr } = await supabase
        .from("family_members")
        .insert({
          family_id: family.id,
          user_id: user.id,
          role,
          nickname: nickname.trim(),
          avatar_emoji: avatar,
          is_child: false,
          color: parentColor,
        })
        .select()
        .single();
      if (mErr || !parentMember) throw mErr || new Error("Failed to create member");

      // 3. Create child profiles
      if (children.length > 0) {
        const childInserts = children.map((c, i) => ({
          family_id: family.id,
          user_id: null,
          role: c.role,
          nickname: c.username,
          avatar_emoji: c.avatar_emoji,
          is_child: true,
          color: MEMBER_COLORS[(i + 1) % MEMBER_COLORS.length],
          gender: c.gender || null,
        }));
        await supabase.from("family_members").insert(childInserts);
      }

      // 4. Create invites
      if (invites.length > 0) {
        const inviteInserts = invites.map((inv) => ({
          family_id: family.id,
          invited_by: parentMember.id,
          name: inv.name,
          email: inv.email || null,
          phone: inv.phone || null,
        }));
        await supabase.from("invites").insert(inviteInserts);
      }

      await refreshFamily();
      navigate("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const stepEmojis = ["✍️", "🏠", "👧", "💌"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 py-8 flex-1 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <span className="text-2xl">📚</span>
          <span className="font-display font-bold text-xl text-primary">Bookie</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/25" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full ${i < step ? "bg-primary" : "bg-muted"}`} style={{width:24}} />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1">
          <div className="mb-6">
            <span className="text-4xl block mb-3">{stepEmojis[step]}</span>
            <h2 className="font-display text-2xl font-bold text-foreground">{STEPS[step]}</h2>
          </div>

          {/* Step 0: Your profile */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Your nickname (used in the app)</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Mum, Sarah, Dad"
                  className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Your role in the family</label>
                <div className="flex flex-wrap gap-2">
                  {PARENT_ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                        role === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/50"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Choose your avatar</label>
                <EmojiPicker value={avatar} onChange={setAvatar} />
              </div>
            </div>
          )}

          {/* Step 1: Family name */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Family name</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="e.g. The Smiths"
                  className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base"
                />
                <p className="text-xs text-muted-foreground mt-1.5">This is shown in the app header and shared with family members.</p>
              </div>
              <div className="bg-secondary/50 rounded-2xl p-4 border border-border">
                <p className="text-sm font-semibold mb-1">Preview</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{avatar}</span>
                  <div>
                    <p className="text-sm font-bold">{nickname || "You"}</p>
                    <p className="text-xs text-muted-foreground">{role} · {familyName || "The Smiths"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Add children */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Add your children's reading profiles. They don't need to sign in — you manage their reading for them.</p>

              {children.map((c, i) => (
                <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                  <span className="text-2xl">{c.avatar_emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{c.username}</p>
                    <p className="text-xs text-muted-foreground">{c.role}{c.gender ? ` · ${c.gender}` : ""}</p>
                  </div>
                  <button onClick={() => setChildren((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}

              {addingChild ? (
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        value={newChild.username}
                        onChange={(e) => setNewChild((p) => ({ ...p, username: e.target.value }))}
                        placeholder="Username (e.g. Timmy)"
                        className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
                      />
                      <div className="flex gap-2 flex-wrap">
                        {CHILD_ROLES.map((r) => (
                          <button key={r} onClick={() => setNewChild((p) => ({ ...p, role: r }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${newChild.role === r ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                      <select
                        value={newChild.gender}
                        onChange={(e) => setNewChild((p) => ({ ...p, gender: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
                      >
                        <option value="">Gender (optional)</option>
                        <option value="Boy">Boy</option>
                        <option value="Girl">Girl</option>
                        <option value="Non-binary">Non-binary</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Choose avatar</p>
                    <EmojiPicker value={newChild.avatar_emoji} onChange={(e) => setNewChild((p) => ({ ...p, avatar_emoji: e }))} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={addChild} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Add child</button>
                    <button onClick={() => setAddingChild(false)} className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-semibold">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingChild(true)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add a child
                </button>
              )}
              <p className="text-xs text-muted-foreground text-center">You can always add more children from Settings later.</p>
            </div>
          )}

          {/* Step 3: Invite family */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Invite a partner, grandparent, or anyone else to join your family library. They'll receive a link to sign up.</p>

              {invites.map((inv, i) => (
                <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                  <span className="text-2xl">👤</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{inv.name}</p>
                    <p className="text-xs text-muted-foreground">{inv.email || inv.phone}</p>
                  </div>
                  <button onClick={() => setInvites((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}

              {addingInvite ? (
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <input
                    type="text"
                    value={newInvite.name}
                    onChange={(e) => setNewInvite((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Their name (e.g. Dad)"
                    className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                  <input
                    type="email"
                    value={newInvite.email}
                    onChange={(e) => setNewInvite((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Email address"
                    className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                  <input
                    type="tel"
                    value={newInvite.phone}
                    onChange={(e) => setNewInvite((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="WhatsApp number (optional)"
                    className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                  <div className="flex gap-2 pt-1">
                    <button onClick={addInvite} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1">
                      <Send size={14} /> Add invite
                    </button>
                    <button onClick={() => setAddingInvite(false)} className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-semibold">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingInvite(true)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Invite a family member
                </button>
              )}
              <p className="text-xs text-muted-foreground text-center">You can skip this and invite from Settings later.</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-8 pb-4">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-5 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold flex items-center gap-1 hover:bg-muted transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={nextStep}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-md shadow-primary/20"
            >
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-md shadow-primary/20 disabled:opacity-60"
            >
              {saving ? "Setting up..." : "Let's start reading! 🎉"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
