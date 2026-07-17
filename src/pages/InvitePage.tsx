import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker from "../components/EmojiPicker";
import { MEMBER_COLORS, PARENT_ROLES, genderFromRole } from "../lib/types";
import { toast } from "sonner";
import type { Invite } from "../lib/types";

type Step = "loading" | "invalid" | "account" | "profile" | "joining" | "done";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, refreshFamily } = useAuth();

  const [step, setStep] = useState<Step>("loading");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [isChildClaim, setIsChildClaim] = useState(false); // invite targets an existing child member
  // family name stored separately because the families(*) join is RLS-blocked for non-members
  const [familyName, setFamilyName] = useState<string>("your family");

  // Account fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Profile fields
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState("Mom");
  const [avatar, setAvatar] = useState("📚");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInvite();
  }, [token]);

  // Once user is authed (either already or after account step), move to profile
  useEffect(() => {
    if (user && step === "account") setStep("profile");
  }, [user, step]);

  async function loadInvite() {
    if (!token) { setStep("invalid"); return; }

    const { data } = await supabase
      .from("invites")
      .select("*, families(name)")
      .eq("token", token)
      .single();

    if (
      !data ||
      data.accepted_at ||
      new Date(data.expires_at) < new Date()
    ) {
      setStep("invalid");
      return;
    }

    setInvite(data as Invite);
    // families join may be null due to RLS — use it when available, fallback otherwise
    const resolvedName = (data as unknown as { families: { name: string } | null }).families?.name;
    if (resolvedName) setFamilyName(resolvedName);
    if (data.email) setEmail(data.email);
    // Pre-fill the nickname from whatever name was entered when sending the invite
    if (data.name) setNickname(data.name);
    // Detect child-claim invites (those pointing to an existing child member)
    if (data.member_id) setIsChildClaim(true);

    // If already signed in, check if already in this family
    if (user) {
      const { data: existing } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("family_id", data.family_id)
        .single();
      if (existing) {
        // Already a member — just go to dashboard
        await refreshFamily();
        navigate("/dashboard");
        return;
      }
      setStep("profile");
    } else {
      setStep("account");
    }
  }

  async function handleAccount(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    try {
      // Try sign up first; if email exists, fall back to sign in
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already registered")) {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) throw signInError;
        } else {
          throw signUpError;
        }
      }
      setStep("profile");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function joinFamily() {
    if (!invite) { toast.error("Invite not loaded — please refresh"); return; }
    if (!nickname.trim()) { toast.error("Please enter a nickname"); return; }
    setSaving(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not signed in");

      if (isChildClaim) {
        // Child claiming their pre-created profile — use SECURITY DEFINER RPC to link user_id.
        // Also update nickname/avatar if the child personalised them.
        const { error: rpcError } = await supabase.rpc("claim_child_member", { p_token: token! });
        if (rpcError) throw rpcError;
        // Update personalised nickname/avatar if changed
        if (invite.member_id) {
          await supabase.from("family_members").update({
            nickname: nickname.trim(),
            avatar_emoji: avatar,
          }).eq("id", invite.member_id);
        }
      } else {
        // Regular new-member join
        const familyId = invite.family_id;
        const { data: existingMembers } = await supabase
          .from("family_members").select("id").eq("family_id", familyId);
        const color = MEMBER_COLORS[(existingMembers?.length ?? 0) % MEMBER_COLORS.length];

        const { error: memberError } = await supabase.from("family_members").insert({
          family_id: familyId,
          user_id: currentUser.id,
          role,
          nickname: nickname.trim(),
          avatar_emoji: avatar,
          is_child: false,
          color,
          gender: genderFromRole(role) || null,
        });
        if (memberError) throw memberError;

        await supabase.from("invites").delete().eq("token", token!);
      }

      setStep("joining");
      await refreshFamily();

      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to join family");
      setSaving(false);
    }
  }

  // ── LOADING ──
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-5xl animate-bounce">📚</span>
      </div>
    );
  }

  // ── INVALID ──
  if (step === "invalid") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center gap-4">
        <span className="text-5xl">🔗</span>
        <h1 className="font-display text-2xl font-bold">Invite expired or invalid</h1>
        <p className="text-muted-foreground max-w-xs">
          This invite code is no longer valid — it may have expired (24 hours) or already been used.
          Ask your family to send a new one from Settings.
        </p>
        <button
          onClick={() => navigate("/auth")}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90"
        >
          Go to sign in
        </button>
      </div>
    );
  }

  // ── SUCCESS ──
  if (step === "done" || step === "joining") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center gap-4">
        <span className="text-5xl">🎉</span>
        <h1 className="font-display text-2xl font-bold">Welcome to {familyName}!</h1>
        <p className="text-muted-foreground">Taking you to the family dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">📚</div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {step === "account" ? "Create your account" : `Join ${familyName}`}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {step === "account"
                ? `You've been invited to join ${familyName} on Bookie`
                : "Set up your reading profile"}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {["account", "profile"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s === step
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/25"
                    : step === "profile" && s === "account"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {step === "profile" && s === "account" ? <Check size={14} /> : i + 1}
                </div>
                {i === 0 && <div className={`w-8 h-0.5 rounded-full ${step === "profile" ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>

          {/* ── STEP 1: Account ── */}
          {step === "account" && (
            <form onSubmit={handleAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Choose a password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Already have a Bookie account? Enter your existing password to sign in.
                </p>
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 shadow-md shadow-primary/25 flex items-center justify-center gap-2"
              >
                {authLoading ? "Please wait..." : <>Continue <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {/* ── STEP 2: Profile ── */}
          {step === "profile" && (
            <div className="space-y-5">
              <div className="bg-secondary rounded-xl px-4 py-3 flex items-center gap-3 border border-border">
                <span className="text-2xl">{isChildClaim ? "👋" : "🎉"}</span>
                <p className="text-sm font-semibold text-foreground">
                  {isChildClaim
                    ? <>Welcome, <strong>{nickname || "there"}</strong>! Make this profile your own.</>
                    : <>You're joining <strong>{familyName}</strong></>
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">Your nickname</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Lily, Max, Grandma"
                  className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base"
                  autoFocus
                />
              </div>

              {/* Role selector only for new (non-child-claim) members */}
              {!isChildClaim && (
                <div>
                  <label className="block text-sm font-semibold mb-2">Your role in the family</label>
                  <div className="flex flex-wrap gap-2">
                    {PARENT_ROLES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                          role === r
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2">Choose your avatar</label>
                <EmojiPicker value={avatar} onChange={setAvatar} />
              </div>

              <button
                onClick={joinFamily}
                disabled={saving || !nickname.trim()}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 shadow-md shadow-primary/25 flex items-center justify-center gap-2"
              >
                {saving ? "Joining..." : <>Join {familyName} <ArrowRight size={18} /></>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
