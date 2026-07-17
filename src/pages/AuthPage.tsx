import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, ArrowLeft, ChevronDown, ChevronUp, Ticket } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

// Extracts a 6-digit code from whatever the user pastes:
// full URL, partial URL, path with code, or raw 6 digits
function extractInviteCode(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  // Try parsing as a URL
  try {
    const url = new URL(s.startsWith("http") ? s : `https://x.com/${s}`);
    const param = url.searchParams.get("invite");
    if (param) return param.trim();
    const segments = url.pathname.split("/").filter(Boolean);
    const codeSegment = segments.find((seg) => /^\d{6}$/.test(seg));
    if (codeSegment) return codeSegment;
    const last = segments[segments.length - 1];
    if (/^[0-9a-f]{32,}$/.test(last)) return last; // old long token
  } catch { /* not a URL */ }

  // Raw 6-digit code (ignore spaces/dashes)
  const cleaned = s.replace(/[\s\-]/g, "");
  if (/^\d{6}$/.test(cleaned)) return cleaned;

  // Old long hex token pasted directly
  if (/^[0-9a-f]{32,}$/.test(s)) return s;

  return s;
}

export default function AuthPage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    params.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRaw, setInviteRaw] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const navigate = useNavigate();

  // Auto-detect invite code from URL param (?invite=123456)
  useEffect(() => {
    const codeFromUrl = params.get("invite");
    if (codeFromUrl) {
      setInviteRaw(codeFromUrl);
      setInviteCode(extractInviteCode(codeFromUrl));
      setShowInvite(true);
    }
    setMode(params.get("mode") === "signup" ? "signup" : "signin");
  }, [params]);

  function handleInviteInput(val: string) {
    setInviteRaw(val);
    setInviteCode(extractInviteCode(val));
  }

  async function handleSubmit(e: React.FormEvent) {
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

      if (inviteCode) {
        // Validate the invite code exists and is still valid
        const { data: invite, error: inviteErr } = await supabase
          .from("invites")
          .select("token, family_id")
          .eq("token", inviteCode)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .single();

        if (inviteErr || !invite) {
          toast.error("That invite code is invalid or has expired. Ask your family to send a new one.");
          setLoading(false);
          return;
        }

        // Hand off to InvitePage for profile setup + family join
        navigate(`/invite/${inviteCode}`);
      } else {
        const { data: member } = await supabase
          .from("family_members")
          .select("id")
          .eq("user_id", userId)
          .single();
        navigate(member ? "/dashboard" : "/onboarding");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const codeIsValid = inviteCode.length >= 6;

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
              {mode === "signup" ? "Start your library" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {mode === "signup"
                ? "Create a free family account"
                : "Sign in to your family library"}
            </p>
          </div>

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@family.com"
                className="w-full px-4 py-3 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base transition-all"
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
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-base transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Invite code section */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowInvite((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
              >
                <Ticket size={15} />
                I have an invite code
                {showInvite ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showInvite && (
                <div className="mt-3 p-4 rounded-xl bg-secondary border border-border space-y-2">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Paste your invite link or type your 6-digit code
                  </label>
                  <input
                    type="text"
                    value={inviteRaw}
                    onChange={(e) => handleInviteInput(e.target.value)}
                    placeholder="e.g. 482916  or  https://bookie.app/auth?invite=482916"
                    className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
                  />
                  {inviteRaw && (
                    <p className={`text-xs font-semibold flex items-center gap-1 ${codeIsValid ? "text-primary" : "text-muted-foreground"}`}>
                      {codeIsValid ? "✅" : "⏳"}{" "}
                      {codeIsValid ? `Code detected: ${inviteCode}` : "Paste your full invite link or 6-digit code"}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-all disabled:opacity-60 shadow-md shadow-primary/25 mt-2"
            >
              {loading
                ? "Please wait..."
                : inviteCode
                ? mode === "signup"
                  ? "Create account & join family"
                  : "Sign in & join family"
                : mode === "signup"
                ? "Create account"
                : "Sign in"}
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
        </div>
      </div>
    </div>
  );
}
