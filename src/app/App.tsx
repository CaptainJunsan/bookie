import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "../contexts/AuthContext";
import { Toaster } from "../app/components/ui/sonner";
import { isSupabaseConfigured } from "../lib/supabase";

function SupabaseSetupScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-12 text-center">
      <span className="text-6xl mb-6">📚</span>
      <h1 className="font-display text-3xl font-bold text-foreground mb-3">
        Welcome to Bookie!
      </h1>
      <p className="text-muted-foreground text-base mb-8 max-w-sm leading-relaxed">
        Almost there! To get started, connect your Supabase project by adding these environment variables:
      </p>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-5 text-left space-y-3 mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Required env vars</p>
        {[
          { key: "VITE_SUPABASE_URL", desc: "Your Supabase project URL" },
          { key: "VITE_SUPABASE_ANON_KEY", desc: "Your Supabase anon/public key" },
        ].map(({ key, desc }) => (
          <div key={key} className="bg-muted rounded-xl px-4 py-3">
            <p className="font-mono text-sm font-bold text-foreground">{key}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
      <div className="w-full max-w-md bg-secondary rounded-2xl p-4 text-left text-sm text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground text-sm">Then run the schema:</p>
        <p>Go to your Supabase dashboard → SQL Editor and paste the contents of <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">supabase/schema.sql</code></p>
      </div>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <>
        <SupabaseSetupScreen />
        <Toaster richColors position="top-center" />
      </>
    );
  }

  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}
