import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "19 July 2026";
const CONTACT_EMAIL = "hello@bookie.app";

export default function TermsPage() {
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
        <h1 className="font-display text-4xl font-bold text-foreground mb-2">Terms & Conditions</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-foreground">

          <section>
            <h2 className="font-display text-xl font-bold mb-3">1. Acceptance of terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By creating an account or using Bookie (the "Service"), you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Service. These terms apply to all users, including parents or guardians who create profiles on behalf of children.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">2. Eligibility</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must be at least 18 years old to create an account. If you are creating an account on behalf of a minor, you confirm that you have the legal authority to do so and that you accept these Terms on their behalf. Child profiles may be created by account holders for children of any age within their family.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">3. Your account</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">{CONTACT_EMAIL}</a> if you suspect unauthorised access.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              You agree not to share your account credentials with anyone outside your family unit, and not to use another person's account without permission.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">4. Acceptable use</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm">
              <li>Upload or share content that is unlawful, harmful, abusive, harassing, defamatory, or obscene</li>
              <li>Impersonate any person or entity</li>
              <li>Scrape, harvest, or otherwise collect data from the Service using automated means without permission</li>
              <li>Attempt to gain unauthorised access to any part of the Service or its infrastructure</li>
              <li>Use the Service for any commercial purpose without our written consent</li>
              <li>Violate any applicable law or regulation, including the Protection of Personal Information Act (POPIA)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">5. Reading Clubs</h2>
            <p className="text-muted-foreground leading-relaxed">
              Reading Clubs are community spaces within the Service. By creating or joining a club, you agree that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm mt-3">
              <li>Your nickname, avatar, and club reading progress are visible to other club members</li>
              <li>Club owners are responsible for moderating the content and membership of clubs they create</li>
              <li>We reserve the right to remove any club or member that violates these Terms</li>
              <li>Club location information (city and suburb) is entered voluntarily and is used solely to help members discover local clubs</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">6. Content you submit</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of content you submit (such as book reviews, ratings, and notes). By submitting content, you grant us a non-exclusive, royalty-free licence to display that content within the Service for the purpose of providing the Service to you and your family.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              You confirm that content you submit does not infringe any third-party intellectual property rights. Book cover images and metadata are retrieved from public sources and remain the property of their respective rights holders.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">7. Service availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              We aim to keep Bookie available around the clock but do not guarantee uninterrupted access. We may perform maintenance, updates, or changes to the Service at any time. We will make reasonable efforts to notify users in advance of planned downtime.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">8. Limitation of liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided "as is" without warranties of any kind, express or implied. To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of or inability to use the Service, including loss of data.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Nothing in these Terms excludes liability for gross negligence, fraud, or any liability that cannot be excluded under applicable South African law.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">9. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may delete your account at any time from the Settings page. We may suspend or terminate accounts that violate these Terms, with or without notice. Upon termination, your data will be deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">10. Changes to these terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. We will notify you of material changes via email or in-app notice at least 14 days before they take effect. Continued use of the Service after that date constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">11. Governing law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of the Republic of South Africa. Any disputes shall be subject to the jurisdiction of the South African courts.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-3">12. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Questions about these Terms? Reach us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">{CONTACT_EMAIL}</a>.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border py-8 px-5 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Bookie. Made with ❤️ for families who love to read.</p>
      </footer>
    </div>
  );
}
