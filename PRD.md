# Bookie — Product Requirements Document

**Status:** Draft scaffold (v0.2) — created 2026-09-20, updated 2026-09-20. To be completed in a follow-up session.
**Owner:** Janico Steyn
**Scope of this draft:** grounding facts about the current app, four prioritized items (reader book list, School club type, gamification, sharing/dynamic links), and a competitive gap analysis. Acceptance criteria, exact UX flows, and final data model are intentionally left open for the next session.

---

## 0. Note on "hidden instructions" search

Searched the repo for any hidden or commented instructions left for the original Figma Make agent (code comments, `guidelines/Guidelines.md`, `ATTRIBUTIONS.md`, README, HTML comments, `.env.txt`, hidden dotfiles). Findings:

- `guidelines/Guidelines.md` is **unfilled boilerplate** — the stock Figma Make template wrapped in an HTML comment, with only the placeholder line `**Add your own guidelines here**` outside it. No custom guidance was ever added.
- `ATTRIBUTIONS.md` only lists open-source/photo licenses (shadcn/ui, Unsplash).
- No `.figma-make`, `PRD`, `SPEC`, or notes files exist anywhere in the repo, and no suspicious instructional comment blocks were found in `src/**` beyond ordinary section dividers and a few genuine engineering comments.

**Conclusion: no hidden/prior instruction set exists.** This PRD is built from the current codebase plus external competitive research (§6).

---

## 1. Product overview

**Bookie** is a mobile-first family reading-tracker web app (React + Vite, Supabase backend, deployed on Vercel), originally scaffolded via Figma Make. It targets South African families — POPIA is explicit in the Privacy Policy/Terms, not an afterthought.

**Bookie's stated brand promise (from `src/pages/LandingPage.tsx`) is non-negotiable for any new feature:**
> "100% free · No fees · No ads · No catch · Ever" (hero, line 67)
> "No subscription. No ads. No fees. Just books." (CTA, line 286)
> "A family app, by a family, for families. Free forever." (footer, line 312)

This "free forever" claim is treated in this PRD as a hard product constraint (see §7) — every competitor found in the research (§6) monetizes the school/institution tier even when the family-facing product is free. Honoring "free forever" all the way into the School feature is Bookie's clearest point of differentiation.

Core capabilities today:
- **Family accounts**: one adult Supabase Auth user per family; child profiles are sibling rows in the same family with no independent login and no full legal name/DOB/contact info collected.
- **Personal library**: books, reading progress, ratings/reviews, a dashboard, and a milestone/gamification layer (see §5.1).
- **Reading Clubs**: `social` or `educational` types, age-banded reading groups, discussion topics with moderation, join requests, invite links, owner-only Reports tab.
- **Sharing**: branded PNG share cards (book/reader/app-invite) via the Web Share API, plus token-based invite links for families and clubs (see §6).
- **Admin**: platform-level super-admin console, separate from club-level roles.

---

## 2. Current architecture snapshot

| Concern | Current state | Key files |
|---|---|---|
| Family/member model | 1 auth user = 1 adult; children are extra rows, no auth, coarse `age_group` enum | `src/contexts/AuthContext.tsx`, `src/lib/types.ts` |
| Reading Clubs | `club_type`: `"social" \| "educational"`; `club_members.role`: `owner \| admin \| member` (flat, per-club only) | `supabase/clubs_schema*.sql` |
| Reading groups | Flat, age-banded (`age_min`/`age_max`); assignment table (`reading_group_members`) exists in schema but **has no UI anywhere** | `supabase/clubs_schema_v2.sql`; confirmed absent in `src/pages/ClubDetailPage.tsx` |
| Gamification | Bookworm score + 6-tier level system, milestone celebrations (10/20/50/100 books, 1000+ pages) with personalized, gendered copy and confetti (`canvas-confetti` dependency already installed), single "Star Reader" badge per family | `src/components/ReaderProfileSheet.tsx`, `src/lib/milestones.ts`, `src/components/MilestoneModal.tsx` |
| Sharing / invites | Token-based deep links: `/invite/:token` (family, `InvitePage.tsx`) and `/clubs/invite/:token` (club, `ClubInvitePage.tsx`) — both drive a multi-step "sign up or sign in → set up profile → auto-join" flow; separately, branded canvas share-cards for books/readers pushed through the Web Share API | `src/pages/InvitePage.tsx`, `src/pages/ClubInvitePage.tsx`, `src/lib/shareCard.ts` |
| Admin/permissions | Two disconnected tiers: platform super-admin and per-club role. No org/multi-club grouping, no granular permission flags | `src/lib/admin.ts`, `src/pages/AdminDashboard.tsx` |
| Privacy/POPIA | Described in `PrivacyPage.tsx`/`TermsPage.tsx` prose only — not enforced in the DB. Assumes the enrolling adult is the child's own parent | `src/pages/PrivacyPage.tsx`, `src/pages/TermsPage.tsx` |

---

## 3. Feature 1 — View all books read from a reader profile

*(unchanged from v0.1 — see below)*

### 3.1 Problem
Tapping a reader's profile opens `ReaderProfileSheet`, whose "Books finished" grid caps at 10 covers; beyond that it renders static, non-interactive text (`+{N} more`) with no way to see the rest.

### 3.2 Current behavior
- `src/components/ReaderProfileSheet.tsx:309-341` — `finishedBooks.slice(0, 10)`; overflow footer at line 335-339 has no `onClick`.
- `ReaderProfileSheet.tsx:62-65` already has a `goToBook(bookId)` navigator used by every book tile — the tap pattern exists, just not at the list level.
- `src/pages/BooksPage.tsx` is the app's only full-book-list screen; it reads `?view=<status>` but filters by the **currently signed-in member only** (line 56) — it cannot show another reader's (e.g. a child's) books via URL param today.
- A similar, but already-fixed-right, pattern exists in `src/pages/ClubDetailPage.tsx:1526-1543` (club Members sidebar: `+{N} more` is a real tappable affordance that switches tabs) — good reference model.

### 3.3 Open questions
1. Reuse `BooksPage` with a `?reader=<memberId>` param (requires loosening the self-only filter), a dedicated route, or an in-sheet "show all" expansion?
2. Finished-only, or all statuses with the existing filter chips?
3. Can a family member view a sibling's/child's full list, or only their own + a parent viewing a child's?
4. Pagination needed at scale?

---

## 4. Feature 2 — Dedicated "School" reading club type

*(unchanged from v0.1, cross-referenced with §5–§7 below — school is where gamification, sharing, and the free-forever promise all meet)*

### 4.1 Problem
"Create new club" only offers Social/Educational. Schools need a distinct creation journey, nested grouping (grade → class), tailored sharing/onboarding, reporting, and access control — plus explicit POPIA handling for a **school-enrolls-student** scenario the current Privacy Policy doesn't cover (it only covers **parent-enrolls-own-child**).

### 4.2 Current state and gaps

| Area | Today | Gap for "School" |
|---|---|---|
| Club type selection | `"social" \| "educational"` in `ClubsPage.tsx:280-294` | No `"school"` option or branching journey |
| Grouping | Flat `reading_groups`; **no member-assignment UI at all** | Need nested grade→class; need the assignment UI that's missing even for today's flat groups |
| Roles | owner/admin/member, per-club only | Need teacher/school-admin/parent/student semantics scoped per class, not just per-club |
| Reporting | Owner-only Reports tab, single-club stats | Need grade/class rollups, multi-recipient (teacher sees class, admin sees school) |
| Sharing/invites | Bare copy-link for clubs vs. rich share-cards for books/readers | Needs a school-appropriate bulk/roster-friendly invite mechanism (§6.3) |
| POPIA | Parent-managed child profiles, with an existing "claim" path for the child to later take over their own account (`claim_child_member` RPC, `src/pages/InvitePage.tsx:123-134`) | **Resolved (see §7.3): reuse this exact model for School — a student is always a parent-linked `family_members` row, never a teacher-created independent identity.** |

### 4.3 School as a growth lever, not just a feature
A school onboarding a full grade brings dozens of new family sign-ups in one motion — this is a legitimate user-acquisition channel for the whole app, not only a CSR-style add-on. That reframes the priority of §5 (gamification) and §6 (sharing) as directly supporting the School journey: **schools adopt tools that make reading visibly competitive and fun (§6 gap analysis), and the easier the onboarding link/code makes it to get a whole class in, the faster it spreads (§6.3).**

### 4.4 Open questions
1. Is "school" a new top-level entity owning multiple class-clubs, or one `club` of type `school` with nested groups underneath?
2. ~~Who is the "student" in the data model~~ — **Resolved (2026-09-20): a student is always an existing `family_members` row, parent-managed, exactly like today.** No lighter, family-less student identity. See §7.3.
3. ~~What triggers POPIA consent in a school flow~~ — **Resolved (2026-09-20): no new consent mechanism needed.** The existing parent-account-holder consent (Privacy Policy §3) already covers it, because a student's profile stays under the parent's family regardless of which club/school it also belongs to. See §7.3.
4. Does a school club keep today's club features (topics, group reads) as-is, or intentionally restrict some (e.g. no open discussion threads for younger grades)?
5. Reporting audience — internal only (teacher/admin), or a "share with parents" report as part of sharing mechanics?
6. **New:** should a school-class join link, when opened by a family that already has a child profile in Bookie, let the parent *link an existing child* to the class (no new profile), while a brand-new family still goes through today's "create account → create child profile" flow? (Mirrors `ClubInvitePage`'s existing "pick which of your members should join" step.)

---

## 5. Feature 3 — Gamification

### 5.1 What Bookie already has
- **Bookworm score** (`bookwormScore()`, `ReaderProfileSheet.tsx:13-21`): weighted formula across books finished, pages read, reviews written, currently-reading count, want-to-read count.
- **6-tier level system** (`getLevel()`, line 23-30): Bookworm Jr. → Page Turner → Bookworm → Reading Champion → Legendary Reader → Reading Legend, each with an emoji, shown with a "next level" progress bar (`NextLevelBar`, line 387-402).
- **Milestone celebrations** (`src/lib/milestones.ts`): book-count thresholds (10/20/50/100/150…) and page-count thresholds (1000, 2000…), with distinct, warm, **gendered/pronoun-aware** copy for the reader's own achievement vs. celebrating a child's vs. celebrating another adult's (`getMilestoneContent`, line 326-362). Fires through `MilestoneModal.tsx`. `canvas-confetti` is already a dependency, implying celebratory visual effects are part of the intended experience.
- **Star Reader badge**: single per-family top finisher, shown on the Dashboard.
- **Sharing the achievement**: `generateReaderShareCard()` (`shareCard.ts`) turns a reader's stats/level into a branded PNG.

This is a genuinely good foundation — warm, personal, family-scale. It has **no time-boxed or social/competitive layer** yet.

### 5.2 Gaps versus the market (see §6 for sources)
| Mechanic | Common in competitors | Bookie today |
|---|---|---|
| Reading streaks (consecutive days) | Beanstack | Not tracked at all — no "days in a row" concept in the data model |
| Discrete collectible badges | Beanstack, Epic | Bookie has a single evolving *level title*, not a wall of distinct earned badges |
| Time-boxed challenges (e.g. "Read 5 books this summer," class-vs-class) | Beanstack (core mechanic), Epic | No challenge concept exists — milestones are open-ended, not goal/deadline-based |
| Leaderboards beyond the immediate family | Beanstack, Biblionasium, SpoonRead | "Star Reader" is family-only; clubs have an owner-only Reports tab but no member-facing leaderboard |
| Reading-buddy / friends layer | Biblionasium | No cross-family "friend" concept outside shared club membership |
| Reading verification (quizzes, AI chat check-in) | Accelerated Reader (quizzes), Beanstack ("Book Talks with Benny") | None — Bookie is trust-based logging, matching its family-first tone rather than a school-verification tone |

### 5.3 Open questions for next session
1. Do we want reading-verification at all, or does it conflict with Bookie's "cosy family trust" positioning (Accelerated Reader is frequently criticized in the research as anxiety-inducing for exactly this reason)?
2. Streaks: per-reader only, or also a family/class streak (whole group keeps it alive)?
3. Badges: introduce as a genuinely new collectible system, or extend the existing level/milestone system with discrete badge art per milestone (lower engineering cost, reuses `MilestoneModal`/confetti)?
4. Challenges: family-scoped, club-scoped, school-class-scoped, or all three sharing one underlying "challenge" table?
5. Leaderboards: do they conflict with the family policy of "no full legal names" / nickname-only identity — need to confirm nickname-only leaderboards are acceptable at school scale (a class leaderboard of 30 kids by nickname could be ambiguous or reveal identity via context; needs privacy sign-off, ties into §7.3).

---

## 6. Feature 4 — Intuitive sharing & dynamic links

### 6.1 What Bookie already has (the "framework" to build on)
Two distinct, already-working mechanisms:
1. **Token-based deep-link invites** — `/invite/:token` (family) and `/clubs/invite/:token` (club), both resolving a `token` row server-side, then walking the user through **account → profile → auto-join** (`InvitePage.tsx`, `ClubInvitePage.tsx`). Expiring (24h for family invites), single-use, no app-store dependency since Bookie is a web app.
2. **Branded share cards** — `src/lib/shareCard.ts` generates PNGs client-side (book, reader, generic app-invite) and pushes them through the Web Share API (`shareWithOS`), with a clipboard/WhatsApp-text fallback when the OS share sheet isn't available.
3. **Bare link copy** — club invite currently just copies `${APP_URL}/clubs/invite/${token}` to the clipboard with no card/branding (`ClubDetailPage.handleCopyInvite`) — the least-polished of the three patterns.

### 6.2 Note on "dynamic links" terminology
Google's **Firebase Dynamic Links product was deprecated industry-wide in August 2025** — anything built today should not depend on it. This is not a setback for Bookie: since Bookie is a responsive web app (not a native iOS/Android app needing deferred-deep-link install attribution), its existing **plain token-URL pattern already is the durable, non-deprecated approach**. "Dynamic links" for Bookie should mean *smarter, context-carrying URLs* (e.g. a link that pre-fills which class/grade a student is joining), not a native mobile SDK.

### 6.3 Gaps to close for a school-ready, "intuitive" sharing layer
- **Context-aware links**: today's tokens resolve to a single family or single club. A school needs links scoped to a specific class/grade (e.g. joining via a class link should land the student directly in "Grade 4A," not just "the school club") — extends the existing token-resolution pattern rather than replacing it.
- **Bulk/roster-friendly invites**: none of the three existing mechanisms support inviting many people at once (a teacher adding 30 students' parents) — today it's one link, shared/copied by hand.
- **Consistency**: club invite is currently the "bare" pattern (§6.1.3) while book/reader/app invites are richly branded — worth deciding whether the school invite gets the richer treatment given it's the highest-leverage growth surface (§4.3).
- **Short/friendly codes**: competitor and general best-practice research favors low-friction join codes (e.g. a 6-character class code a teacher reads aloud) over long token URLs for classroom settings — not present in Bookie today (tokens are opaque, presumably UUIDs).

### 6.4 Open questions
1. Should school class links be a new token type, or an extension of `invite_token`/`club_invite` with an added `reading_group_id`/class scope?
2. Do we need short human-readable join codes in addition to URLs for a classroom (verbal sharing), or is a QR-code-of-the-existing-link sufficient?
3. Bulk invite: CSV upload of parent emails, or a single reusable class code students self-serve with (simpler, no data entry, but weaker access control)?
4. Should the "copy link" club-invite pattern be upgraded to match the branded share-card pattern for consistency, independent of the school work?

---

## 7. Competitive landscape & gap analysis

Researched via web search on 2026-09-20 (sources listed per finding). This is directional market research, not a formal competitive audit — worth revisiting with primary-source app trials before committing to specific mechanics.

### 7.1 Summary by competitor
- **Beanstack** — market leader for reading-challenge gamification in schools/libraries: badges, streaks, leaderboards, "friends," class/grade/school-vs-school competitions, teacher goal-setting, an AI "Book Talks with Benny" verification chat, ISBN-scan logging. **Gap: paid product for institutions**, more enterprise/library-admin flavored than family-first, no POPIA framing. ([Beanstack gamification](https://www.beanstack.com/features/reading-challenges-gamification), [Beanstack blog](https://www.beanstack.com/blog/beanstacks-mobile-app))
- **Biblionasium** — closest analog to Bookie's tone: kid-safe social reading log, Lexile-based recommendations, parent monitoring, teacher challenges, **free for teachers**, COPPA- (not POPIA-) compliant. **Gap:** dated social feature set, US child-privacy framing only, no family+club+school continuity, no local/community club discovery like Bookie's city/suburb search. ([Common Sense Media review](https://www.commonsensemedia.org/website-reviews/biblionasium), [Biblionasium](https://www.biblionasium.com/))
- **Epic** — huge digital library plus badges/quizzes/reading-buddies as a discovery/motivation loop. **Gap:** it's fundamentally a licensed ebook content business (subscription-gated beyond limited free access), not a tracker for physically-owned or freely-chosen books; no family collaborative tracking, no community clubs, no "free forever" claim. ([Epic pricing](https://myelearningworld.com/epic-pricing/), [Epic review](https://www.educationalappstore.com/app/epic-kids-books-and-videos))
- **Sora (OverDrive Education)** — strong teacher book-assignment + reading dashboard + comprehension tools, SSO/rostering integration, COPPA-compliant. **Gap:** requires the school/library to own a paid digital collection; no gamification/motivation layer for reading-for-pleasure; no social/family sharing; ebook-only. ([OverDrive teaching tools](https://resources.overdrive.com/k-12-schools/sora-features/teaching-tools/), [Sora dashboard](https://company.overdrive.com/2021/09/30/sora-student-reading-dashboard-powers-teaching-intervention-and-insight/))
- **Accelerated Reader / Scholastic Reading Counts** — quiz-based comprehension verification tied to reading levels; widely used but frequently critiqued (per library-blog commentary found in research) as anxiety-inducing rather than joy-of-reading-oriented; paid, no social/family layer. ([Alternatives to AR discussion](https://www.stayingcoolinthelibrary.us/alternatives-to-accelerated-reader/))
- **Smaller players** (Prodigy, Page Pots, SpoonRead) — game-first or simple personal trackers; none combine multi-tenant grade/class structure with role-based access, family continuity, and genuine free pricing. ([Jotform gamification roundup](https://www.jotform.com/blog/gamification-apps-for-education/))

### 7.2 Consolidated gaps Bookie can fill
1. **One continuous identity across home, community club, and school.** Every competitor above is single-context (school-only or library-only or home-only); a child's home reading and school reading live in disconnected apps today. Bookie already has family + local club in one profile — extending to school in the *same* profile/history is structurally unique in this set.
2. **Genuinely free at every tier, including schools.** Every competitor with meaningful school features monetizes the institution (subscription, per-seat, or licensed-content paywall). Bookie's landing-page promise, honored into the school tier, is a real differentiator and should be treated as a headline feature of the School journey's own marketing, not just an engineering constraint.
3. **POPIA-native, not COPPA-retrofitted.** No competitor found frames its privacy model around POPIA; Bookie already does for families and can extend the same posture to schools, which is directly relevant in its South African market.
4. **Book-agnostic, not content-licensed.** Epic and Sora both funnel users into their own licensed libraries. Bookie logs *any* book (ISBN scan/search), physical or digital — a school flow should preserve this rather than becoming a content platform.
5. **Trust-first tone as a deliberate alternative to verification-heavy tools.** Accelerated Reader's quiz model is explicitly critiqued in the research as pressure-inducing. Bookie's warm, family-first milestone copy (§5.1) is a real point of difference worth preserving deliberately if a school feature is added, rather than defaulting to a verification mechanic just because competitors have one (see open question 5.3.1).

### 7.3 POPIA implication carried over from Feature 2 — resolved

**Decision (2026-09-20, per product owner):** Bookie already gates all child data behind an adult account holder — a child profile is a `family_members` row with no login of its own, and the Privacy Policy already states "the adult account holder is responsible for all data entered on behalf of a child and consents to this policy on the child's behalf" (`PrivacyPage.tsx` §3). Bookie also already has the mechanism for a child to eventually take over their own profile once ready: the `claim_child_member` RPC, invoked from a targeted invite token (`src/pages/InvitePage.tsx:123-134`) — the parent-created profile gets a `user_id` attached and the child gains their own login, no data migration needed.

**Ruling: School does not introduce a new lawful-processing scenario.** A student's profile inside a school club/class remains the same parent-managed `family_members` row as everywhere else in the app — the parent/guardian stays the consenting, verifying, and authorizing party for as long as the student is a minor, exactly as today's family and community-club flows already work. This means:
- A teacher/school admin can never create a standalone "student" record disconnected from a family account — joining a school class must route through the same account-holder consent chain as `ClubInvitePage.tsx` today (an adult creates/links the account; the child profile is then added to the class).
- The existing `claim_child_member` "hand over when ready" mechanism is reused as-is for School — no new handover flow needs to be designed.
- Research below (POPIA's "competent person" consent requirement, Sections 34–35) is already satisfied by this existing chain; it does not create additional design work, only confirms the existing model was correct to begin with. ([Mondaq: Back to School POPIA Do's and Don'ts](https://www.mondaq.com/southafrica/data-protection/1426596/back-to-school-popia-dos-and-donts), [POPIA Compliance for Schools guide](https://www.myencore.co.za/news/popia-compliance-schools.html))

**Remaining (non-blocking) item:** whether the Privacy Policy needs a short School-context addendum (e.g. naming the school as an additional party that can see a student's class reading progress) — a documentation/legal-copy task, not a data-model or consent-flow change.

---

## 8. Business model constraint: Free Forever

This is a **product constraint carried into every feature above**, not a separate initiative:
- No pricing page, seat licensing, or "contact sales for schools" flow should be designed as part of the School feature — every competitor researched charges at that tier; Bookie explicitly does not.
- Any gamification or sharing mechanic (badges, challenges, share cards) must not gate core functionality behind payment — matching the existing "no ads, no fees, ever" copy.
- Sustainability of this model at school scale (support load, moderation load, infrastructure cost as usage grows) is a real open question but is a **business/ops decision, not something to solve by quietly introducing monetization into the design** — flag it explicitly to the user rather than assuming a workaround.

---

## 9. Cross-cutting requirement: mobile-first

All of the above (reader book list, School creation journey, gamification surfaces, sharing/invite flows) must be designed mobile-first, following the app's existing pattern of bottom sheets and single-column stacks with `lg:` breakpoints as progressive desktop enhancement, not the reverse.

---

## 10. Next steps (follow-up session agenda)
1. Resolve remaining open questions in §3.3, §4.4 (#1, #4-6), §5.3, §6.4.
2. Decide the School data model (new top-level entity vs. nested-groups-on-a-club) before any schema migration — now constrained by §7.3: students are always parent-linked `family_members` rows, so the model must plug into the existing family/club membership tables rather than a parallel student table.
3. Decide the gamification mechanic set (streaks/badges/challenges/leaderboards) and whether reading-verification is in scope at all.
4. Decide the school link/invite mechanism (scoped tokens vs. short join codes vs. bulk CSV) building on the existing `invite_token` pattern, per the resolved consent chain in §7.3 (link must resolve through an adult account holder, never straight to a bare student record).
5. Optional: draft a short School-context addendum to the Privacy Policy (§7.3 remaining item) — copy task, not a design blocker.
6. Wireframe "Create new club → School" once the above is settled.

---

## 11. Appendix — key file references
- Reader profile / "+N more": `src/components/ReaderProfileSheet.tsx:309-341`
- Full book list (self-scoped only today): `src/pages/BooksPage.tsx`
- Club creation form: `src/pages/ClubsPage.tsx:267-413`
- Club detail (tabs, groups, reports, roles, moderation): `src/pages/ClubDetailPage.tsx`
- Family invite flow: `src/pages/InvitePage.tsx`
- Club invite flow: `src/pages/ClubInvitePage.tsx`
- Gamification: `src/lib/milestones.ts`, `src/components/MilestoneModal.tsx`, `src/components/ReaderProfileSheet.tsx:11-30`
- Sharing: `src/lib/shareCard.ts`, `src/components/ShareSheet.tsx`
- Landing page brand promise: `src/pages/LandingPage.tsx:67,286,312`
- Types: `src/lib/types.ts`
- DB schema: `supabase/schema.sql`, `clubs_schema.sql`, `clubs_schema_v2.sql`, `clubs_schema_patch.sql`, `topics_schema*.sql`, `moderation_schema.sql`
- Admin/permissions: `src/lib/admin.ts`, `src/pages/AdminDashboard.tsx`
- Privacy/Terms: `src/pages/PrivacyPage.tsx`, `src/pages/TermsPage.tsx`
- Auth/member model: `src/contexts/AuthContext.tsx`
