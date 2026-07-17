import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

export default function AuthPage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMode(params.get("mode") === "signup" ? "signup" : "signin");
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        navigate("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: member } = await supabase
          .from("family_members")
          .select("id")
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
          .single();
        navigate(member ? "/dashboard" : "/onboarding");
      }
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
            <button onClick={() => navigate("/")} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground mb-6 text-sm">
              <ArrowLeft size={14} /> Home
            </button>
            <div className="text-5xl mb-4">📚</div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {mode === "signup" ? "Start your library" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {mode === "signup" ? "Create a free family account" : "Sign in to your family library"}
            </p>
          </div>

          {/* Tabs */}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-all disabled:opacity-60 shadow-md shadow-primary/25 mt-2"
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

          {mode === "signup" && (
            <p className="text-center text-xs text-muted-foreground mt-3">
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
