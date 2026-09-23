# Bookie — Product Requirements Document

**Version:** 0.3
**Status:** Approved direction for MVP build. Items marked *Open* still need a decision.
**Last updated:** 2026-09-23
**Owner:** Janico Steyn, Chief Product Officer, Signal UX
**Replaces:** v0.2 (2026-09-20). Decisions in v0.2 that this version reverses are listed in §0.2.

---

## 0. About this document

### 0.1 How to use it
- §1–§4 explain why Bookie exists, who it's for and what the MVP includes.
- §5–§13 are the feature requirements, each with acceptance criteria.
- §14–§16 cover privacy, hosting and non-functional requirements.
- §17 is the build order. §18 lists open questions. §19 is the research that informed this version.
- Data model changes are **proposed**, not final. Implementers should confirm them against the current schema before migrating.

### 0.2 Changes from v0.2
| Topic | v0.2 said | v0.3 says | Section |
|---|---|---|---|
| Ads | "No ads, ever" was a hard constraint | Ads allowed in adult areas only. R49 once-off removes them. Children never see ads. | §12 |
| Student profiles | A school can never create a student record; students are always family-created | A school may create a learner profile, which must be handed over to a parent or guardian while the learner is under 18 | §10.3 |
| Content | Bookie is book-agnostic and should not become a content platform | Still book-agnostic for tracking. Adds a reader with legally free books (Book Dash first). No licensed or paid content. | §7 |
| Gamification | Open question: streaks, badges, challenges | Gentle mode by default, re-reads count, time targets optional, challenges can be switched off | §6 |
| Experience | Not covered | Total redesign, including Immersion mode | §5 |
| Languages | English only | English, Afrikaans, isiXhosa in the MVP | §9 |
| Hosting | Not covered | Ireland (Vercel `dub1`, Supabase `eu-west-1`) | §15 |

---

## 1. Vision and goals

### 1.1 Vision
Get South African children reading and excited to read, by getting the adults around them — parents, grandparents, teachers — reading with them. Bookie serves everyone from babies being read to, to readers aged 100+.

### 1.2 Goals, in priority order
When two goals conflict, the higher one wins.

1. **Make reading fun.**
2. **Help parents with their children's reading, and their own.**
3. **Profile progression and ownership, and book clubs.** Readers build a reading history they own, and read together in clubs.
4. **Work well for South African state schools and home-schooling parents**, on the CAPS or Cambridge curriculum.

Every feature is checked against goal 1. School features are the most likely to turn reading into homework, so they get the strictest check.

### 1.3 Business purpose
Bookie is free to use and is built to make **Signal UX** known. It is a showcase of Signal UX's design and product work. Ads (§12) cover running costs; they are not the purpose.

### 1.4 Principles
- **Free to use, always.** No feature a reader needs is ever behind a payment. Reading education is a right.
- **Children never see ads**, on any screen, in any context.
- **No pressure by default.** Celebrate reading; never punish not reading.
- **Honest claims only.** Don't say "CAPS-aligned" until a qualified teacher has reviewed the content. Don't promise what can't be kept.
- **Built for South Africa:** local languages, data costs, low-end Android phones, shared devices, homes without books.
- **Privacy first.** Collect the least data needed. POPIA applies to everything.

---

## 2. Users

### 2.1 Who uses Bookie
| User | What they need |
|---|---|
| Parent or guardian | Track their children's reading and their own; see progress; manage profiles and settings |
| Grandparent or other family adult | Read with and encourage the children, often from another home |
| Child | A fun reason to read; celebrations; their own world |
| Teen | Track reading without it feeling childish; clubs with friends |
| Adult reader | A simple reading tracker and book clubs |
| Teacher (state school) | Get a class reading with little admin; see who is reading; share progress with parents |
| School admin | Set up the school, grades and classes; see school-wide reading |
| Home-schooling parent | Act as both parent and teacher; keep a reading record for their child's portfolio |
| Library or bookstore partner (later) | Run challenges; see participation |

### 2.2 Age groups
The app's current bands (`0-2`, `3-5`, `6-9`, `10-15`, `16-21`, `22-35`, `36-65`, `66+`) are replaced. `10-15` is too wide, and the new bands match school phases.

| Group | Ages | School phase | Immersion default |
|---|---|---|---|
| Little ones | 0–2 | — | Shared with parent (later phase) |
| Explorers | 3–5 | Pre-school, Grade R | On |
| Adventurers | 6–9 | Foundation Phase (Grades 1–3) | On |
| Navigators | 10–12 | Intermediate Phase (Grades 4–6) | On |
| Travellers | 13–17 | Senior Phase and FET (Grades 7–12) | Offered, off |
| Adults | 18+ | — | Optional, off |

Adult bands (`18-21`, `22-35`, `36-65`, `66+`) are kept for stats. `prefer_not_to_say` is kept and defaults to the adult experience.

**Acceptance criteria**
- [ ] Migration maps `10-15` members to `10-12` or `13-17`. Where the correct band is unknown, the parent is asked on next sign-in.
- [ ] Migration maps `16-21` to `13-17` or `18-21` the same way.
- [ ] Every child profile has a band before Immersion mode loads.

*Open (§18, Q3):* how bands move up as children age, since Bookie does not collect date of birth.

---

## 3. Current state (September 2026)

Bookie is a mobile-first web app: React and Vite, Supabase backend, deployed on Vercel. It was scaffolded in Figma Make.

**What works today:** family accounts with child profiles, ISBN scanning via Open Library, want-to-read / reading / finished tracking, ratings and reviews, the Bookworm score and 6 levels, milestone celebrations with confetti, the family Star Reader, reading clubs (social and educational) with topics, moderation and reports, family and club invite links, branded share cards, and an admin console.

**Known gaps and problems in the current build**
| Problem | Where | Fixed in |
|---|---|---|
| Re-reads can't be counted: one `reading_progress` row per book per member | `supabase/schema.sql` | §6.2 |
| `is_child_mode` is stored but nothing uses it | `src/lib/types.ts`, `SettingsPage.tsx` | §5.2 |
| All text is written directly in components; no translation | `src/**` | §9 |
| No web app manifest or service worker; nothing works offline | `public/`, `vite.config.ts` | §8 |
| Signal UX doesn't appear anywhere in the app | `LandingPage.tsx` | §13 |
| Landing page promises "No ads … Ever" | `LandingPage.tsx:67,286,312` | §12.6 |
| Reader profile shows only 10 finished books; "+N more" isn't tappable | `ReaderProfileSheet.tsx:309-341` | §11.1 |
| Reading group assignment table exists but has no UI | `clubs_schema_v2.sql` | §10 |
| Club invites are a bare copied link, unlike branded share cards | `ClubDetailPage.handleCopyInvite` | §11.2 |

The file reference appendix from v0.2 is kept in §20.

---

## 4. MVP scope

### 4.1 In the MVP
1. **Total redesign**, including Immersion mode for Explorers, Adventurers and Navigators (§5).
2. **Motivation model:** gentle mode by default, re-reads count, reading sessions, optional time targets, challenges that can be switched off (§6).
3. **In-app reader and offline reading** for Book Dash books, once the partnership is confirmed (§7, §8).
4. **Full app in English, Afrikaans and isiXhosa** (§9).
5. **Schools and home-schooling:** schools, grades, classes, school-created learner profiles with handover, class codes, class reading mode, reports (§10).
6. **Carried-over fixes:** full book list from a reader profile, school-ready invite links (§11).
7. **Ads in adult areas and R49 ad-free purchase** (§12).
8. **Signal UX branding and the Boekie story** (§13).
9. **Hosting in Ireland** (§15).

### 4.2 Not in the MVP (planned for later)
- Out-of-copyright classics (Standard Ebooks), and the licence rules for them (§7.8).
- The other 8 official spoken languages, and South African Sign Language content.
- Immersion worlds for Little ones, Travellers and Adults.
- Book donations and "hand-me-down" book drop-offs.
- Library and bookstore partner tools.
- Licensed or paid ebooks.
- Reading verification (quizzes). Not planned at all; see §6.6.

---

## 5. Experience: redesign and Immersion mode

### 5.1 Overview
Bookie is getting a total redesign. Its centrepiece is **Immersion mode**: an adventure map that shows a child's reading as a journey across South Africa, one region per month.

- **On by default** for Explorers, Adventurers and Navigators (ages 3–12).
- **Offered but off** for Travellers (13–17). **Optional** for adults.
- **Can be switched off** by the child or their parent.
- **Only affects the view of that profile.** Other family members, and parents looking at a child's progress, see the standard view.

All sprites and graphics are designed in-house by Signal UX (§5.8).

### 5.2 Immersion switch
**Requirements**
- Stored per profile: `family_members.immersion_enabled` (replaces the unused `is_child_mode`).
- Default set from the age group (§2.2) when the profile is created or its band changes.
- Available in the profile's settings, and in the parent's settings for each child profile.
- On a shared phone, switching profile switches the view immediately.

**Acceptance criteria**
- [ ] A new child profile aged 3–12 opens in Immersion mode.
- [ ] Switching Immersion off for one child does not change any other profile.
- [ ] A parent viewing a child's progress always sees the standard view, even if the child uses Immersion.
- [ ] `is_child_mode` is migrated into `immersion_enabled` and then removed.

### 5.3 The map
**How progress is shown**
- The **path grows with reading, not with the date.** Each reading session moves the child forward one step.
- Days without reading do **not** appear as gaps, empty spaces or red marks.
- If days are shown on the map at all, a day without reading is a neutral **rest stop**.
- The day-by-day detail (if, when and how much the child read) is shown to **parents** in the standard view, not on the child's map.

**What appears on the map**
- Reading stops (one per session), including re-reads.
- Challenge landmarks the child is travelling towards.
- Class landmarks: goals the whole class travels towards together.
- A finish point at the end of each month's region.

**Acceptance criteria**
- [ ] A child who reads on 5 days of a month sees 5 steps of progress and no marks for the other days.
- [ ] Reading logged offline appears on the map once synced (§8).
- [ ] The map has a text version for screen readers listing progress, landmarks and celebrations.
- [ ] With the phone's reduced-motion setting on, the map shows no movement except where the user taps.

### 5.4 Companions
Every age group travels the **same map**. The child chooses a **companion**: a character and a way of travelling (for example a hot-air balloon, a steam train, a meerkat on foot).

- **Three companions per age group.** They are not labelled or assigned by gender. The child picks the one they like.
- The companion can be changed at any time without losing progress.
- Bookie does **not** use gender to choose or suggest a theme or companion. (The existing `gender` field, derived from family role for milestone wording, is not used by Immersion mode.)

**Acceptance criteria**
- [ ] First time in Immersion mode, the child picks a companion from the three for their age group.
- [ ] Changing companion keeps all map progress, collectables and celebrations.

### 5.5 Monthly regions
Each month is a region of the map, themed on South Africa, following southern-hemisphere seasons and the school calendar. Draft, to be finalised by design:

| Month | Region | Hook |
|---|---|---|
| January | Summer coast | Back to school |
| February | Fynbos and Table Mountain | Plants and animals |
| March | Rivers and wetlands | Human Rights Month |
| April | Autumn Karoo | Easter holidays, Freedom Day |
| May | Highveld grasslands | Autumn |
| June | Drakensberg in winter | Youth Month |
| July | Winter holiday village | Mandela Day, kindness |
| August | Namaqualand flowers | Spring begins |
| September | Heritage trail | Heritage Month |
| October | Bushveld and Kruger | Wildlife |
| November | Karoo night sky | Exam season, calm |
| December | Summer holiday coast | Year-end celebration |

- A region opens on the 1st of its month.
- Finishing a region (reaching its finish point) triggers a celebration and adds that region's collectable to the child's collection.
- Unfinished regions are never shown as failed. The child simply moves to the new region when the month changes.

### 5.6 Age group styles
| Group | Style |
|---|---|
| Little ones (0–2), later | Big simple pictures, one step per session, no text; operated by the parent |
| Explorers (3–5) | Bright, playful, lots of animation |
| Adventurers (6–9) | Richer map, first landmarks and challenges |
| Navigators (10–12) | More detail, class challenges, collectables |
| Travellers (13–17), later | Grown-up and relevant to teens, e.g. a road-trip journal or a star map; not cartoon |
| Adults (18+), later | A minimal "reading journey" view |

### 5.7 Celebrations
Builds on the existing `MilestoneModal` and `canvas-confetti`.
- Month complete, level up, challenge complete, class goal reached.
- In Immersion mode, celebrations use the companion's "celebrating" animation.
- Existing milestone copy is kept and translated (§9).

### 5.8 Design inventory
Each item needs a design brief. Counts are per age group. **MVP: Explorers, Adventurers and Navigators, starting with one companion per group for the pilot (§17).**

**Art rules for every item**
- Vector format. No text inside artwork; all labels are live text in three languages.
- Colours that work for colour-blind readers.
- A still version of anything animated, for reduced motion.
- Stays within the agreed size limit per region (§16).

**Checklist per age group**
- [ ] **Map regions (12):** background art; the path the progress follows; 3–5 landmarks; 2–3 background layers that move slightly for depth, with a still version.
- [ ] **Path points (about 6 types):** reading stop, re-read marker, rest stop, challenge landmark, class landmark, month finish point.
- [ ] **Companions (3), each with 5 states:** idle, travelling, reading, resting, celebrating.
- [ ] **Celebrations (about 4):** month complete, level up, challenge complete, class goal reached.
- [ ] **Collectables (12):** one keepsake per region (for example a protea, a whale).
- [ ] **Seasonal overlays:** weather and time of day, reusable across regions.
- [ ] **Interface pieces:** Immersion on/off switch, progress widget for the top of the screen, companion picker, collection screen, text version of the map.

Path points, overlays and interface pieces should be reused across age groups where the style allows.

**Before design starts, agree with development:** the vector format, the animation format, and the size limit per region.

### 5.9 Standard (non-immersion) redesign
The standard view is redesigned alongside Immersion mode. It is used by adults, teens, parents viewing children, teachers, and anyone who switches Immersion off.
- Mobile-first, following the existing bottom-sheet and single-column pattern (§16).
- Shows the parent-facing day-by-day reading detail (§5.3).
- Every screen that a child could see when an adult is logged in (§12.2) is designed without ad space.

---

## 6. Motivation and gamification

### 6.1 Principles
Research shows that compulsory reading logs and timers can reduce children's interest in reading for fun (§19.3). Bookie therefore:
- Celebrates reading and never punishes not reading.
- Makes targets **suggestions**, never quotas.
- Lets every reader, or their parent, switch pressure off.

### 6.2 Reading sessions and re-reads
Today, Bookie can only record a book once per reader. Babies and toddlers read the same book many times, and that must count.

**Requirements**
- New `reading_sessions` table (proposed): `id`, `member_id`, `book_id`, `started_at`, `ended_at`, `duration_seconds` (nullable), `source` (`manual` | `reader` | `class`), `logged_by_member_id`, `created_at`.
- A session can be logged manually ("We read this today") or recorded automatically by the in-app reader (§7).
- "Read to" and "read by" are both valid. A parent or grandparent can log a session for a child.
- Finishing a book again counts as a re-read: new `book_completions` table (proposed) or a completion flag on sessions.
- `reading_progress` keeps the current status (want to read / reading / finished).

**Acceptance criteria**
- [ ] A parent can log the same picture book for a child 10 times, and all 10 count toward the child's totals and map.
- [ ] The Bookworm score and milestones include re-reads.
- [ ] Any adult in the family can log a session for any child in the family.

### 6.3 Gentle mode and optional targets
- **Gentle mode is the default for every profile.** It celebrates sessions, books and good weeks. It shows no targets and no missed days.
- **Suggested daily reading time per age group** is available as an opt-in. It is phrased as a suggestion ("A good amount for this age is about X minutes"). *Open (§18, Q4): the suggested times per age group need an education source before launch.*
- If targets are switched on, the reader can miss a few days without losing a "good week". No streak is ever reset to zero in front of a child.
- Time counts where available (sessions from the reader, or entered manually), so children aren't pushed toward short books to raise their book count.

### 6.4 Challenges
- Challenge types: book count (e.g. 100 books in a year), time, variety (e.g. a book in each language), and class challenges.
- Readers can choose challenges as they get older. They are offered from Adventurers (6–9) up.
- Challenges can be switched off per profile. Switching off hides challenge landmarks and progress bars.
- **Family settings override school pressure:** if a family has challenges or targets switched off, school challenges still record participation for the teacher but show no pressure to the child. The teacher sees "participating", never "failing".

**Acceptance criteria**
- [ ] A reader with challenges off sees no challenge progress anywhere.
- [ ] A teacher's class challenge report never shows a child as failed or behind.

### 6.5 Carried over from v0.2 (§5)
Streaks, collectible badges and leaderboards remain options. Decisions for the MVP:
- **Streaks:** no visible streak counter for children. Adults can switch one on. "Good weeks" replace daily streaks in Immersion mode.
- **Badges:** region collectables (§5.5) are the MVP badge system. They extend the existing milestone system.
- **Leaderboards:** none for children in the MVP. Class progress is shown as a shared goal, not a ranking.

### 6.6 Reading verification
No quizzes or reading verification. They conflict with goal 1 and with Bookie's trust-based, family-first tone.

---

## 7. In-app reader and free books

### 7.1 Status
**Waiting on Book Dash.** A partnership request has been sent. The reader and import pipeline are built, but **no Book Dash title is published until Book Dash agrees or the product owner decides otherwise.** A feature flag controls this.

### 7.2 Why
Many South African homes have no children's books. A tracker alone assumes families already own books. The reader gives every family free, legally shareable books in their own language.

### 7.3 Source for the MVP: Book Dash only
- Book Dash books are published under **CC BY 4.0**: anyone may read, download, print, adapt and share them, including commercially, with attribution.
- Current catalogue is on bookdash.org as source files per title and language: a full PDF ebook plus individual page images.
- Book Dash's GitHub EPUB collection was last updated in November 2019, has 61 files, and contains no Afrikaans. **Do not use it as a source.**
- Book Dash has no public API. The partnership request asks for written permission to copy their files into Bookie on a schedule, and ideally a list or feed of new and changed titles.
- Book Dash books are picture books: mostly pre-school to Grade 3.

### 7.4 Catalogue pipeline
**Requirements**
- **Bookie keeps its own copy of every book** in Supabase Storage. It never links to other sites' files for reading.
- **Licence record for every book** (proposed `catalogue_books` and `catalogue_licences` tables): source, licence, original URL, creators, language, date checked, and attribution text generated from those fields.
- **Import jobs** check each source on a schedule (weekly), flag new and changed titles, and never publish automatically. Until Book Dash provides a feed, an admin imports titles manually through an admin tool.
- **Human review before publishing:** age band, language tag checked by a native speaker, and a content check.
- **One-click takedown:** removes a title from the catalogue and from devices on their next sync.
- **Picture books are stored page by page as images** (from Book Dash's page image files), so they load one page at a time and download efficiently.
- Catalogue books link to the existing book records so reading them updates the reader's shelf and sessions.

**Acceptance criteria**
- [ ] No catalogue book can be published without a complete licence record.
- [ ] Every catalogue book shows its attribution: title, creators, "Book Dash", licence name with link, and a link to bookdash.org.
- [ ] A taken-down title disappears from the catalogue immediately and from downloaded copies on the next sync.
- [ ] An import job run twice creates no duplicates.

### 7.5 Reader requirements
- Picture books: page-by-page display suited to fixed layouts. Text ebooks (later, for classics): reflowing text.
- **Remembers the exact page**, saved on the device on every page turn and synced to Supabase when online. If two devices disagree, the most recent position wins.
- **Records reading sessions automatically** (§6.2): start, end, duration, and completion when the last page is reached.
- Text size (for text books), the reader's chosen theme, bookmarks.
- Attribution screen at the start or end of every book, including "Made by Signal UX" (§13).
- Filter books by language and age band.
- **Later:** highlights, dictionary, read-aloud. The phone's built-in voices are patchy for Afrikaans and isiXhosa; test on real devices before offering read-aloud.

**Acceptance criteria**
- [ ] Closing and reopening a book returns to the same page, on the same or another device.
- [ ] Reading a book to the last page records a completion, including re-reads.
- [ ] The reader works fully offline for downloaded books (§8).

### 7.6 Where catalogue books appear
- A "Free books" section in the redesigned app, filtered to the reader's age band and language by default.
- For Immersion profiles, books are presented in the companion's style.
- Parents can pick books for a child; a child can browse books for their age band.

### 7.7 What stays the same
Bookie remains **book-agnostic for tracking**: any book, physical or digital, can still be logged by ISBN or search. The reader adds free books; it does not replace the tracker, and Bookie does not become a licensed content platform.

### 7.8 Later: out-of-copyright classics
Not in the MVP. Notes for when it's picked up:
- Preferred source: **Standard Ebooks** (CC0, clean EPUBs). Full feeds need a donor membership or sponsorship; open-source projects may qualify. Apply once the Bookie repo is ready.
- Avoid bulk use of Project Gutenberg: its terms target US users, it blocks automated access, and its licence has conditions when the Gutenberg name is used and money is made (ads may count).
- **Copyright must be clear in every country involved.** Bookie is hosted in Ireland and used in South Africa, and sources are US-based. As far as we understand: the US requires publication before 1931 (as of 2026); South Africa, author died more than 50 years ago; Ireland/EU, author died more than 70 years ago. Safe combined rule: **published before 1931 and author died before 1956.** Confirm with an IP attorney before launch; run the check automatically on every title.
- Only CC BY, CC0 or out-of-copyright material. Non-commercial licences (for example Vula Bula, CC BY-NC-ND) only by written agreement with the rights holder, because ads may make Bookie's use commercial.

---

## 8. Offline and installable app

### 8.1 Requirements
Bookie becomes an installable web app (PWA). Three things are stored on the device:
1. **The app itself** (screens, code, fonts, translations): web app manifest plus service worker, e.g. `vite-plugin-pwa`.
2. **Only the books the user chooses to download.**
3. **Reading sessions and positions logged offline**, uploaded when the app next opens online. Don't rely on background sync; Safari doesn't support it.

### 8.2 Device limits to design for
- **iPhone:** Safari deletes stored website data after 7 days without use; as far as we know, apps added to the Home Screen are exempt and get more storage. "Add Bookie to your Home Screen" is part of the download flow on iOS.
- Call `navigator.storage.persist()` to ask the browser to keep stored data.
- **Data costs:** show each book's download size; offer a "Wi-Fi only" setting.
- **Storage:** show how much space downloads use, with one-tap removal.
- Immersion map regions (§5.8) are downloaded one at a time and stored for offline use.

### 8.3 Acceptance criteria
- [ ] With the phone in airplane mode, an installed Bookie opens, shows the map and shelf, and opens downloaded books.
- [ ] Sessions logged offline appear on the map and in totals after reconnecting, with no duplicates.
- [ ] With "Wi-Fi only" on, nothing downloads over mobile data.
- [ ] iOS users are shown how to add Bookie to the Home Screen before their first download.

---

## 9. Languages

### 9.1 Scope
- **MVP:** English, Afrikaans, isiXhosa. Chosen for the Western Cape pilot; Book Dash has books in all three.
- **Later:** isiZulu, Sepedi, Setswana, Sesotho, then Xitsonga, siSwati, Tshivenda, isiNdebele. Order may change based on which schools sign on. South African Sign Language is treated as an accessibility feature (signed video content through a partner), not a UI translation.
- Covers every screen, button, error, celebration, badge, level name, share card, email, invite, onboarding step, challenge template, Immersion label and the landing page.

### 9.2 User requirements
- **Language is set per profile**, not per family. A grandparent can use Afrikaans while a child uses English on the same account.
- The app's language and the language of books are separate settings.
- First-run language is taken from the phone's settings and can be changed in two taps.
- The language picker shows each language in its own name ("Afrikaans", "isiXhosa", "English").
- Missing translations fall back to English, never to a blank or a code.
- Translations are stored with the app and work offline.
- Child-facing text uses simple words suited to the age group, in every language.

### 9.3 Technical requirements
- All text moves into translation files (e.g. `react-i18next`). No text written directly in components.
- **Whole sentences per message.** Don't join fragments like "You read" + number + "books"; in isiXhosa, surrounding words change with the noun.
- Plural rules per language.
- Layouts allow for longer words (isiXhosa words often run longer than English); test with the longest translation.
- Fonts support all characters needed now and later: Sepedi `š`, Tshivenda `ḓ ḽ ṅ ṋ ṱ`.
- Dates and numbers in South African formats; test browser support per language and fall back to `en-ZA`.
- Pseudo-localisation in development to catch untranslated text.
- The existing gendered milestone copy (`src/lib/milestones.ts`) is rewritten as whole sentences per language.

### 9.4 Translation quality and process
- Human translators for all child-facing and celebration text. Machine translation only as a first draft, always reviewed by a native speaker.
- At least one native-speaking teacher reviews each language before release.
- A glossary of Bookie terms (Bookworm, Star Reader, level names, companion names, region names, challenge types) keeps translations consistent.
- English is the source. New features may ship with English fallback, but a feature is only "done" when all three MVP languages are complete.
- Track usage per language.

### 9.5 Acceptance criteria
- [ ] Every screen is complete in all three languages, with no hardcoded English.
- [ ] Two profiles in the same family can use different languages on the same phone.
- [ ] Pseudo-localisation shows no untranslated text.

---

## 10. Schools and home-schooling

### 10.1 Goal
Make Bookie work for South African **state schools** and **home-schooling parents**, on **CAPS** or **Cambridge**, without adding admin work for teachers or pressure for children.

### 10.2 Structure
*Open (§18, Q1, carried from v0.2):* whether a school is a new top-level entity owning classes, or a club of type `school`. **Recommendation:** a new `schools` entity with `grades` and `classes`, because schools need their own roles, reports and ad rules (§12), and the handover flow in §10.3 doesn't fit club membership.

**Roles:** school admin, teacher, parent/guardian, learner. Roles are scoped to a school or class, not just a club.

**Learner profile fields:** curriculum (CAPS, Cambridge, none), grade (CAPS) or stage (Cambridge), home language, first additional language. Book suggestions use grade and language.

**Claims:** say "suitable for Grade X", never "CAPS-aligned", until a qualified teacher has reviewed the content. A partnership with the Western Cape Education Department (which lists free CAPS-aligned readers on its ePortal) is the route to the stronger claim.

### 10.3 Profiles created by schools, and handover
**This replaces the v0.2 ruling (§7.3) that schools can never create student records.**

**Two ways a learner joins a class**
1. **The child already has a family profile.** The parent opens the class link or code and approves linking the existing profile to the class. No duplicate profile is created.
2. **The school creates the profile.** The teacher or school admin creates a learner profile for the class.

**School-created profiles**
- The learner signs in with a class code or QR code plus their own simple sign-in (e.g. a picture password for young learners). No email address needed.
- Limited features: reading, the reader, class challenges and Immersion mode. **No clubs, no social features, no book reviews visible to others.**
- The school can generate a **handover code** at any time, printed on a handover letter or sent digitally to the parent.

**Handover**
- A parent or guardian claims the profile into their family account with the handover code. The reading history, map progress and collectables move with it.
- **Learners under 18 can only be claimed by a parent or guardian.** A learner aged 18 or over can claim their own profile.
- A profile can have **more than one guardian** (for separated families). Each guardian claims with their own code.
- After handover, the profile belongs to the family. The school keeps access to **class reading data only**, and only while the learner is in the class.
- When a learner leaves the class or school, the school's access ends. Claimed profiles stay with the family.
- **Unclaimed profiles** are deleted a fixed period after the learner leaves the school. *Open (§18, Q2): set the period with legal advice.*
- Handover reuses and extends the existing `claim_child_member` mechanism (`InvitePage.tsx:123-134`).

**Consent.** How a school may create profiles for minors under POPIA **must be checked by a lawyer before the first school pilot** (§14). The Privacy Policy and Terms need a school section naming the school as a party that can see class reading data.

**Acceptance criteria**
- [ ] A teacher can create 30 learner profiles for a class and print 30 handover letters.
- [ ] A parent claiming a profile sees the full reading history and map progress.
- [ ] A learner under 18 cannot claim their own profile.
- [ ] A parent with an existing child profile can link it to a class without creating a second profile.
- [ ] After a learner leaves a class, the teacher can no longer see that learner's reading.

### 10.4 Teacher tools
- **Class code or QR poster** to join. Short, readable codes a teacher can say aloud, plus the existing token-link pattern.
- **Class progress view:** who is reading, sessions and books this week and term. Shows participation, never failure (§6.4).
- **Class challenges** that appear as class landmarks on children's maps.
- **Class reading mode:** for classrooms with one device. The teacher reads a book aloud or projects it, and one tap logs the session for every learner present. **No ads, ever, in class reading mode** (§12.2).
- **Printable reports** per class and per learner, for parents and school records.
- Low data use; works on the teacher's own phone.

### 10.5 Reports
- Teacher: their classes. School admin: all grades and classes. Parent: their own children only.
- Reports to parents come from the teacher through Bookie, in the parent's language.

### 10.6 Home-schooling
- A home-schooling parent has the teacher role for their own children, with no school needed.
- Curriculum and grade set per child (CAPS or Cambridge).
- Term planning: reading goals per term (optional, following §6.3).
- **Exportable reading record** (PDF) per child per term or year, for the learning portfolio many home-schoolers keep.

### 10.7 Carried from v0.2
- A school class link opened by a family that already has a child profile lets the parent link that profile (§10.3 route 1).
- Keep today's club features for school classes? **Decision:** no open discussion threads for school classes in the MVP.

---

## 11. Carried-over features from v0.2

### 11.1 View all books read from a reader profile
The reader profile sheet shows only 10 finished books, and "+N more" does nothing.
- Make "+N more" open the full list for that reader, reusing `BooksPage` with a `?reader=<memberId>` parameter.
- Show all statuses with the existing filter chips.
- Family adults can see any child's list; children see their own; a child can see a sibling's finished list.

**Acceptance criteria**
- [ ] Tapping "+N more" opens the full list for that reader.
- [ ] A parent can open a child's full list from the child's profile.

### 11.2 Sharing and invite links
- Class links carry context: joining through a class link lands the learner directly in that class.
- Short readable class codes and QR codes (§10.4).
- Club invites get the same branded share-card treatment as book and reader cards.
- All share cards carry "Made by Signal UX" (§13) and are translated (§9).
- Firebase Dynamic Links are deprecated; keep using Bookie's own token URLs.

---

## 12. Ads and the R49 ad-free option

### 12.1 Why
Ads cover running costs. Using Bookie is always free. Ads are secondary to every goal in §1.2.

### 12.2 Where ads may and may not appear
**Ads may appear only in adult areas:** the adult feed, adult profiles, parent dashboards, and teacher and school admin screens.

**Ads never appear:**
- On any child profile, including Travellers (13–17).
- In Immersion mode.
- In the reader.
- In class reading mode, or on any screen likely to be projected or shown to a class.
- On any screen opened on a shared class device or a school-created learner sign-in.
- On catalogue book pages (keeps Bookie's use of openly licensed books clearly separate from advertising).

### 12.3 Ad format
- A clearly designed block with the heading **"Advertisement"** (translated), visually separate from Bookie content.
- Never styled like a book, a friend's post, a challenge or a celebration.
- Maximum frequency per screen to be set in design.

### 12.4 Ad source and data
- **No tracking and no personalised ads.** Ads are chosen by where they appear, not by who is viewing.
- **Direct sponsors first:** local bookstores, publishers, library events, stationery and education brands. Every ad is approved by Signal UX before it goes live.
- Ad networks only later, only if they can guarantee no tracking and no personalisation, and only after a privacy review.
- An admin tool to add, schedule, approve and remove sponsor ads.

### 12.5 R49 ad-free purchase
**Copy**
> **Go ad-free: R49, once-off.**
> Pay once and your family never sees an ad in Bookie again, for as long as Bookie runs. No subscription, no renewals.

**Rules**
- A **family** purchase removes ads for every adult profile in the family.
- A **teacher** can buy it for their own account.
- Schools and libraries do not need it: children never see ads anyway, and school admin screens can be made ad-free by agreement.
- Payment through a South African payment provider (e.g. PayFast, Yoco or Paystack). Card details never touch Bookie's servers.
- The purchase is recorded against the family or account (proposed `ad_free_purchases` table) and survives new devices and sign-ins.
- Receipt by email. Refunds handled manually.

**Acceptance criteria**
- [ ] After purchase, no ads appear for any adult in that family, on any device, after sign-in.
- [ ] No ad ever appears on a child profile, in Immersion mode, in the reader or in class reading mode, whether or not the family has paid.
- [ ] The purchase is restored automatically after signing in on a new device.

### 12.6 Landing page and terms: must change before the first ad
The landing page currently says "100% free · No fees · No ads · No catch · Ever" (`LandingPage.tsx:67`), "No subscription. No ads. No fees. Just books." (line 286) and "Free forever." (line 312).

- Replace with wording that stays true, for example: **"Free to use. Always. Children never see ads."**
- Update the Terms and Privacy Policy to describe ads and the R49 purchase.
- Tell existing users directly before ads go live.
- **No ad may go live until this is done.**

---

## 13. Branding

### 13.1 Signal UX
- "Made by Signal UX", with a link to signalux.co.za, appears on: the landing page, the About page, the reader's attribution screen, every share card and printable report, and handover letters.
- The footer line becomes: "A family app, by a family, for families. Made by Signal UX."

### 13.2 The name: Bookie
- Kept. "Bookie" combines the English "book" with the Afrikaans "boekie" (little book).
- **Tell the Boekie story on the landing page and the About page.** In South Africa, "bookie" also means a betting bookmaker; the story makes the intended meaning clear, especially for schools.

---

## 14. Privacy and legal

### 14.1 Principles
- Collect the least data needed. Nicknames, not full legal names. No date of birth.
- Children's data is controlled by a parent or guardian, or by the school until handover (§10.3).
- No tracking, analytics profiling or personalised ads on children, and no personalised ads for anyone (§12.4).
- Immersion mode never uses gender (§5.4).

### 14.2 Legal checks required
| Check | Needed before |
|---|---|
| POPIA basis for schools creating learner profiles for minors, and the handover process | First school pilot |
| Retention period for unclaimed school-created profiles | First school pilot |
| School section in the Privacy Policy and Terms | First school pilot |
| Ads and R49 purchase in the Terms and Privacy Policy | First ad goes live |
| Book Dash attribution and partnership terms | First Book Dash title published |
| Copyright rule for out-of-copyright classics (US, South Africa, Ireland/EU) | Classics (later) |

### 14.3 Data location
Personal data is stored in Ireland (§15). The Privacy Policy states this.

---

## 15. Hosting and infrastructure

### 15.1 Region: Ireland
- **Vercel:** set the function region to Dublin: `"regions": ["dub1"]` in `vercel.json`. Bookie currently has no server functions, so this only takes effect once functions are added (import jobs, payment webhooks, ad admin). Set it now anyway.
- **Supabase:** the database, auth and file storage live in the Supabase project's region, which is what actually determines where data is stored. Bookie's app config points at project `rnyatweedvzmeubqvjbo` — **note:** the Supabase project reachable from this environment via MCP is a different project (`sadrabvzausmzubfsilg`, "Signal Website and App", already in `eu-west-1`); confirm which project ID Bookie's production `.env` actually points at before assuming either one is "the" Bookie database (§18, Q5).
  - **Check its region.** If it is not `eu-west-1` (Ireland): as far as we know, a project's region can't be changed. Create a new project in `eu-west-1` and migrate the database, auth users and storage files.
  - **Do this before any school joins**, because migration gets harder with more users.
- Supabase Edge Functions that do heavy database work (import jobs) should run in `eu-west-1`.
- Static files are served by Vercel's worldwide network regardless of region.

### 15.2 Other infrastructure
- Catalogue book files and Immersion art in Supabase Storage, served with long cache lifetimes.
- Scheduled jobs (catalogue import checks, retention clean-up) via Supabase scheduled functions or Vercel Cron.
- Official domain: pending. All links, share cards and QR codes must use a configurable base URL so the move from `bookie-seven-pi.vercel.app` is a setting change.

### 15.3 Acceptance criteria
- [ ] `vercel.json` sets `regions` to `["dub1"]`.
- [ ] The Supabase project is confirmed in `eu-west-1`, or migrated there, before the school pilot.
- [ ] Changing the base URL updates every link, share card and QR code.

---

## 16. Non-functional requirements

### 16.1 Mobile-first
Designed for phones first, following the existing bottom-sheet and single-column pattern, with desktop as an enhancement.

### 16.2 Low-end devices and data
- Must work well on low-cost Android phones and slow connections.
- Size limit per Immersion region and per screen, agreed before design starts (§5.8).
- Images compressed and loaded as needed; Immersion regions loaded one at a time.

### 16.3 Accessibility
- Respect the phone's reduced-motion setting everywhere.
- Colours that work for colour-blind users; sufficient contrast in every theme.
- Text versions of the Immersion map and of every image that carries meaning.
- Large text and large tap targets available, especially for readers aged 66+.
- Screen reader labels in all three languages.

### 16.4 Reliability
- No reading lost: sessions are saved on the device first, then synced (§8).
- Editing a book log and leaving the screen to look something up must not lose the entry (a known competitor complaint, §19.2).
- Logging always shows which profile the reading is being logged for, and makes switching profile obvious (the most common competitor complaint, §19.2).
- Counts stay in sync between two parents logging for the same child.

### 16.5 Security
- Supabase row-level security on every new table, including school, class, catalogue, session, ad and purchase tables.
- Teachers can only read data for learners currently in their classes.
- Handover codes are single-use and expire.

### 16.6 What we measure
No targets are set yet. Track from launch so targets can be set from real data:
- Active readers per week, by age group and language.
- Reading sessions per reader per week, including re-reads.
- Share of child profiles with Immersion on; how many switch it off.
- Catalogue books opened and finished.
- Schools, classes and learners; share of school-created profiles claimed by parents.
- Ad-free purchases; ad impressions (adult areas only).

---

## 17. Build order

Each phase ends with something testable. Design (§5.8) runs in parallel from phase 1.

**Phase 0: Foundations**
1. Confirm or migrate the Supabase project to `eu-west-1`; set `vercel.json` to `dub1` (§15).
2. Move all text into translation files; set up English, Afrikaans and isiXhosa with English fallback (§9).
3. `reading_sessions` and re-read support (§6.2).
4. New age groups and migration; `immersion_enabled` replaces `is_child_mode` (§2.2, §5.2).
5. PWA: manifest, service worker, offline storage, offline session queue (§8).
6. Configurable base URL (§15.2).

**Phase 1: Redesign and Immersion pilot**
1. Standard view redesign (§5.9).
2. Immersion mode for Explorers, Adventurers and Navigators, **one companion per group**, and one month's region, for a pilot with a small group of children (§5).
3. Gentle mode, optional targets, challenges with off switch (§6).
4. Full book list from reader profile (§11.1).
5. Test with children and parents; adjust; then produce the remaining regions and companions.

**Phase 2: Reader and catalogue**
1. Catalogue tables, licence records, admin import tool, review and takedown (§7.4).
2. Reader with page memory and automatic sessions (§7.5).
3. Book downloads and offline reading (§8).
4. Book Dash titles published **only after the partnership is confirmed** (§7.1).

**Phase 3: Schools and home-schooling pilot**
1. Legal checks for schools completed (§14.2).
2. Schools, grades, classes, roles (§10.2).
3. School-created profiles and handover (§10.3).
4. Class codes, class progress, class reading mode, reports (§10.4–§10.5).
5. Home-schooling teacher role and exportable record (§10.6).
6. Context-carrying class links and branded club invites (§11.2).
7. Pilot with one or two Cape Town schools.

**Phase 4: Ads and ad-free purchase**
1. Landing page, Terms and Privacy Policy updated; users told (§12.6).
2. Ad slots in adult areas only; sponsor ad admin (§12.2–§12.4).
3. R49 purchase through a South African payment provider (§12.5).

**Throughout:** "Made by Signal UX" and the Boekie story (§13).

---

## 18. Open questions

| # | Question | Needed before | Owner |
|---|---|---|---|
| 1 | School structure: new `schools` entity (recommended) or a club of type `school`? | Phase 3 | Product + dev |
| 2 | How long before unclaimed school-created profiles are deleted? | Phase 3 | Legal |
| 3 | How do age groups move up without a date of birth? Options: ask parents once a year; store birth year only; school profiles use grade. | Phase 0 | Product |
| 4 | Suggested daily reading time per age group: which education source? | Phase 1 | Product |
| 5 | Which Supabase project is Bookie's actual production database (`rnyatweedvzmeubqvjbo` per app config, vs. `sadrabvzausmzubfsilg` "Signal Website and App" reachable via this environment's Supabase connection), and what region is it in? | Phase 0 | Dev |
| 6 | POPIA basis for schools creating profiles for minors | Phase 3 | Legal |
| 7 | Sign-in method for young learners on school profiles (picture password, class code + PIN, other)? | Phase 3 | Product + design |
| 8 | Book Dash's response and partnership terms | Phase 2 publishing | Janico |
| 9 | Ad frequency per screen, and which adult screens carry ads | Phase 4 | Product + design |
| 10 | Which entity receives R49 payments, and how it's invoiced | Phase 4 | Signal UX |
| 11 | Vector and animation formats, and size limit per region | Phase 1 design start | Design + dev |
| 12 | Official domain | Before school materials are printed | Signal UX |

---

## 19. Research summary

Research conducted 2026-09-20 and 2026-09-23. Directional, not a formal audit.

### 19.1 Competitors
- **Beanstack** (Zoobean, Inc., Arlington, Virginia; founded 2013). Reading-challenge platform used by libraries, schools and companies; readers use the free Beanstack Tracker app. Free for readers; institutions pay a subscription. Licensed by 10,000+ institutions, mostly in the US. Features: challenges with deadlines and targets, barcode scanning, reading timer or one-tap logging, streaks, badges, activities, reviews, recommendations, leaderboards, stats, family profiles, school sign-in. **Lesson:** libraries adopt because it's easy for librarians to run challenges and gives them participation numbers for their funders. Bookie can offer that for free. ([Beanstack gamification](https://www.beanstack.com/features/reading-challenges-gamification), [Beanstack blog](https://www.beanstack.com/blog/beanstacks-mobile-app))
- **Epic.** Licensed digital library of 40,000+ books, audiobooks and videos from publishers, plus its own titles. Paid family subscription; free for teachers during school hours only; limited free tier. Complaints: reading-level pigeonholing, access ending after school hours. **Lesson:** a large library costs money for every book; Bookie's free route is openly licensed books. ([Epic pricing](https://myelearningworld.com/epic-pricing/), [Epic review](https://www.educationalappstore.com/app/epic-kids-books-and-videos))
- **Biblionasium.** Kid-safe social reading log, free for teachers, US privacy framing, dated. ([Biblionasium](https://www.biblionasium.com/))
- **Sora (OverDrive Education).** Teacher assignments and dashboards; needs a paid digital collection. ([OverDrive teaching tools](https://resources.overdrive.com/k-12-schools/sora-features/teaching-tools/))
- **Accelerated Reader.** Quiz-based verification; criticised as anxiety-inducing. ([Alternatives to AR](https://www.stayingcoolinthelibrary.us/alternatives-to-accelerated-reader/))
- **1000 Books Before Kindergarten apps.** Re-reads counting is a headline feature.
- **StoryGraph, Bookly, Goodreads (adults).** Stats and streaks behind paywalls; social noise; data lost when moving between apps.
- **Open Library.** A catalogue, not a shop; links to outside sellers. Its lending of scanned in-copyright books was ruled not fair use (US appeal decided 2024, now final). Bookie uses it only for book details and ISBN lookup.

### 19.2 Pain points reported by users of competitors
- Reading logged to the wrong family profile (Beanstack).
- Entries lost when leaving the app mid-log; timer connection errors (Beanstack).
- Counts not syncing between two parents (1000 Books apps).
- Finished challenges that can't be removed (Beanstack).
- Stats behind paywalls; social feeds in the way of simple tracking (adult trackers).
- Reading level set by the app and not adjustable (Epic).

### 19.3 Reading motivation
- A study of 2nd and 3rd graders found that children with compulsory reading logs showed declines in interest in reading for fun compared with children whose logs were voluntary.
- Parents report children stopping mid-sentence when a timer ends, and choosing short books to raise counts.
- Counting minutes instead of books lets children abandon books they don't like and still get credit.

### 19.4 South African context
- Many homes have no books: in national reading research, 63% of homes had no fiction or nonfiction book, and 65% of homes with children under 10 had no picture book.
- 72% of parents who read with young children would prefer to read in an African language.
- Home languages (Census 2022): isiZulu 24.4%, isiXhosa 16.3%, Afrikaans 10.6%, Sepedi 10%, English 8.7%. South Africa has 12 official languages, including South African Sign Language since 2023.

### 19.5 Free book sources
- **Book Dash:** CC BY 4.0; source files per title and language on [bookdash.org](https://bookdash.org/book-source-files/); HTML versions on [bookdash.github.io](https://bookdash.github.io/bookdash-books/); GitHub EPUBs outdated (2019).
- **African Storybook:** openly licensed; check each title's licence.
- **Vula Bula** (now Halala! Education): CAPS-used graded readers in African languages; CC BY-NC-ND, so written agreement needed.
- **WCED ePortal:** free CAPS-aligned graded readers (DBE, Funda Wande, Vula Bula); licences vary per title. ([wcedeportal.co.za](https://wcedeportal.co.za))
- **Standard Ebooks:** CC0 classics; full feeds for patrons, sponsors or qualifying open-source projects. ([standardebooks.org/feeds](https://standardebooks.org/feeds))
- **Project Gutenberg:** US-focused terms; automated access blocked. ([Offline catalogs](https://www.gutenberg.org/ebooks/offline_catalogs))

### 19.6 Where Bookie can win
1. One reading identity across home, clubs and school.
2. Free to use at every level, including schools.
3. Built for South Africa: POPIA, local languages, local places, data costs, homes without books.
4. Free books in the reader's own language.
5. Trust and fun instead of quizzes and pressure.

---

## 20. Appendix: key file references
- Reader profile / "+N more": `src/components/ReaderProfileSheet.tsx:309-341`
- Full book list (self-scoped today): `src/pages/BooksPage.tsx`
- Club creation: `src/pages/ClubsPage.tsx:267-413`
- Club detail (tabs, groups, reports, roles, moderation): `src/pages/ClubDetailPage.tsx`
- Family invite and child claim flow: `src/pages/InvitePage.tsx` (`claim_child_member`, lines 123-134)
- Club invite flow: `src/pages/ClubInvitePage.tsx`
- Gamification: `src/lib/milestones.ts`, `src/components/MilestoneModal.tsx`, `src/components/ReaderProfileSheet.tsx:11-30`
- Sharing: `src/lib/shareCard.ts`, `src/components/ShareSheet.tsx`
- Landing page promises to change: `src/pages/LandingPage.tsx:67,286,312`
- Types, age groups, roles, `is_child_mode`, `gender`: `src/lib/types.ts`
- Settings (`is_child_mode` toggle): `src/pages/SettingsPage.tsx`
- DB schema: `supabase/schema.sql`, `clubs_schema.sql`, `clubs_schema_v2.sql`, `clubs_schema_patch.sql`, `topics_schema*.sql`, `moderation_schema.sql`
- Admin: `src/lib/admin.ts`, `src/pages/AdminDashboard.tsx`
- Privacy and Terms: `src/pages/PrivacyPage.tsx`, `src/pages/TermsPage.tsx`
- Auth and member model: `src/contexts/AuthContext.tsx`
- Vercel config: `vercel.json`
- Build config: `vite.config.ts`

---

## 21. Session log — v0.3 adoption (2026-09-23)

Recorded by Claude when v0.3 was written into this file, replacing v0.2, at the same time a broken in-progress commit from another AI coding tool ("Antigravity") was found on `main` and repaired. Kept here so the next session has the paper trail without digging through git log.

- **Confirmed with Janico directly** (not assumed): Signal UX branding/link in the footer is intentional (Janico owns Signal UX) — kept as-is. The softened ads wording ("Free to use · Always · Children never see ads") is intentional and now matches §12 exactly — v0.2's old "no ads, ever" constraint is superseded, not violated.
- **Found broken on `main` before this commit:** `src/pages/DashboardPage.tsx` had interleaved old/new JSX from an interrupted rewrite (duplicate `greeting` declaration, duplicate lucide-react import, orphaned closing tags) — `npm run build` failed. Rewritten cleanly in the same commit per §5.9 + §6.3/§6.5 (age-adaptive greeting, level badge, gentle-mode copy for Explorers/Adventurers/Navigators, no streak UI), still using the existing non-Immersion visual style — the map itself is Phase 1 (§17) and needs art assets first.
- **Found broken on `main`:** `src/app/routes.tsx` had two complete, duplicate route arrays (an old block never removed when the nav-restructure block was added). Deduplicated, keeping the newer block (`/explore`, `/join`, `/join/:code`).
- **Repo hygiene fixed:** `dist/` (build output) had been committed directly (commit `1813787`); added to `.gitignore` and untracked. `package-lock.json` was left as-is (it's the real lockfile in use — no `pnpm-lock.yaml` exists despite `pnpm-workspace.yaml` being present, worth a separate look but not blocking).
- **Not yet resolved — needs Janico's input, not an engineering guess:**
  - Open Q5 above: which Supabase project (`rnyatweedvzmeubqvjbo` vs `sadrabvzausmzubfsilg`) is actually Bookie's production database, and is it in `eu-west-1`.
  - The two DB migrations Janico ran manually just before this session aren't saved as files anywhere in `supabase/` — nothing to review for safety (e.g. whether the age-band split handled existing `10-15`/`16-21` rows non-destructively). Ask him for the SQL and save it as a proper migration file.
