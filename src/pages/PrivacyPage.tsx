import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "19 July 2026";
const CONTACT_EMAIL = "privacy@bookie.app";

export default function PrivacyPage() {
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
        <h1 className="font-display text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">

          <section>
            <h2 className="font-display text-xl font-bold mb-3">1. Who we are</h2>
            <p className="text-muted-foreground leading-relaxed">
              Bookie is a family reading tracker application ("the Service"). References to "we", "us", or "our" in this policy refer to the operators of Bookie. This Privacy Policy explains how we collect, use, store, and protect your personal information in accordance with the <strong>Protection of Personal Information Act 4 of 2013 (POPIA)</strong> of the Republic of South Africa, and other applicable privacy legislation.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">2. Information we collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We collect only what is necessary to provide and improve the Service:</p>
            <div className="space-y-3">
              {[
                { title: "Account information", body: "Email address and password (stored as a secure hash). We do not store your password in plain text." },
                { title: "Family profiles", body: "Nicknames, avatar emoji, role labels (e.g. Mum, Dad, Son), age group ranges, and reading preferences you choose to enter. No full legal names are required." },
                { title: "Reading data", body: "Books added (title, author, ISBN, cover image URL), reading progress, ratings, and reviews." },
                { title: "Club data", body: "Reading club names, descriptions, location (city and suburb only — no street address), reading group details, and club membership records." },
                { title: "Usage data", body: "Standard server logs including IP addresses, browser type, and pages visited. These are used solely for security monitoring and are not linked to your profile." },
              ].map(({ title, body }) => (
                <div key={title} className="p-4 bg-card border border-border rounded-xl">
                  <p className="font-semibold text-sm mb-1">{title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">3. Information about children</h2>
            <p className="text-muted-foreground leading-relaxed">
              Bookie allows adult account holders (parents or guardians) to create <strong>child profiles</strong> within their family account. Child profiles contain only a nickname, an avatar emoji, an age group range, and reading data. No email address, phone number, or identifying information is required or stored for child profiles.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Child profiles do not have independent login credentials. The adult account holder is responsible for all data entered on behalf of a child and consents to this policy on the child's behalf. If you believe a child's information has been collected without appropriate consent, please contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">{CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">4. How we use your information</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We use your information to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm">
              <li>Provide, operate, and improve the Service</li>
              <li>Display your family's reading progress and history</li>
              <li>Enable Reading Club features such as member lists and reading progress sharing</li>
              <li>Send transactional emails (e.g. club invite links, password reset)</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              We do <strong>not</strong> sell, rent, or trade your personal information to any third party. We do not use your data for advertising profiling.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">5. Sharing of information</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Your information is shared only in these circumstances:</p>
            <div className="space-y-3">
              {[
                { title: "Within your family", body: "Family members you invite can see all books, progress, and ratings in your shared library." },
                { title: "Within a Reading Club", body: "When you join a club, your nickname, avatar, and reading progress for club books are visible to other club members. Your family library remains private." },
                { title: "Service providers", body: "We use Supabase for database and authentication services, hosted within secure data centres. They process data only on our behalf and under strict confidentiality obligations." },
                { title: "Legal requirements", body: "We may disclose information if required by law, court order, or to protect the rights and safety of our users or the public." },
              ].map(({ title, body }) => (
                <div key={title} className="p-4 bg-card border border-border rounded-xl">
                  <p className="font-semibold text-sm mb-1">{title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">6. Data storage and security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored on servers with industry-standard encryption in transit (TLS) and at rest. Access to production data is restricted to authorised personnel only. We apply row-level security policies so that users can only access their own data.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Despite these measures, no system is perfectly secure. In the event of a data breach that affects your rights or freedoms, we will notify the Information Regulator and affected users as required by POPIA.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">7. Your rights under POPIA</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">As a data subject, you have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm">
              <li><strong>Access</strong> — request a copy of the personal information we hold about you</li>
              <li><strong>Correction</strong> — request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion</strong> — request deletion of your account and associated data</li>
              <li><strong>Objection</strong> — object to processing of your personal information</li>
              <li><strong>Complaints</strong> — lodge a complaint with the Information Regulator of South Africa</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise any of these rights, email us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">{CONTACT_EMAIL}</a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">8. Data retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your account data for as long as your account is active. If you delete your account, we remove your personal information within 30 days, except where retention is required by law. Anonymised, aggregated usage statistics may be retained indefinitely.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">9. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Bookie uses only essential session cookies to keep you logged in. We do not use tracking, analytics, or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">10. Changes to this policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this policy from time to time. Material changes will be communicated via email or an in-app notice at least 14 days before they take effect. Continued use of the Service after that date constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">11. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For any privacy questions or to exercise your rights, contact our Information Officer at:
            </p>
            <div className="mt-3 p-4 bg-card border border-border rounded-xl text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Bookie — Information Officer</p>
              <p>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">{CONTACT_EMAIL}</a></p>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t border-border py-8 px-5 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Bookie. Made with ❤️ for families who love to read.</p>
      </footer>
    </div>
  );
}
