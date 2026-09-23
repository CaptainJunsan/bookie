import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Eye, EyeOff, ArrowRight, Check, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker from "../components/EmojiPicker";
import { MEMBER_COLORS } from "../lib/types";
import type { FamilyMember } from "../lib/types";
import { toast } from "sonner";

type ClassPreview = { class_id: string; class_name: string; grade_name: string; school_id: string; school_name: string };
type HandoverPreview = { nickname: string; avatar_emoji: string; school_name: string; class_name: string };
type StaffPreview = { school_name: string; role: string; class_name: string | null };

type Mode = "loading" | "enter-code" | "invalid" | "account" | "class-join" | "handover" | "staff-invite" | "done";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, member, family, allMembers, refreshFamily } = useAuth();

  const [enteredCode, setEnteredCode] = useState("");
  const [mode, setMode] = useState<Mode>("loading");
  const [classPreview, setClassPreview] = useState<ClassPreview | null>(null);
  const [handoverPreview, setHandoverPreview] = useState<HandoverPreview | null>(null);
  const [staffPreview, setStaffPreview] = useState<StaffPreview | null>(null);
  const [doneMessage, setDoneMessage] = useState("");

  // Account step
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Quick "add my child" (class-join, when the family has no children yet)
  const [addingChild, setAddingChild] = useState(false);
  const [childNickname, setChildNickname] = useState("");
  const [childAvatar, setChildAvatar] = useState("🧒");
  const [savingChild, setSavingChild] = useState(false);

  const [busy, setBusy] = useState(false);

  useEffect(() => { resolveCode(); }, [code]);

  async function resolveCode() {
    if (!code) { setMode("enter-code"); return; }
    setMode("loading");

    const [classRes, handoverRes, staffRes] = await Promise.all([
      supabase.rpc("get_class_by_join_code", { p_code: code }),
      supabase.rpc("get_handover_preview", { p_code: code }),
      supabase.rpc("get_staff_invite_preview", { p_code: code }),
    ]);

    const classRow = (classRes.data as ClassPreview[] | null)?.[0];
    const handoverRow = (handoverRes.data as HandoverPreview[] | null)?.[0];
    const staffRow = (staffRes.data as StaffPreview[] | null)?.[0];

    if (!classRow && !handoverRow && !staffRow) { setMode("invalid"); return; }

    if (!user) {
      // Remember what we were resolving; re-run once signed in.
      setClassPreview(classRow ?? null);
      setHandoverPreview(handoverRow ?? null);
      setStaffPreview(staffRow ?? null);
      setMode("account");
      return;
    }

    if (!family) {
      // No family yet at all — send through onboarding, then bounce back here.
      navigate(`/onboarding?returnTo=${encodeURIComponent(`/join/${code}`)}`);
      return;
    }

    if (classRow) { setClassPreview(classRow); setMode("class-join"); return; }
    if (handoverRow) { setHandoverPreview(handoverRow); setMode("handover"); return; }
    if (staffRow) { setStaffPreview(staffRow); setMode("staff-invite"); return; }
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
      await resolveCode();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function linkExistingChild(childId: string) {
    if (!classPreview) return;
    setBusy(true);
    const child = allMembers.find((m) => m.id === childId);
    try {
      const { error } = await supabase.from("class_learners").insert({
        class_id: classPreview.class_id,
        school_id: classPreview.school_id,
        family_member_id: childId,
        nickname: child?.nickname ?? "Reader",
        avatar_emoji: child?.avatar_emoji ?? "🧒",
        is_school_created: false,
      });
      if (error) throw error;
      setDoneMessage(`${child?.nickname ?? "Your child"} is now in ${classPreview.grade_name} · ${classPreview.class_name} at ${classPreview.school_name}!`);
      setMode("done");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not link this profile");
    } finally {
      setBusy(false);
    }
  }

  async function addChildAndLink() {
    if (!childNickname.trim() || !family || !member || !classPreview) return;
    setSavingChild(true);
    try {
      const color = MEMBER_COLORS[allMembers.length % MEMBER_COLORS.length];
      const { data: newChild, error } = await supabase.from("family_members").insert({
        family_id: family.id, user_id: null, role: "Other",
        nickname: childNickname.trim(), avatar_emoji: childAvatar, is_child: true, color,
      }).select().single();
      if (error) throw error;
      await refreshFamily();
      await linkExistingChild(newChild.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not add child");
    } finally {
      setSavingChild(false);
    }
  }

  async function claimHandover() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("claim_class_learner", { p_handover_code: code });
      if (error) throw error;
      await refreshFamily();
      setDoneMessage(`${handoverPreview?.nickname}'s profile is now part of your family! You can personalise it any time in Settings.`);
      setMode("done");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not claim this profile");
    } finally {
      setBusy(false);
    }
  }

  async function acceptStaffInvite() {
    setBusy(true);
    try {
      const { data: schoolId, error } = await supabase.rpc("accept_staff_invite", { p_code: code });
      if (error) throw error;
      toast.success(`You're now ${staffPreview?.role === "admin" ? "an admin" : "a teacher"} at ${staffPreview?.school_name}!`);
      navigate(`/schools/${schoolId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not accept this invite");
    } finally {
      setBusy(false);
    }
  }

  const myChildren = allMembers.filter((m) => m.is_child) as FamilyMember[];

  if (mode === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-5xl animate-bounce">📚</span>
      </div>
    );
  }

  if (mode === "enter-code") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center gap-5">
        <span className="text-5xl">🔑</span>
        <div>
          <h1 className="font-display text-2xl font-bold">Enter your code</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">A class code, handover code, or staff invite code from your school.</p>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (enteredCode.trim()) navigate(`/join/${enteredCode.trim().toUpperCase()}`); }}
          className="w-full max-w-xs space-y-3"
        >
          <input
            autoFocus value={enteredCode} onChange={(e) => setEnteredCode(e.target.value)}
            placeholder="e.g. 4F92A1" maxLength={12}
            className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base text-center tracking-widest font-bold uppercase"
          />
          <button type="submit" disabled={!enteredCode.trim()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-60">
            Continue
          </button>
        </form>
      </div>
    );
  }

  if (mode === "invalid") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center gap-4">
        <span className="text-5xl">🔗</span>
        <h1 className="font-display text-2xl font-bold">Code not recognised</h1>
        <p className="text-muted-foreground max-w-xs">This code may have expired or already been used. Check it with whoever shared it with you.</p>
        <button onClick={() => setMode("enter-code")} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90">Try another code</button>
      </div>
    );
  }

  if (mode === "done") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center gap-4">
        <span className="text-5xl">🎉</span>
        <h1 className="font-display text-2xl font-bold">All set!</h1>
        <p className="text-muted-foreground max-w-sm">{doneMessage}</p>
        <button onClick={() => navigate("/dashboard")} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90">Go to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">

          {mode === "account" && (
            <>
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">📚</div>
                <h1 className="font-display text-3xl font-bold text-foreground">Sign in to continue</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  {classPreview && `You're joining ${classPreview.grade_name} · ${classPreview.class_name} at ${classPreview.school_name}.`}
                  {handoverPreview && `You're claiming ${handoverPreview.nickname}'s profile from ${handoverPreview.school_name}.`}
                  {staffPreview && `You've been invited to join ${staffPreview.school_name}.`}
                </p>
              </div>
              <form onSubmit={handleAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Email address</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters" minLength={8} autoComplete="new-password"
                      className="w-full px-4 py-3 pr-11 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Already have a Bookie account? Enter your existing password to sign in.</p>
                </div>
                <button type="submit" disabled={authLoading}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                  {authLoading ? "Please wait…" : <>Continue <ArrowRight size={18} /></>}
                </button>
              </form>
            </>
          )}

          {mode === "class-join" && classPreview && (
            <>
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🎓</div>
                <h1 className="font-display text-2xl font-bold text-foreground">Join {classPreview.grade_name} · {classPreview.class_name}</h1>
                <p className="text-muted-foreground mt-2 text-sm">{classPreview.school_name} — which of your children should join?</p>
              </div>

              {!addingChild ? (
                <div className="space-y-2">
                  {myChildren.map((c) => (
                    <button key={c.id} onClick={() => linkExistingChild(c.id)} disabled={busy}
                      className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-2xl hover:border-school/40 hover:bg-school/5 transition-all text-left disabled:opacity-60">
                      <span className="text-2xl">{c.avatar_emoji}</span>
                      <span className="font-semibold text-sm">{c.nickname}</span>
                      {busy && <Loader2 size={14} className="animate-spin ml-auto text-school" />}
                    </button>
                  ))}
                  <button onClick={() => setAddingChild(true)}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-school hover:text-school transition-colors">
                    + Add a new child profile
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <input autoFocus value={childNickname} onChange={(e) => setChildNickname(e.target.value)}
                    placeholder="Child's nickname" className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base" />
                  <EmojiPicker value={childAvatar} onChange={setChildAvatar} />
                  <button onClick={addChildAndLink} disabled={savingChild || !childNickname.trim()}
                    className="w-full py-3.5 rounded-xl bg-school text-school-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                    {savingChild ? <Loader2 size={16} className="animate-spin" /> : <><Check size={18} /> Add & join class</>}
                  </button>
                  {myChildren.length > 0 && (
                    <button onClick={() => setAddingChild(false)} className="w-full text-sm text-muted-foreground font-semibold">Back to my children</button>
                  )}
                </div>
              )}
            </>
          )}

          {mode === "handover" && handoverPreview && (
            <>
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">{handoverPreview.avatar_emoji}</div>
                <h1 className="font-display text-2xl font-bold text-foreground">Claim {handoverPreview.nickname}'s profile</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  From {handoverPreview.class_name} at {handoverPreview.school_name}. Their reading history moves with them, and you can personalise the profile any time in Settings.
                </p>
              </div>
              <button onClick={claimHandover} disabled={busy}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <><Check size={18} /> Claim this profile</>}
              </button>
            </>
          )}

          {mode === "staff-invite" && staffPreview && (
            <>
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🍎</div>
                <h1 className="font-display text-2xl font-bold text-foreground">Join {staffPreview.school_name}</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  You've been invited as {staffPreview.role === "admin" ? "an admin" : "a teacher"}
                  {staffPreview.class_name ? `, teaching ${staffPreview.class_name}` : ""}.
                </p>
              </div>
              <button onClick={acceptStaffInvite} disabled={busy}
                className="w-full py-3.5 rounded-xl bg-school text-school-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <><Check size={18} /> Accept invite</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
