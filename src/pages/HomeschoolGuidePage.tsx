import { useNavigate } from "react-router";
import { ArrowLeft, Users, GraduationCap, Sparkles, BookOpen, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const STEPS = [
  { icon: <Users size={18} />, title: "Create a Reading Club", body: "From Reading Clubs, tap \"New Club\" — this becomes your homeschool's home base." },
  { icon: <GraduationCap size={18} />, title: "Choose \"Educational\"", body: "Educational clubs are built for organised, age-based reading — exactly what a homeschool needs." },
  { icon: <Sparkles size={18} />, title: "Add a reading group per child", body: "Set up a group for each child or grade level, so books and progress stay organised by age." },
  { icon: <BookOpen size={18} />, title: "Start logging books", body: "Add books, track progress, and use the club's reports to keep a record of what's been read." },
];

export default function HomeschoolGuidePage() {
  const navigate = useNavigate();
  const { user, member } = useAuth();

  async function startJourney() {
    if (member && !member.homeschool_journey_started_at) {
      await supabase.from("family_members").update({ homeschool_journey_started_at: new Date().toISOString() }).eq("id", member.id);
    }
    navigate(user ? "/clubs?create=1" : "/auth?mode=signup");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-5 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </button>
          <span className="text-xl">🏡</span>
          <span className="font-display font-bold text-sm">Homeschooling on Bookie</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-8">
        <h1 className="font-display text-2xl font-bold mb-2">You don't need to register a school</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Registering a school is for institutions with grades, classes and multiple teachers. For homeschooling, a
          Reading Club gives you everything you need — organised by age, with no waiting on approval.
        </p>

        <div className="space-y-4 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-school/10 text-school flex items-center justify-center shrink-0 font-bold text-sm">
                {i + 1}
              </div>
              <div>
                <p className="font-semibold text-sm flex items-center gap-1.5">{s.icon} {s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={startJourney}
          className="w-full py-3.5 rounded-xl bg-school text-school-foreground font-bold text-base hover:opacity-90 flex items-center justify-center gap-2"
        >
          {user ? "Create your club now" : "Get started"} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
