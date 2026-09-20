# Bookie — Product Requirements Document

**Status:** Draft scaffold (v0.1) — created 2026-09-20, to be completed in a follow-up session.
**Owner:** Janico Steyn
**Scope of this draft:** grounding facts about the current app + the two prioritized issues below. Acceptance criteria, exact UX flows, and final data model are intentionally left open for the next session.

---

## 0. Note on "hidden instructions" search

I searched the repo for any hidden or commented instructions left for the original Figma Make agent (code comments, `guidelines/Guidelines.md`, `ATTRIBUTIONS.md`, README, HTML comments, `.env.txt`, hidden dotfiles). Findings:

- `guidelines/Guidelines.md` is **unfilled boilerplate** — it's the stock Figma Make template text wrapped in an HTML comment, with only the placeholder line `**Add your own guidelines here**` outside the comment. No custom guidance was ever added.
- `ATTRIBUTIONS.md` only lists open-source/photo licenses (shadcn/ui, Unsplash).
- No `.figma-make`, `PRD`, `SPEC`, or notes files exist anywhere in the repo.
- No suspicious/instructional comment blocks were found in `src/**` beyond ordinary section-divider comments (e.g. `// ─── Types ───`) and a few genuine engineering comments explaining non-obvious logic (e.g. the milestone-celebration write-then-confirm sequencing in `DashboardPage.tsx:116-167`).

**Conclusion: there is no hidden/prior instruction set to recover.** This PRD is being built from scratch based on the current codebase.

---

## 1. Product overview

**Bookie** is a mobile-first family reading-tracker web app (React + Vite, Supabase backend, deployed on Vercel), originally scaffolded via Figma Make (`figma.com/design/KXuD2WHkO8BqAIifCtFD9Y/Bookie`). It targets South African families (POPIA — Protection of Personal Information Act — is explicitly referenced throughout the Privacy Policy and Terms).

Core capabilities today:
- **Family accounts**: one adult Supabase Auth user per family (`family_members.user_id`), with additional child profiles as sibling rows in the same family that have **no independent login** (`user_id` is null). Children are represented only by nickname, avatar emoji, role label, and a coarse `age_group` bucket — no legal name, DOB, or contact info is collected for them.
- **Personal library**: books, reading progress (want/reading/finished), ratings/reviews, milestones (e.g. "10 books read"), a dashboard with stats and a "Star Reader" callout.
- **Reading Clubs**: opt-in groups beyond the family, with two existing types — `social` and `educational` — books, age-banded "reading groups," discussion topics/comments with profanity filtering and moderation, join requests, invite links, and an owner-only Reports tab.
- **Sharing**: branded PNG "share cards" (book / reader / app-invite) generated client-side and pushed through the Web Share API, plus a bare "copy link" flow for club invites.
- **Admin**: a platform-level super-admin console (global stats, library insights, global profanity word list) — entirely separate from club-level roles.

---

## 2. Current architecture snapshot

| Concern | Current state | Key files |
|---|---|---|
| Family/member model | 1 auth user = 1 adult `family_members` row; children are extra rows, no auth, `age_group` enum only | `src/contexts/AuthContext.tsx`, `src/lib/types.ts` |
| Personal reading data | `books`, `reading_progress`, `ratings` — all family-scoped | `supabase/schema.sql` |
| Reading Clubs | `clubs.club_type`: `"social" \| "educational"`; `club_members.role`: `owner \| admin \| member` (flat, per-club only) | `supabase/clubs_schema.sql`, `clubs_schema_v2.sql`, `topics_schema*.sql` |
| Reading groups | `reading_groups` (club-level, flat, age-banded: `age_min`/`age_max`); `reading_group_members` join table **exists in schema but has no assignment UI anywhere** | `supabase/clubs_schema_v2.sql`; gap confirmed in `src/pages/ClubDetailPage.tsx` |
| Moderation | Global profanity word list (`moderation_words`, super-admin curated), per-club/per-topic toggles, per-member comment blocking | `supabase/moderation_schema.sql`, `src/lib/profanityFilter.ts` |
| Reporting | Owner-only "Reports" tab per club: per-member/per-book stats + CSV export | `src/pages/ClubDetailPage.tsx` (Reports tab) |
| Admin/permissions | Two disconnected tiers: platform super-admin (`is_super_admin()`) and per-club role (owner/admin/member). **No org/multi-club grouping, no granular permission flags.** | `src/lib/admin.ts`, `src/pages/AdminDashboard.tsx` |
| Sharing | Rich branded canvas share-cards + OS share sheet for books/readers/app; plain clipboard copy for club invite links (two different maturity levels) | `src/lib/shareCard.ts`, `src/components/ShareSheet.tsx`, `ClubDetailPage.handleCopyInvite` |
| Privacy/POPIA | Fully described in `PrivacyPage.tsx`/`TermsPage.tsx` prose only — **not enforced in the database.** No consent-logging table, no DOB, no minimum-age gate beyond the 18+ ToS clause for the account creator, no per-child consent flag. Current model assumes the enrolling adult is the child's parent/guardian. | `src/pages/PrivacyPage.tsx`, `src/pages/TermsPage.tsx` |

---

## 3. Feature 1 — View all books read from a reader profile

### 3.1 Problem
Tapping a reader's profile (from the Dashboard) opens `ReaderProfileSheet`, which shows a "Books finished" grid capped at 10 covers. If there are more, it renders **static, non-interactive text**: `+{N} more` — there is no way to see the rest.

### 3.2 Current behavior (exact reference)
- `src/components/ReaderProfileSheet.tsx:309-341` — `stats.finishedBooks.slice(0, 10)` renders a 5-column grid; if `finishedBooks.length > 10`, line 335-339 renders a plain `<p>` with `+{count - 10} more` and **no `onClick`**.
- The sheet already has a `goToBook(bookId)` navigator (`ReaderProfileSheet.tsx:62-65`) used by every other book tile, so the tap-to-navigate pattern already exists for individual books — it's just missing at the list level.
- `src/pages/BooksPage.tsx` is the app's only "full book list" screen. It reads `?view=<status>` from the URL (`useSearchParams`, line 20-21) but **filters by the currently signed-in member (`member?.id`) only** (line 56) — it cannot currently show another family member's (e.g. a child's) finished books via URL param.
- A very similar truncation pattern (without a fix requested here, but worth being consistent with) exists in `src/pages/ClubDetailPage.tsx:1526-1543` for the club Members list sidebar (`+{N} more` → switches to the Members tab). That one is a good model: **"+N more" as a real, tappable affordance that reveals the rest.**

### 3.3 Desired behavior (to refine next session)
Tapping "+N more" (or the whole finished-books section) should take the user to a full list of that reader's finished books — filterable, mobile-first, and clearly scoped to that reader (not the whole family library).

### 3.4 Open questions for next session
1. **Surface**: reuse/extend `BooksPage` with a `?reader=<memberId>` param (requires loosening its `member?.id`-only filter), or build a dedicated full-screen/route (`/readers/:memberId/books`), or an in-sheet expanding list (no navigation, just "show all" within the existing bottom sheet)?
2. **Scope**: "all books read" — finished only (matches current section title), or also include reading/want-to-read with tabs, matching `BooksPage`'s existing filter chips?
3. Should this reuse `BooksPage`'s existing filter UI (`FilterStatus` chips) for consistency, and if so, does the "child" viewing rule matter (e.g. can a child open a sibling's list, or only a parent)?
4. Any pagination requirement once a reader has many dozens of finished books, or is a single scrollable list sufficient at expected scale?

### 3.5 Constraints
- Mobile-first: the current bottom-sheet modal (`Dialog.Content`, max-h-90vh) is already mobile-optimized; whatever destination is chosen must work well as a full-screen mobile view, not just widen a desktop grid.

---

## 4. Feature 2 — Dedicated "School" reading club type

### 4.1 Problem
"Create new club" currently only offers two types — **Social** and **Educational** — both flat, single-level clubs with no school-specific structure. Schools need: a distinct creation journey, nested grouping (grade → class), tailored sharing mechanics, reporting suited to an institution, stricter/different access control, and explicit POPIA handling for minors whose data is being entered by a **teacher/school**, not a parent (a scenario the current Privacy Policy doesn't cover).

### 4.2 Current state and gaps (confirmed in code)

| Area | Today | Gap for "School" |
|---|---|---|
| Club type selection | `"social" \| "educational"` radio choice in the create-club sheet (`ClubsPage.tsx:280-294`) | No `"school"` option; no branching journey after selection |
| Grouping | `reading_groups`: one flat, age-banded list per club (name, age_min/age_max). **No member-to-group assignment UI exists** even though `reading_group_members` exists in the schema | Need **nested** grouping (e.g. Grade 4 → Class 4A/4B), not just a flat age band; need a working assignment UI (currently entirely missing) |
| Roles | `club_members.role`: owner / admin / member — flat, per-club, no cross-club concept | Schools need role semantics like **teacher**, **school admin**, **parent/guardian**, **student**, likely with different capabilities per grade/class, not just per-club |
| Access control | Owner = sole moderator with unrestricted control per in-app copy; admin shares most owner capabilities; no granular permission flags; no org spanning multiple clubs | Need scoped permissions (e.g. a teacher manages only their class, a school admin manages all grades) — the current model has no concept of a "parent org" (school) containing multiple clubs/classes |
| Reporting | Owner-only Reports tab: per-member/per-book stats, CSV export, at the single-club level | Need rollups **by grade/class**, and likely multi-recipient access (teacher sees their class, school admin sees all) |
| Sharing/invites | Two disconnected patterns: rich branded share cards (books/readers/app) vs. bare invite-link copy for clubs | Needs a school-appropriate invite/roster mechanism — e.g. per-class join codes, bulk parent invites — not designed yet |
| POPIA / data protection | Privacy Policy only covers a **parent enrolling their own child**; consent is "the adult account holder consents on the child's behalf." No DOB, no consent logging, no data-minimization enforcement in the DB (only in prose) | A school enrolling a student is a **different lawful-processing scenario** under POPIA — the school (as a "responsible party" alongside/instead of Bookie) is entering a minor's data on behalf of parents, not as the parent. This needs its own consent/authority model, data minimization review (what does a school actually need to store — likely just first name + class, no more than today's "no full legal names" family policy), and probably a distinct retention policy (e.g. purge at end of school year/when a child leaves the school) |

### 4.3 Desired high-level journey (draft — to detail next session)
1. User taps **"Create new club"** → chooses club type: Social / Educational / **School** (new).
2. Choosing **School** branches into a dedicated setup flow, distinct from the existing single-step create form, likely covering:
   - School identity (name, location — reuse existing city/suburb fields?)
   - Nested structure setup: grade(s) → class(es) within each grade (dynamic — add/remove grades and classes)
   - Roles/access: who is a teacher (manages a class), who is a school admin (manages the school/all grades), how parents/students are represented
   - Sharing mechanics for onboarding (invite teachers, invite parents per class, join codes, etc. — TBD)
   - POPIA-relevant consent capture appropriate to a school context

### 4.4 Requirement areas to scope next session
- **Dynamic nested grouping** — data model for grade → class (or a generalized N-level group hierarchy?) replacing/extending the current flat `reading_groups` table, plus the assignment UI that doesn't exist today.
- **Sharing mechanics** — decide the invite/onboarding pattern for a school (bulk, per-class codes, teacher-mediated, etc.), building on or replacing the existing `invite_token` link pattern.
- **Reporting** — grade/class-level rollups on top of the existing `club_member_report`/`club_books_report` RPC pattern.
- **Access control & permissions** — a role model beyond owner/admin/member that can scope a teacher to their class while a school admin sees everything; whether this needs a step above "club" (a "school" entity owning many class-clubs) or can be modeled as nested groups with role-per-group.
- **POPIA data protection** — consent model for school-enrolled minors, data minimization (what fields a school role actually needs), retention/deletion rules distinct from the family model, and whether the existing Privacy Policy/Terms need a school-specific addendum.

### 4.5 Open questions for next session
1. Is a "school" a new top-level entity (owning multiple class-clubs, with its own admins), or is it one `club` of type `school` with nested `reading_groups`-as-grades-and-classes underneath it?
2. Who is the "student" in the data model — a `family_members` row (as today), or does school enrollment need a lighter-weight identity that doesn't require a family account at all (e.g. a teacher adds "Thabo, Grade 4A" without Thabo having a Bookie family)?
3. What exactly triggers POPIA consent in a school flow — the school's own consent process (school already has parental consent on file offline) vs. Bookie needing its own in-app consent capture? This has real legal implications and should probably get input from whoever handles compliance, not be assumed by engineering.
4. Does a school club still support the existing club features as-is (topics/discussions, book club "group read," progress tracking), or does School intentionally disable some of those (e.g. no open discussion threads for younger grades)?
5. Reporting audience: is it just internal to the school (teacher/admin), or could a "share with parents" report be part of "sharing mechanics"?

---

## 5. Cross-cutting requirement: mobile-first

Both features must be designed mobile-first — the existing app already leans on bottom sheets, single-column stacks, and `lg:` breakpoints as progressive enhancement for desktop, not the other way around. Any new screens (full book list, school creation wizard, nested grouping UI) should follow that same pattern: a mobile bottom-sheet/full-screen flow first, with desktop treated as an enhancement.

---

## 6. Next steps (follow-up session agenda)
1. Resolve the open questions in §3.4 and §4.5 (some — especially POPIA consent scope — may need non-engineering input).
2. Turn §3 into concrete acceptance criteria and pick the implementation surface (extend `BooksPage` vs. new route vs. in-sheet expansion).
3. Decide the data model for nested school grouping (§4.2/§4.4) before any schema migration is written.
4. Draft the school-specific POPIA consent/data-minimization requirements as their own reviewable section.
5. Wireframe the "Create new club → School" journey once the above is settled.

---

## 7. Appendix — key file references
- Reader profile / "+N more": `src/components/ReaderProfileSheet.tsx:309-341`
- Full book list (family-wide, self-scoped only today): `src/pages/BooksPage.tsx`
- Club creation form: `src/pages/ClubsPage.tsx:267-413`
- Club detail (tabs, groups, reports, roles, moderation): `src/pages/ClubDetailPage.tsx`
- Club invite flow: `src/pages/ClubInvitePage.tsx`
- Types: `src/lib/types.ts`
- DB schema: `supabase/schema.sql`, `clubs_schema.sql`, `clubs_schema_v2.sql`, `clubs_schema_patch.sql`, `topics_schema*.sql`, `moderation_schema.sql`
- Admin/permissions: `src/lib/admin.ts`, `src/pages/AdminDashboard.tsx`
- Privacy/Terms: `src/pages/PrivacyPage.tsx`, `src/pages/TermsPage.tsx`
- Auth/member model: `src/contexts/AuthContext.tsx`
- Sharing: `src/lib/shareCard.ts`, `src/components/ShareSheet.tsx`
