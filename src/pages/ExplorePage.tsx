import { useNavigate } from "react-router";
import { Search, BookOpen, Users, Trophy, PlusCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

/**
 * ExplorePage — the 4th nav tab. A multi-purpose discovery hub:
 * - School card (shown if user has a child enrolled in a school class)
 * - Book search (absorbs SearchPage)
 * - Public club discovery
 * - Reading challenges
 * - Badge showcase
 *
 * Phase 2 scaffold: basic structure with placeholders.
 * Full content implemented in Phases 6–8.
 */
export default function ExplorePage() {
  const navigate = useNavigate();
  const { member } = useAuth();

  return (
    <div className="max-w-2xl lg:max-w-none mx-auto lg:mx-0 px-4 lg:px-10 py-6 pb-24 lg:pb-10 space-y-8">

      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Explore</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Discover books, clubs, and reading adventures</p>
      </div>

      {/* ── Book search shortcut ── */}
      <button
        onClick={() => navigate("/search")}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all text-left group"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
          <Search size={20} className="text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">Find a book</p>
          <p className="text-xs text-muted-foreground">Search by title, author, or ISBN</p>
        </div>
      </button>

      {/* ── Quick actions grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate("/books/add")}
          className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <PlusCircle size={20} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Add a book</p>
            <p className="text-xs text-muted-foreground">To your family library</p>
          </div>
        </button>

        <button
          onClick={() => navigate("/clubs")}
          className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-card border border-border hover:border-highlight/30 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-highlight/10 flex items-center justify-center group-hover:bg-highlight/15 transition-colors">
            <Users size={20} className="text-highlight" />
          </div>
          <div>
            <p className="font-semibold text-sm">Reading clubs</p>
            <p className="text-xs text-muted-foreground">Join or discover clubs</p>
          </div>
        </button>
      </div>

      {/* ── School ── */}
      <section>
        <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          <span className="text-xl">🎓</span> School
        </h2>
        <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center space-y-4">
          <div>
            <p className="text-4xl mb-3">🏫</p>
            <p className="font-semibold text-sm text-foreground mb-1">Join a school reading club</p>
            <p className="text-xs text-muted-foreground mb-4">
              Has your school set up Bookie? Enter the class join code your teacher shared.
            </p>
            <button
              onClick={() => navigate("/join")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-school text-school-foreground font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Enter class code
            </button>
          </div>
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Set up or manage a school</p>
            <button
              onClick={() => navigate("/schools")}
              className="text-xs font-semibold text-school hover:underline"
            >
              Go to Schools →
            </button>
          </div>
        </div>
      </section>

      {/* ── Challenges placeholder (Phase 7) ── */}
      <section>
        <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          <Trophy size={20} className="text-star" /> Challenges
        </h2>
        <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
          <p className="text-4xl mb-3">🏅</p>
          <p className="font-semibold text-sm text-foreground mb-1">Reading challenges coming soon</p>
          <p className="text-xs text-muted-foreground">
            Set family reading goals, class challenges, and earn badges for completing them.
          </p>
        </div>
      </section>

    </div>
  );
}

