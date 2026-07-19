import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <span className="font-display font-bold text-lg text-primary tracking-tight">Bookie</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-14">
        <div className="text-center mb-12">
          <span className="text-6xl block mb-5">📚</span>
          <h1 className="font-display text-4xl font-bold text-foreground mb-4">About Bookie</h1>
          <p className="text-lg text-muted-foreground italic leading-relaxed">
            "She had the original brilliant idea, he just had the means to make it a reality."
          </p>
        </div>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="font-display text-2xl font-bold mb-3">Our story</h2>
            <p className="text-muted-foreground leading-relaxed">
              Bookie started the way the best ideas do — at a kitchen table in Cape Town, surrounded by stacks of kids' books and a family that loved reading but had no good way to keep track of it all. Post-it notes on spines. Spreadsheets that were out of date by Tuesday. A group chat full of "wait, did we read that one?"
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              The idea was simple: one beautiful, friendly app where the whole family — parents, grandparents, little ones — could see every book they'd ever read together, track who was on which page, and celebrate the joy of every story finished.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold mb-3">Completely free. Always.</h2>
            <p className="text-muted-foreground leading-relaxed">
              Bookie is free. Not "free with a premium tier" free. Not "free for 30 days" free. Just free — because this is a family app built by a family, for families. There are no investors to satisfy, no ads to show you, no subscription to forget to cancel. Every feature in Bookie costs you nothing and always will.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold mb-3">What we believe</h2>
            <div className="space-y-4">
              {[
                { emoji: "📖", title: "Reading is for everyone", body: "From board books to novels, every page counts. Bookie is built for all ages, all reading levels, all kinds of readers." },
                { emoji: "👨‍👩‍👧‍👦", title: "Families read better together", body: "When reading is shared — talked about, recommended, celebrated — it becomes a habit that lasts a lifetime." },
                { emoji: "🏘️", title: "Communities make it stick", body: "Reading Clubs let families connect with other readers in their neighbourhood, share recommendations, and discover books they'd never have found on their own." },
                { emoji: "🔒", title: "Your data is yours", body: "We collect only what we need to make the app work, store it safely, and never sell it. No ads. No profiling. Full stop." },
              ].map(({ emoji, title, body }) => (
                <div key={title} className="flex gap-4 p-4 bg-card border border-border rounded-2xl">
                  <span className="text-2xl shrink-0">{emoji}</span>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold mb-3">Built with care</h2>
            <p className="text-muted-foreground leading-relaxed">
              Every feature in Bookie exists because a real family needed it. We move carefully, we respect your privacy, and we keep things simple. No bloat, no dark patterns, no nonsense.
            </p>
          </section>
        </div>

        <div className="mt-14 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">Built with ❤️ in Cape Town, South Africa.</p>
        </div>
      </main>
    </div>
  );
}
