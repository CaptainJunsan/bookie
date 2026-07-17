import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker from "../components/EmojiPicker";
import { MEMBER_COLORS, PARENT_ROLES } from "../lib/types";
import { toast } from "sonner";
import type { Invite, Family } from "../lib/types";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, refreshFamily } = useAuth();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  // Auth fields (for new users)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Profile fields
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState("Dad");
  const [avatar, setAvatar] = useState("📗");
  const [step, setStep] = useState<"auth" | "profile" | "done">(user ? "profile" : "auth");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      if (!token) { setInvalid(true); setLoading(false); return; }
      // Support both 6-digit codes and old long hex tokens
      const { data } = await supabase
        .from("invites")
        .select("*, families(*)")
        .eq("token", token)
        .single();

      if (!data || data.accepted_at || new Date(data.expires_at) < new Date()) {
        setInvalid(true);
      } else {
        setInvite(data as Invite);
        setFamily((data as unknown as { families: Family }).families);
        if (data.email) setEmail(data.email);
        if (user) setStep("profile");
      }
      setLoading(false);
    }
    loadInvite();
  }, [token, user]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setStep("profile");
    } catch (err: unknown) {
      // Try sign in if already exists
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        toast.error(err instanceof Error ? err.message : "Auth failed");
      } else {
        setStep("profile");
      }
    } finally {
      setSaving(false);
    }
  }

  async function joinFamily() {
    if (!invite || !family) return;
    setSaving(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not signed in");

      // Check if already in this family
      const { data: existingMember } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", currentUser.id)
        .eq("family_id", family.id)
        .single();

      if (!existingMember) {
        const existingCount = await supabase
          .from("family_members")
          .select("id")
          .eq("family_id", family.id);

        const color = MEMBER_COLORS[(existingCount.data?.length ?? 0) % MEMBER_COLORS.length];

        await supabase.from("family_members").insert({
          family_id: family.id,
          user_id: currentUser.id,
          role,
          nickname: nickname.trim(),
          avatar_emoji: avatar,
          is_child: false,
          color,
        });
      }

      // Mark invite accepted
      await supabase.from("invites").update({ accepted_at: new Date().toISOString() }).eq("token", token!);

      await refreshFamily();
      setStep("done");
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to join family");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-4xl animate-bounce">📚</span>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center">
        <span className="text-5xl mb-4">🔗</span>
        <h1 className="font-display text-2xl font-bold mb-2">Invite expired or invalid</h1>
        <p className="text-muted-foreground mb-6">This invite link is no longer valid. Ask your family to send a new one.</p>
        <button onClick={() => navigate("/")} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold">
          Go to Bookie
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl block mb-4">📚</span>
          <h1 className="font-display text-3xl font-bold mb-2">You're invited!</h1>
          <p className="text-muted-foreground">
            Join <strong className="text-foreground">{family?.name}</strong> on Bookie and start tracking your reading adventures together.
          </p>
        </div>

        {step === "done" && (
          <div className="text-center py-8">
            <span className="text-5xl block mb-4">🎉</span>
            <h2 className="font-display text-2xl font-bold mb-2">Welcome to the family!</h2>
            <p className="text-muted-foreground">Taking you to the dashboard...</p>
          </div>
        )}

        {step === "auth" && (
          <form onSubmit={handleAuth} className="space-y-4">
            <p className="text-sm font-semibold text-center text-muted-foreground mb-2">Create your account or sign in</p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base"
            />
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 8 characters)"
                minLength={8}
                className="w-full px-4 py-3 pr-11 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-60">
              {saving ? "Please wait..." : "Continue"}
            </button>
          </form>
        )}

        {step === "profile" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground text-center">Tell us a bit about yourself so the family knows who you are.</p>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Your nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Dad, Gran, Uncle John"
                className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Your role</label>
              <div className="flex flex-wrap gap-2">
                {PARENT_ROLES.map((r) => (
                  <button key={r} onClick={() => setRole(r)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${role === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Choose your avatar</label>
              <EmojiPicker value={avatar} onChange={setAvatar} />
            </div>
            <button
              onClick={joinFamily}
              disabled={saving || !nickname.trim()}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-primary/25"
            >
              {saving ? "Joining..." : "Join the family!"} <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
