import { useNavigate, Link } from "react-router";
import { BookOpen, Users, Star, Share2, TrendingUp, ArrowRight, MapPin } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span className="font-display font-bold text-xl text-primary tracking-tight">Bookie</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate("/auth?mode=signup")}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-16 pb-20 max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-bold mb-6 border border-border">
              <span>✨</span> Made for families who love to read
            </div>
            <h1 className="font-display text-5xl sm:text-6xl font-bold text-foreground leading-[1.05] mb-6">
              Your family's
              <br />
              <span className="text-primary">reading</span>
              <br />
              adventure
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-md">
              Track every book your family reads together. Log progress, share bookmarks,
              rate stories, and celebrate every page turned — then connect with other reading
              families in your neighbourhood through Reading Clubs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate("/auth?mode=signup")}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
              >
                Start your family library
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="px-6 py-3.5 rounded-2xl bg-secondary text-secondary-foreground font-bold text-base hover:bg-muted transition-colors"
              >
                Sign in
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">100% free · No fees · No ads · No catch · Ever</p>
          </div>

          {/* Hero illustration */}
          <div className="relative flex items-center justify-center lg:justify-end">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80">
              <div className="absolute top-0 left-4 w-36 bg-card rounded-2xl shadow-xl border border-border p-3 rotate-[-4deg] animate-float-slow">
                <div className="flex gap-2 items-center mb-2">
                  <div className="w-8 h-11 bg-[#3B6E52] rounded-lg flex items-center justify-center text-white text-lg">📘</div>
                  <div>
                    <p className="text-[11px] font-bold leading-tight">Charlotte's Web</p>
                    <p className="text-[9px] text-muted-foreground">E.B. White</p>
                  </div>
                </div>
                <div className="flex gap-0.5">{"⭐⭐⭐⭐⭐".split("").map((s,i)=><span key={i} className="text-[10px]">{s}</span>)}</div>
              </div>

              <div className="absolute top-12 right-0 w-40 bg-card rounded-2xl shadow-xl border border-border p-3 rotate-[3deg] animate-float">
                <div className="flex gap-2 items-center mb-2">
                  <div className="w-8 h-11 bg-[#D4622A] rounded-lg flex items-center justify-center text-white text-lg">🧙</div>
                  <div>
                    <p className="text-[11px] font-bold leading-tight">Harry Potter</p>
                    <p className="text-[9px] text-muted-foreground">J.K. Rowling</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex -space-x-1">
                    {["#3B6E52","#C4556A","#2D6B9F"].map((c,i)=>(
                      <span key={i} className="w-4 h-4 rounded-full text-[8px] flex items-center justify-center border border-card" style={{backgroundColor:c}}>
                        {["👩","🧒","👨"][i]}
                      </span>
                    ))}
                  </div>
                  <span className="text-[9px] text-muted-foreground">reading</span>
                </div>
              </div>

              <div className="absolute bottom-4 left-8 w-44 bg-card rounded-2xl shadow-xl border border-border p-3 rotate-[2deg] animate-float-slow" style={{animationDelay:'1s'}}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">🦁</span>
                  <div>
                    <p className="text-[11px] font-bold">Timmy</p>
                    <p className="text-[9px] text-muted-foreground">Reading · p.142 of 320</p>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{width:"44%"}}></div>
                </div>
              </div>

              <div className="absolute inset-[25%] rounded-full bg-secondary border-4 border-border flex items-center justify-center text-5xl shadow-inner">
                📚
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-primary text-primary-foreground py-8">
        <div className="max-w-5xl mx-auto px-5 grid grid-cols-3 gap-4 text-center">
          {[
            { n: "1,000+", label: "Books tracked" },
            { n: "500+", label: "Happy families" },
            { n: "12,000+", label: "Pages read" },
          ].map(({ n, label }) => (
            <div key={label}>
              <p className="font-display text-3xl font-bold">{n}</p>
              <p className="text-primary-foreground/70 text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-5 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl font-bold mb-4">Everything a reading family needs</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">One cosy spot for every book your family ever reads — and every club they join.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { emoji: "📖", title: "Log every book", desc: "Scan the ISBN with your camera, fetch the cover automatically, or add details by hand. Takes 30 seconds." },
            { emoji: "🔖", title: "Shared bookmarks", desc: "Each reader has their own coloured bookmark. See at a glance where Timmy, Sarah, and Mum are in the same book." },
            { emoji: "⭐", title: "Ratings & reviews", desc: "A parent recommendation rating and a reader's own joy rating. Short optional reviews make memories last." },
            { emoji: "👨‍👩‍👧‍👦", title: "Whole family, one app", desc: "Create profiles for each child — no logins needed for little ones. Invite partners and grandparents too." },
            { emoji: "💬", title: "Share the love", desc: "One tap to share a book with a friend over WhatsApp. Include the cover and rating in one beautiful message." },
            { emoji: "🏆", title: "Reading stats", desc: "Celebrate your best reader, track pages devoured, and see everyone's favourites on the family dashboard." },
          ].map(({ emoji, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-primary/30 transition-all">
              <span className="text-3xl block mb-3">{emoji}</span>
              <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reading Clubs feature section */}
      <section className="py-20 px-5 bg-primary/5 border-y border-primary/10">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold mb-5 border border-primary/20">
                <span>🆕</span> New feature
              </div>
              <h2 className="font-display text-4xl font-bold text-foreground mb-4 leading-tight">
                Reading Clubs —<br />read beyond the family
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                Connect with other reading families in your city. Join or start a local Reading Club, share book recommendations with age-based reading groups, and track collective progress together.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { emoji: "🏘️", text: "Find clubs near you by city or suburb" },
                  { emoji: "🔖", text: "Age-based reading groups — little ones see little readers' books" },
                  { emoji: "📊", text: "Track who's read what across the whole club" },
                  { emoji: "📖", text: "Start a Group Read and see everyone's progress in real time" },
                  { emoji: "🔗", text: "Invite families via a shareable link — instant access" },
                ].map(({ emoji, text }) => (
                  <div key={text} className="flex items-start gap-3">
                    <span className="text-lg shrink-0">{emoji}</span>
                    <p className="text-sm text-foreground font-medium leading-snug">{text}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate("/auth?mode=signup")}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all shadow-md shadow-primary/25"
              >
                <Users size={16} />
                Start or join a club
              </button>
            </div>

            {/* Club illustration cards */}
            <div className="flex flex-col gap-3">
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🦉</span>
                  <div>
                    <p className="font-display font-bold text-base">The Sandton Bookworms</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={10} />Sandton, Johannesburg
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {["Little Readers (0–3)", "Junior (6–9)", "Teens (10–15)"].map((g) => (
                    <span key={g} className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">{g}</span>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-primary/20 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">📖 Currently reading together</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-14 bg-[#3B6E52] rounded-lg flex items-center justify-center text-white text-xl shrink-0">🌳</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">The BFG</p>
                    <p className="text-xs text-muted-foreground">Roald Dahl</p>
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>8 of 12 finished</span>
                        <span>67%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{width:"67%"}} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2.5">Club members</p>
                <div className="flex items-center gap-2">
                  {["👩","🧒","👨","🧒","👩","👴"].map((a, i) => (
                    <span key={i} className="w-8 h-8 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-sm">{a}</span>
                  ))}
                  <span className="text-xs text-muted-foreground font-semibold ml-1">+6 more</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-5 bg-secondary/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl font-bold mb-4">Up and reading in minutes</h2>
          <p className="text-muted-foreground text-lg mb-12">Sign up, set up your family, and start logging your first book straight away.</p>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: "1", emoji: "✍️", title: "Create your family", desc: "Sign up, choose your avatar, set up profiles for each child." },
              { step: "2", emoji: "📚", title: "Add your books", desc: "Scan an ISBN or search by title. Covers load automatically." },
              { step: "3", emoji: "🎉", title: "Read & celebrate", desc: "Track progress, rate books, join clubs, and share your favourites." },
            ].map(({ step, emoji, title, desc }) => (
              <div key={step} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground font-display text-2xl font-bold flex items-center justify-center mb-4 shadow-md shadow-primary/25">
                  {step}
                </div>
                <span className="text-3xl mb-3">{emoji}</span>
                <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-6xl block mb-6">📚</span>
          <h2 className="font-display text-4xl font-bold mb-4">Ready to start your family library?</h2>
          <p className="text-muted-foreground text-lg mb-2">Join hundreds of families already reading together.</p>
          <p className="text-sm text-muted-foreground mb-8">No subscription. No ads. No fees. Just books.</p>
          <button
            onClick={() => navigate("/auth?mode=signup")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-primary/25"
          >
            Get started for free
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">📚</span>
              <span className="font-display font-bold text-base text-primary">Bookie</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
            </nav>
          </div>
          <div className="mt-6 pt-6 border-t border-border text-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Bookie. A family app, by a family, for families. Free forever.</p>
            <p className="mt-1">Built with ❤️ in Cape Town, South Africa 🇿🇦 · POPIA compliant</p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(3deg); }
          50% { transform: translateY(-8px) rotate(3deg); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(-4deg); }
          50% { transform: translateY(-6px) rotate(-4deg); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
