import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, ArrowLeft, Ticket, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

function extractInviteCode(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  try {
    const url = new URL(s.startsWith("http") ? s : `https://x.com/${s}`);
    const param = url.searchParams.get("invite");
    if (param) return param.trim();
    const segments = url.pathname.split("/").filter(Boolean);
    const codeSegment = segments.find((seg) => /^\d{6}$/.test(seg));
    if (codeSegment) return codeSegment;
  } catch { /* not a URL */ }
  const cleaned = s.replace(/[\s\-]/g, "");
  if (/^\d{6}$/.test(cleaned)) return cleaned;
  if (/^[0-9a-f]{32,}$/.test(s)) return s;
  return s;
}

type AuthMode = "signin" | "signup" | "invite";

export default function AuthPage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(
    params.get("mode") === "signup" ? "signup" : "signin"
  );

  // Normal auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Invite-code mode fields
  const [inviteRaw, setInviteRaw] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);
  const [validatedFamily, setValidatedFamily] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const codeFromUrl = params.get("invite");
    if (codeFromUrl) {
      const code = extractInviteCode(codeFromUrl);
      setInviteRaw(codeFromUrl);
      setInviteCode(code);
      setMode("invite");
      // Auto-validate if arriving via link
      if (code) validateCode(code);
    } else if (params.get("mode") === "signup") {
      setMode("signup");
    }
  }, []);

  function handleInviteInput(val: string) {
    setInviteRaw(val);
    const code = extractInviteCode(val);
    setInviteCode(code);
    setValidatedFamily(null); // reset validation when input changes
  }

  async function validateCode(code?: string) {
    const codeToCheck = code ?? inviteCode;
    if (!codeToCheck) { toast.error("Please enter your invite code"); return; }
    setValidatingCode(true);
    const { data } = await supabase
      .from("invites")
      .select("token, family_id, families(name)")
      .eq("token", codeToCheck)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!data) {
      toast.error("That code is invalid or has expired. Ask your family for a new one.");
      setValidatedFamily(null);
    } else {
      const familyName = (data as unknown as { families: { name: string } }).families?.name ?? "your family";
      setValidatedFamily(familyName);
    }
    setValidatingCode(false);
  }

  function goToInviteOnboarding() {
    if (!inviteCode || !validatedFamily) return;
    navigate(`/invite/${inviteCode}`);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let userId: string;
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        userId = data.user!.id;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        userId = data.user.id;
      }
      const { data: member } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", userId)
        .single();
      navigate(member ? "/dashboard" : "/onboarding");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground mb-6 text-sm"
            >
              <ArrowLeft size={14} /> Home
            </button>
            <div className="text-5xl mb-4">📚</div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {mode === "invite"
                ? "Join your family"
                : mode === "signup"
                ? "Start your library"
                : "Welcome back"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {mode === "invite"
                ? "Enter your invite code to join"
                : mode === "signup"
                ? "Create a free family account"
                : "Sign in to your family library"}
            </p>
          </div>

          {/* ── INVITE CODE MODE ── */}
          {mode === "invite" ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-secondary border border-border space-y-3">
                <label className="block text-sm font-semibold">
                  Your invite code or link
                </label>
                <input
                  type="text"
                  value={inviteRaw}
                  onChange={(e) => handleInviteInput(e.target.value)}
                  placeholder="e.g. 482916  or paste the full link"
                  className="w-full px-3 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base font-mono tracking-widest"
                  autoFocus
                />
                {inviteCode && !validatedFamily && (
                  <button
                    onClick={() => validateCode()}
                    disabled={validatingCode}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-60"
                  >
                    {validatingCode ? "Checking..." : "Validate code"}
                  </button>
                )}

                {validatedFamily && (
                  <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-3 py-2.5">
                    <CheckCircle2 size={18} className="text-primary flex-shrink-0" />
                    <p className="text-sm font-semibold text-primary">
                      You're invited to join <span className="font-bold">{validatedFamily}</span>!
                    </p>
                  </div>
                )}
              </div>

              {validatedFamily && (
                <button
                  onClick={goToInviteOnboarding}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-all shadow-md shadow-primary/25 flex items-center justify-center gap-2"
                >
                  Set up my profile <ArrowRight size={18} />
                </button>
              )}

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                onClick={() => { setMode("signin"); setValidatedFamily(null); }}
                className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm hover:bg-muted transition-colors"
              >
                Sign in to an existing account
              </button>
              <button
                onClick={() => { setMode("signup"); setValidatedFamily(null); }}
                className="w-full py-3 rounded-xl border border-border text-muted-foreground font-semibold text-sm hover:text-foreground hover:border-primary/40 transition-colors"
              >
                Create a new account instead
              </button>
            </div>
          ) : (
            /* ── NORMAL AUTH MODE ── */
            <>
              {/* Mode tabs */}
              <div className="flex bg-muted rounded-xl p-1 mb-6">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      mode === m
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "signin" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="parent@family.com"
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base"
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
                      placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                      minLength={mode === "signup" ? 8 : 1}
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
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 shadow-md shadow-primary/25 mt-2"
                >
                  {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
                </button>
              </form>

              <p className="text-center text-xs text-muted-foreground mt-6">
                {mode === "signup" ? "Already have an account? " : "New to Bookie? "}
                <button
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  className="text-primary font-semibold hover:underline"
                >
                  {mode === "signup" ? "Sign in" : "Sign up free"}
                </button>
              </p>

              {/* Invite code CTA */}
              <div className="mt-6 pt-5 border-t border-border text-center">
                <button
                  onClick={() => setMode("invite")}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
                >
                  <Ticket size={15} /> I have an invite code
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
