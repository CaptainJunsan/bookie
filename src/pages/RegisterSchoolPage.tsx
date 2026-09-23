import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowLeft, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { SCHOOL_APPLICANT_ROLES } from "../lib/types";
import { toast } from "sonner";

export default function RegisterSchoolPage() {
  const navigate = useNavigate();

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [applicantName, setApplicantName] = useState("");
  const [applicantRole, setApplicantRole] = useState(SCHOOL_APPLICANT_ROLES[0]);
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [city, setCity] = useState("");
  const [suburb, setSuburb] = useState("");
  const [description, setDescription] = useState("");
  const [popiaConsent, setPopiaConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!popiaConsent) { toast.error("Please confirm the POPIA declaration to continue"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("schools").insert({
        name: schoolName.trim(),
        emoji: "🏫",
        city: city.trim(),
        suburb: suburb.trim() || null,
        description: description.trim() || null,
        status: "pending",
        applicant_name: applicantName.trim(),
        applicant_role: applicantRole,
        applicant_email: applicantEmail.trim(),
        applicant_phone: applicantPhone.trim() || null,
        registration_number: registrationNumber.trim() || null,
        popia_attested_at: new Date().toISOString(),
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not submit your application");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center gap-4">
        <CheckCircle2 size={56} className="text-school" />
        <h1 className="font-display text-2xl font-bold">Application received</h1>
        <p className="text-muted-foreground max-w-sm">
          Thanks — we'll review {schoolName || "your school"}'s application and verify a few details. Once approved, we'll email <strong>{applicantEmail}</strong> a link to finish setting things up. No account or password needed until then.
        </p>
        <button onClick={() => navigate("/")} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90">Back to Bookie</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-5 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </button>
          <span className="text-xl">🏫</span>
          <span className="font-display font-bold text-sm">Register a school</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-8">
        <h1 className="font-display text-2xl font-bold mb-1">Bring Bookie to your school</h1>
        <p className="text-sm text-muted-foreground mb-2">
          No account needed to apply — just tell us about you and your school. We review every application before it goes live.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Homeschooling? You don't need to register a school —{" "}
          <Link to="/homeschool" className="text-school font-semibold hover:underline">set up a Reading Club instead</Link>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">About you</h2>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Your full name <span className="text-red-500">*</span></label>
              <input type="text" required value={applicantName} onChange={(e) => setApplicantName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Your role at the school <span className="text-red-500">*</span></label>
              <select required value={applicantRole} onChange={(e) => setApplicantRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring">
                {SCHOOL_APPLICANT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Email address <span className="text-red-500">*</span></label>
              <input type="email" required value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)}
                placeholder="you@school.co.za"
                className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
              <p className="text-xs text-muted-foreground mt-1">We'll send your setup link here once approved.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Phone number <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input type="tel" value={applicantPhone} onChange={(e) => setApplicantPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">About the school</h2>
            <div>
              <label className="block text-sm font-semibold mb-1.5">School name <span className="text-red-500">*</span></label>
              <input type="text" required value={schoolName} onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g. Sunnydale Primary"
                className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                EMIS number or official registration number <span className="text-muted-foreground font-normal">(optional, speeds up approval)</span>
              </label>
              <input type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex gap-2">
              <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="City *"
                className="flex-1 px-4 py-2.5 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
              <input type="text" value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="Suburb"
                className="flex-1 px-4 py-2.5 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Anything else? <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={200}
                className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
          </section>

          <section className="p-4 bg-muted rounded-xl space-y-3">
            <div className="flex items-start gap-2">
              <ShieldCheck size={16} className="text-school shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-foreground">POPIA declaration</p>
            </div>
            <label className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed cursor-pointer">
              <input type="checkbox" required checked={popiaConsent} onChange={(e) => setPopiaConsent(e.target.checked)}
                className="mt-0.5 shrink-0" />
              <span>
                I confirm I am authorised to register this school on Bookie, and I understand that any learner reading data
                collected through Bookie will be processed in accordance with Bookie's{" "}
                <Link to="/privacy" className="text-school underline underline-offset-2">Privacy Policy</Link> and the
                Protection of Personal Information Act (POPIA). Bookie collects only a learner's first name and an avatar —
                no surname, date of birth, or contact details are required for a learner profile.
              </span>
            </label>
          </section>

          <button type="submit" disabled={saving || !popiaConsent}
            className="w-full py-3.5 rounded-xl bg-school text-school-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : "Submit application"}
          </button>
        </form>
      </div>
    </div>
  );
}
