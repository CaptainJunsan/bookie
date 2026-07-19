import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Eye, EyeOff, ArrowRight, Check, Users, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker from "../components/EmojiPicker";
import { MEMBER_COLORS, PARENT_ROLES, genderFromRole } from "../lib/types";
import type { FamilyMember } from "../lib/types";
import { toast } from "sonner";
import { cn } from "../app/components/ui/utils";

type Step = "loading" | "invalid" | "account" | "join" | "joining" | "done";

interface ClubInfo {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
}

export default function ClubInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, member, allMembers, refreshFamily } = useAuth();

  const [step, setStep] = useState<Step>("loading");
  const [club, setClub] = useState<ClubInfo | null>(null);

  // Account creation fields (for unauthenticated visitors)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Profile creation (only shown when user has no family yet)
  const [needsProfile, setNeedsProfile] = useState(false);
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState("Mom");
  const [avatar, setAvatar] = useState("📚");

  // Join selection — which family members to enroll in the club
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadClub();
  }, [token, user]);

  async function loadClub() {
    if (!token) { setStep("invalid"); return; }

    const { data } = await supabase
      .from("clubs")
      .select("id, name, emoji, description")
      .eq("invite_token", token)
      .single();

    if (!data) { setStep("invalid"); return; }
    setClub(data);

    if (!user) {
      setStep("account");
      return;
    }

    // User is authenticated — check if they have a family
    const { data: fm } = await supabase
      .from("family_members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!fm) {
      // Authenticated but no family — needs profile creation
      setNeedsProfile(true);
      setStep("join");
      return;
    }

    // Already a member of the club?
    const famMemberIds = allMembers.map((m) => m.id);
    if (famMemberIds.length) {
      const { data: existing } = await supabase
        .from("club_members")
        .select("id")
        .eq("club_id", data.id)
        .in("family_member_id", famMemberIds)
        .limit(1);
      if (existing && existing.length > 0) {
        // Already in the club — redirect
        navigate(`/clubs/${data.id}`);
        return;
      }
    }

    setStep("join");
  }

  async function handleAccount(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already registered")) {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) throw signInError;
        } else {
          throw signUpError;
        }
      }
      // loadClub will re-run via useEffect when user state updates
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleJoin() {
    if (!club) return;
    if (needsProfile && !nickname.trim()) {
      toast.error("Please enter a nickname");
      return;
    }
    setJoining(true);
    try {
      let targetMemberIds = selectedIds;

      if (needsProfile) {
        // Create family + member first
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("Not signed in");

        const { data: newFamily, error: famErr } = await supabase
          .from("families")
          .insert({ name: `${nickname.trim()}'s Family`, created_by: currentUser.id })
          .select()
          .single();
        if (famErr) throw famErr;

        const color = MEMBER_COLORS[0];
        const { data: newMember, error: memErr } = await supabase
          .from("family_members")
          .insert({
            family_id: newFamily.id,
            user_id: currentUser.id,
            role,
            nickname: nickname.trim(),
            avatar_emoji: avatar,
            is_child: false,
            color,
            gender: genderFromRole(role) || null,
          })
          .select()
          .single();
        if (memErr) throw memErr;

        targetMemberIds = [newMember.id];
        await refreshFamily();
      }

      if (targetMemberIds.length === 0 && !needsProfile) {
        toast.error("Please select at least one family member to join with");
        setJoining(false);
        return;
      }

      // Enroll selected members
      const rows = targetMemberIds.map((fmId) => ({
        club_id: club.id,
        family_member_id: fmId,
        role: "member",
      }));
      const { error } = await supabase
        .from("club_members")
        .upsert(rows, { onConflict: "club_id,family_member_id" });
      if (error) throw error;

      // Notify existing club members
      const { data: existingCm } = await supabase
        .from("club_members")
        .select("family_member_id")
        .eq("club_id", club.id)
        .not("family_member_id", "in", `(${targetMemberIds.join(",")})`);

      const existingIds = (existingCm || []).map((r: { family_member_id: string }) => r.family_member_id);
      if (existingIds.length) {
        const joinerName = needsProfile
          ? nickname.trim()
          : (member?.nickname || "Someone");
        await supabase.from("club_notifications").insert(
          existingIds.map((mid: string) => ({
            club_id: club.id,
            member_id: mid,
            type: "new_member",
            title: `👋 ${joinerName} joined ${club.name}`,
          })),
        );
      }

      setStep("done");
      setTimeout(() => navigate(`/clubs/${club.id}`), 1400);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to join club");
    } finally {
      setJoining(false);
    }
  }

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // ── Loading ──
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-5xl animate-bounce">📚</span>
      </div>
    );
  }

  // ── Invalid ──
  if (step === "invalid") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center gap-4">
        <span className="text-5xl">🔗</span>
        <h1 className="font-display text-2xl font-bold">Invalid invite link</h1>
        <p className="text-muted-foreground max-w-xs">
          This club invite link is invalid. Ask the club owner to share a fresh one.
        </p>
        <button
          onClick={() => navigate("/clubs")}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90"
        >
          Browse clubs
        </button>
      </div>
    );
  }

  // ── Success ──
  if (step === "done" || step === "joining") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center gap-4">
        <span className="text-5xl">{club?.emoji || "🎉"}</span>
        <h1 className="font-display text-2xl font-bold">
          Welcome to {club?.name}!
        </h1>
        <p className="text-muted-foreground">Taking you to the club...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">

          {/* Club header */}
          {club && (
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">{club.emoji}</div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                {step === "account" ? "Create your account" : `Join ${club.name}`}
              </h1>
              {club.description && step !== "account" && (
                <p className="text-muted-foreground text-sm mt-2 italic">"{club.description}"</p>
              )}
              {step === "account" && (
                <p className="text-muted-foreground text-sm mt-2">
                  You've been invited to join <strong>{club.name}</strong> on Bookie
                </p>
              )}
            </div>
          )}

          {/* Progress indicator */}
          {step === "join" && !needsProfile && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                <Check size={14} />
              </div>
              <div className="w-8 h-0.5 rounded-full bg-primary" />
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground ring-4 ring-primary/25 flex items-center justify-center text-xs font-bold">
                2
              </div>
            </div>
          )}

          {/* ── Step: Account ── */}
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
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border outline-none focus:ring-2 focus:ring-ring text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-card border border-border outline-none focus:ring-2 focus:ring-ring text-base"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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

          {/* ── Step: Join ── */}
          {step === "join" && (
            <div className="space-y-5">
              {/* New user needs to set up a profile first */}
              {needsProfile && (
                <>
                  <div className="bg-secondary rounded-xl px-4 py-3 border border-border">
                    <p className="text-sm font-semibold">First, set up your reading profile</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      You'll join <strong>{club?.name}</strong> right after.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1.5">Your nickname</label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="e.g. Lily, Max"
                      className="w-full px-4 py-3 rounded-xl bg-card border border-border outline-none focus:ring-2 focus:ring-ring text-base"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Your role</label>
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

                  <div>
                    <label className="block text-sm font-semibold mb-2">Choose your avatar</label>
                    <EmojiPicker value={avatar} onChange={setAvatar} />
                  </div>
                </>
              )}

              {/* Existing user: choose which family members join */}
              {!needsProfile && allMembers.length > 0 && (
                <>
                  <div className="bg-secondary rounded-xl px-4 py-3 border border-border">
                    <p className="text-sm font-semibold">
                      👋 Who's joining <strong>{club?.name}</strong>?
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select yourself, your kids, or any family members you'd like to add.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {allMembers.map((fm: FamilyMember) => {
                      const selected = selectedIds.includes(fm.id);
                      return (
                        <button
                          key={fm.id}
                          onClick={() => toggleMember(fm.id)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary/40",
                          )}
                        >
                          <span className="text-2xl">{fm.avatar_emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{fm.nickname}</p>
                            <p className="text-xs text-muted-foreground">
                              {fm.role}{fm.is_child ? " · child profile" : ""}
                            </p>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            selected ? "border-primary bg-primary" : "border-muted-foreground",
                          )}>
                            {selected && <Check size={11} className="text-primary-foreground" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <button
                onClick={handleJoin}
                disabled={joining || (!needsProfile && selectedIds.length === 0) || (needsProfile && !nickname.trim())}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 shadow-md shadow-primary/25 flex items-center justify-center gap-2"
              >
                {joining
                  ? <><Loader2 size={18} className="animate-spin" /> Joining...</>
                  : <><Users size={18} /> Join {club?.name}</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
