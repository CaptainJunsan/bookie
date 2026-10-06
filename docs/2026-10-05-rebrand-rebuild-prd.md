# Bookie PRD: Rebrand and Rebuild

Oct 5, 2026 · @Janico Steyn

*Saved here verbatim as the source document reconciled against PRD.md §23 (2026-10-06). This file is reference material, not a living document — further edits belong in PRD.md, not here.*

## Overview and scope

This PRD consolidates the features, journeys, rules and restrictions for the Bookie rebrand and rebuild. The build is neither greenfield nor fully brownfield: the existing database structure is kept wherever possible, and existing features stay unchanged unless this document affects or replaces them. Where a section says Existing, nothing changes; New marks an addition or replacement.

Stack: Vite.js front end, deployed from GitHub to Vercel, with a Supabase backend. Resend is not yet integrated and becomes the only sender of outgoing email, including auth and 2FA emails. The build is mobile-first, with a bottom navigation. "Bookie" is the working name until the rebrand lands.

| Term | Meaning |
| --- | --- |
| Minor / child / kid | Anyone under 18 (South Africa) |
| Family owner | The user who created the family at sign-up; one per family |
| Co-owner | An adult managing the family at the same level as the owner, typically a mom and dad |
| SAO | School account owner |
| DH | Department head, manager of a school group |
| Super admin | The single platform administrator |
| Collaborator | A person the super admin invites to contribute content, with a role |

Out of scope here: brand changes and style rules (colour, typography) and the initial Figma designs via MCP, which are handled separately.

## Roles and permissions

Every permission comes from a role, never from a relationship label. Users pick a label such as mom, dad, guardian, son, daughter, uncle, aunt, grandma or grandpa, but the label is cosmetic and does not grant rights.

| Context | Role | What it can do |
| --- | --- | --- |
| Family | Owner | One per family, the person who created it. Manages everything, invites adults, creates child accounts, hands accounts over, can transfer ownership |
| Family | Co-owner | Manages the family at the owner's level (typically mom and dad). First in line to take over ownership |
| Family | Parent / guardian | Edits book statuses for themselves and for the children in the family; sees all of a child's activity, including in school and club context |
| Family | Adult member | Manages their own profile and library. Edits a child's book statuses only with permission granted by the owner |
| Family | Child | Reads and logs under parent management until a parent hands the account over |
| School | SAO | Configures groups, assigns department heads, creates sub-groups. Always an adult |
| School | DH or group manager | Manages the group (at any level) they are assigned to. Always an adult |
| Club | Owner | Any user can create a club. Configures chats, replies, threads, age limits and challenges |
| Library | Owner | Official libraries are created by the super admin and handed to a designated owner profile |
| Platform | Super admin | One person. Creates schools and libraries, runs default moderation, invites collaborators |
| Platform | Collaborator | Content roles such as blog writer and fact-finder. A Moderator role is limited to the report queue |

School groups can nest to any depth, and an owner or manager can be assigned at every level, so teachers and other roles are created dynamically rather than hard-coded. Parents of enrolled children can see the school's structure and each level's owners, with username, role and age range.

To verify: whether the family owner can grant other adults permission to change family settings and to manage junior users, beyond the book-status permission above.

## Accounts, families and onboarding

Existing and unchanged: a user signs up and immediately creates a family, starting with their own profile. They can invite adults and self-standing accounts, whether those people already have accounts or are new, and create child accounts that they manage. Family libraries are private and visible only to family members.

New in this build:

- **Onboarding:** sign-up now includes creating a reading profile (see Reading profile and recommendations).
- **Join links:** an owner can send a link to join the family. After onboarding, the new member is redirected to their own profile in the family context. A new invitee creates an account but not a family, and the family they were invited to becomes their primary family.
- **Multiple families:** a user can belong to more than one family (a grandparent in their children's family, for example) through a membership record with its own role and permissions. Reading progress belongs to the person, not the family, and the family library is a shared catalogue. The Family tab gets a family switcher; Home and Dashboard stay personal. Each membership has a setting for what that family sees of the member, except that a child's home family always sees everything.
- **Cross-family groups:** cousins or brothers' families use a private, invite-only family club, exempt from the age-group rule because parents vet the members. There is no family-to-family linking in v1.
- **Primary family:** the first family a user belongs to, whether they created it or were invited as a new user. Later invitations make secondary families. Store `is_primary` on the membership row, with a unique partial index so a user has at most one.

Ownership:

- One owner per family. Ownership can transfer to a co-owner or another adult who accepts.
- If an owner deletes their account, they are warned that linked minor accounts will be deleted unless ownership transfers to an eligible adult. If nobody is available, deletion is the only option. They can download profile backups first.
- Permanent deletion follows a grace period of 30 to 90 days. After deletion, a school keeps only anonymised aggregates of a child's data.

## Child accounts

A child account is always created by an adult, and a parent or guardian must keep access for as long as the minor is active. A child account is in one of three states, and parents always see everything about their child, including activity in school and club context.

| State | Who manages | Notes |
| --- | --- | --- |
| Parent-managed (classic) | Parent | Default. Parent edits the child's reading, books and settings |
| Handed to the child | Child | A parent decision, never automatic before 18. Parent keeps read access while the child is a minor |
| Handed to the school | Child, with a school login | School creates a login using school username, password and student ID. Parent can still see all of it |

A parent who does not actively use Bookie still receives weekly or monthly emails, also pushed in-app, with the child's activity and social engagement statistics. Notification frequency is configurable in-app.

At 18 the account converts automatically. Parent and child are notified 30 days before. Parent management ends on the birthday. If the account has no login of its own, it pauses until the new adult claims it with their own email within a fixed window. The new adult can then invite the parent as a regular family member and choose what they see.

Minors can have friend connections, which must be approved by a parent and are limited to the same age band.

## Reading profile and recommendations

New: every user completes a reading profile during onboarding, listing likes and dislikes across titles, authors, genres and classifications. Parents complete it for children whose profiles they manage, and anyone can edit it at any time as their taste changes.

The profile has two purposes, and the privacy notice must state both:

- **Social flair:** family members can see what the user is into now, which helps with birthday gifts. When sharing their profile, a user chooses whether to show their likes and dislikes. It also builds engagement, since people value what they have shaped themselves.
- **Recommendations:** when a family owner creates a child account, the app recommends popular and interesting reads for that child's age range and reading profile. A baby's account gets baby-relevant, read-to-me books.

Age-appropriate recommendation lists need curated data, which collaborators with a fact-finder or content role can supply (see Super admin, collaborators and content).

## Library, books and statuses

Users add books to the family library and give each a status: Reading, Finished or Want to Read (the wish-list). Want to Read is the default for every new book until the user changes it. Parents change statuses for themselves and their children. Other adults change a child's statuses only with permission from the family owner.

**Segregated libraries.** The family library is private to its members. Clubs and schools each have their own library, and a child sees the family library plus those libraries, kept separate. A child can add a book from any external library to their own reading library, and progress and read counts carry over.

**What clubs and schools see.** A club owner sees a reader's progress only on books from the club's own library that the reader accepted, either by accepting a challenge or by choosing the book to read with the club. A school sees a child's progress only on the books it is handling. If a club or school requires a book the reader already has, existing progress is pulled through, unless the owner sets a rule to ignore existing progress. The acceptance prompt must say that existing progress and read counts will be shared with that club or school.

**Re-reads.** Re-reading counts as an additional book read, unless a club, school or challenge owner specifies that it does not. Each read is stored as its own row in a reads table (one book, many reads), not as a column. Challenges can also be set to ignore previous reads, forcing participants to read the book again.

**Read-alouds.** A read-aloud is a per-session tag, not tied to a baby or toddler phase. It records "this book was read to me" and is not an "I've read it" metric. It counts towards the day marker and minutes. It does not count towards books read, and challenge owners can opt it in.

**Custom entries.** If a user cannot find a book with the camera ISBN scan or image search, they can create it manually. The entry is stored as a Bookie user-created entry and offered, with similar duplicates, in future searches. Schools and clubs can reference it as "{{book title}}, created by {{username}} from the Bookie Library". The creator's username is shown only for adult creators, and minors' entries show "Bookie community". When a user-created entry later matches a real ISBN, entries merge without losing anyone's progress.

**Bulk import.** Upload a spreadsheet or CSV (title, author, page count, ISBN and so on) to add many books to a library or reading list at once. This is especially useful for clubs and schools.

## Home, dashboard and daily tracking

Home is the default landing page and shows progress for each day of the active month, with a link to the dashboard. The dashboard is a stats page only.

**Home.** Each day has a bookmark-shaped SVG marker, empty by default. It becomes filled with a gold shine once the user has read that day. A day is marked in one of two ways:

- **Checkbox:** ticking "I've done my reading today" prompts for how long the user read. Quick options are 5 min, 10 min, 15 min, 30 min and 1 hour, plus a manual iOS-style spinning time picker. Every read day therefore has a logged duration.
- **Timer:** stopping or pausing the timer marks the day.

Timing features:

1. Standard timer: press play to start, pause, and stop to end.
2. Resume: the user sets the actual start time and presses play. The timer updates to the current time difference and continues.
3. Log time read: set a start and end time for a read, for today or for past days.

The start timestamp is stored on the server, so an entry survives a closed tab or a switched device, and the running timer stays visible to the user. A session that spans days belongs to the day it started. The "day" follows the user's own timezone. A "still reading?" prompt or session cap stops a forgotten timer from logging many hours. Book updates made that day (pages, progress) are logged against that day.

**Month in review.** At the end of each month the user, and parents for a child, get a report with books started, books finished, progress, total pages read and total time spent reading.

**Dashboard.**

- Reader view: books read, total pages read, favorite author and genre, and other fun stats. The most prominent widget is "Current read/s", showing progress in each book being read. "Active challenges" appears once the user has joined any challenge.
- Parent view: a family dashboard with top readers and other family-wide statistics, plus the challenges their children are exposed to and take part in.

**Fun facts and encouragement.** A fun fact appears at each login. Encouragement is a dismissible card on the home page. Both celebrate wins and are styled per age group.

**Style.** Home pages are decorated per age group, with hand-crafted characters, graphics and SVG day markers in empty and filled states. The gold shine must not be the only signal that a day is complete, it must respect reduced-motion settings, and the time picker must be accessible.

## Clubs and bookstores

Existing: users can explore and join book clubs. A club can be purely recreational and social (anyone can create one) or formal and educational, such as a tutor-led club. The club owner configures settings for chats, replies, threads and similar. Default moderation across all clubs and social interactions is managed by the super admin.

New rules:

- **Age-gating is mandatory.** If a club sets no age limit, minors cannot join. If a club creates age groups, the groups cannot communicate or interact with each other.
- **No adult access to unrelated minors.** An adult never engages with or sees a minor outside their direct family network, except in a school club with consent marked. Adult owners and moderators have no private messages with minors, only group chat.
- **Parent reporting.** Every social interaction a minor has is summarised to their parents weekly or monthly.
- **Club library and visibility.** Each club has its own library. The owner sees a member's progress only for books from that library that the member accepted.
- **Club challenges.** These are closed to members. The owner can make a challenge publicly visible, so non-members can see it but must join the club to take part.
- **Family clubs.** A private, invite-only club can serve an extended family. It is exempt from the age-group rule because parents vet the members.

**Bookstores.** A bookstore is created by a normal user, like a club, and appears under Clubs in the navigation alongside clubs. Bookstores host open challenges to bring readers through their doors. A bookstore must carry a verified badge granted by the super admin, so no one can pose as a real store. Official public libraries are a separate account type, covered under Schools and official libraries.

## Schools and official libraries

Existing: the super admin creates a school after an in-person interview and configuration, or a school applies for an account and the super admin reviews it and creates it. Schools run a structured, progression-focused system with multi-tiered, nested groups that fit different school structures.

**Structure.** The school account owner (SAO) configures top-level groups, for example a Junior or Foundation phase (Grades 1 to 3) and a Senior phase (Grades 4 to 7). The SAO assigns a department head (DH) to manage each group, or manages it personally, with no hard limit on the number of DHs. The SAO or a DH creates sub-groups by grade, class and reading aptitude, and aptitude groups can also be scoped to a grade or class. An owner or manager can be assigned at any level, and every group in a school must always have an adult as owner.

[embedded content: school structure · SAO, DHs, sub-groups, tags]

The SAO sits at the top and assigns a DH to each top-level group. Sub-groups below can have their own adult owners, and tags cut across all groups.

**Groups and tags.** Groups define membership. A student can belong to several at once: a class, an in-class group and a public reading club of the school. Tags are flat labels for categorising readers, used for management and research, for example "special needs" or "excellent reader". Group and tag names and screens must make this difference obvious, and each tag is defined by its purpose. Who can see which tags is still to be defined (see Open items and next steps).

**Parents and enrolment.** Parents of enrolled children see the school's information page, with its structure and each level's owners and managers (username, role and age range). Parents who already use Bookie can find a school under Explore and apply to join. A school can also invite children to reading classes and groups through their parents' email addresses. Schools can create accounts for children whose families are not yet on Bookie (see School-created child accounts and consent).

**School library.** Schools have their own library, can bulk-import books by CSV, and see a child's progress only on books they are handling.

**Official libraries.** Official public libraries sit at the same level as schools, outside the clubs scope. The super admin creates each one, with a designated owner profile shared with the person who will manage that location. Libraries are found under Explore alongside schools, and can host open challenges.

**Onboarding waiver.** Schools and open clubs must accept a mandatory "accept to proceed" waiver when they join, showing the full data journey so they can make an informed choice.

## School-created child accounts and consent

A school can create an account for a child whose family does not yet use Bookie, but only with the parent's consent, collected by an emailed link sent through Resend. The flow must be POPIA compliant.

1. The school enters the child and the parent's email from its enrolment records. The system creates a minimal pending record and emails the parent a consent link.
2. The link is signed, single-use and expiring. The parent sees the data journey (what is collected, where it goes, including servers outside South Africa) and ticks a declaration that they are the child's parent or legal guardian.
3. Consent is logged with the wording version, timestamp and IP, and can be revoked later.
4. On consent, the parent gets an account by default and can log in and monitor the child's profile. If the email matches an existing Bookie account, the child links to that account.
5. If the parent does not respond, the pending record is deleted automatically after a set number of days.
6. Every consent email also carries a "this isn't me / not my child" link, which cancels the request and flags it to the school.

[embedded content: consent flow · 3 outcomes]

Only consent activates the account. The other two outcomes end the request.

After consent the parent chooses between classic parent management, handing the account to the child, or handing it to the school. School handover means a school login for the child, using the school username, password and student ID.

The chain of trust is the school's: its mandatory waiver at sign-up has the school warrant that parent emails are guardian contacts from its records, and the parent's declaration and consent log complete it. No ID documents are collected. Set up SPF, DKIM and DMARC on the sending domain before launch, because consent emails landing in spam would stall school onboarding. Whether these steps count as reasonable under POPIA needs review by a POPIA specialist before launch.

## Challenges and badges

There are four challenge types, and several can be live at once for the same reader.

| Type | Set by | Who can take part |
| --- | --- | --- |
| Self-set | The reader, or parents for one child, all children or the whole family | The reader or family |
| Open | Anyone, including bookstores and libraries, found on Explore | Anyone, subject to parent controls for minors |
| Club | The club owner | Club members only. The owner can make it publicly visible, but non-members must join the club to take part |
| School | SAO, DH or any group manager | The whole school, any nested group, or other targeting |

Challenges carry optional fields such as a description and rewards for completing or winning (1st, 2nd and 3rd place). The creator also sets the rules:

- Whether re-reads count, and whether previous reads are ignored so participants must read the book again.
- Whether existing progress on a required book is pulled through or ignored.
- How results are decided: the creator reviews data in the challenge dashboard, or sets automated detection based on measurable values such as pages read or books finished. Ties and the deciding metric are the creator's choice.

Readers see "Active challenges" on their dashboard once they join any challenge. Parents see the challenges their children are exposed to and take part in, and control visibility and membership.

**Minors on challenges.** A minor appears on any leaderboard only as a nickname or avatar. The child earns a badge to show on their profile, possibly in a trophy case page. Prize contact for a minor winner always goes to the parent.

**Badges.** In v1 an owner picks from a grid of badge designs created for Bookie, and can add their own award title and subtext. Custom text has a length limit and runs through the super admin profanity filter when saved. Parents can hide any badge. The badge text is copied onto the child's record, so it survives if the challenge or its owner is deleted.

## Child safety, privacy and POPIA

The rule behind everything here: an adult always has to vouch for a child, and an adult never sees or engages with a minor outside their direct family network, except in a school club with consent marked.

**Enforcement by structure.** Minor environments (school groups and age-banded clubs) are invite-only, so an adult account can never self-join one. Adults enter only as vetted staff added by the school owner. Age gating relies on self-declared birthdates, so a child who registers as an adult on their own email is a residual risk, and reporting tools are the mitigation. Every school group has an adult owner, and no minor ever holds a management role over other children's data.

**Data visibility.**

- Family libraries are private to family members.
- A club owner sees only progress on books from the club's library that the reader accepted.
- A school sees only progress on the books it handles.
- A child sees the family library plus club and school libraries, kept separate.
- Parents see everything about their child, including in school context.
- Minors appear to non-family adults only as a nickname or avatar.

**Consent and notice.** School-created accounts follow the consent flow above. Schools and open clubs accept a mandatory waiver that lays out the data journey in full. The data map must list every system that touches personal data, including Supabase, Vercel, Resend, the ad network and the payment provider, and say that some of these servers are outside South Africa.

**Deletion and retention.** A parent deleting their account follows the transfer and grace-period rules under Accounts, families and onboarding. After deletion, schools keep anonymised aggregates only. Users can download profile backups before deleting.

**Reporting.** Parents receive weekly or monthly reports of their child's activity and social engagement. All users get a report button, backed by the super admin's moderation queue.

The reading profile has two stated purposes (social display and recommendations), and the privacy notice must name both. This section and the consent flow need review by a POPIA specialist before launch.

## Ads and subscriptions

Bookie earns revenue from ads shown to adults, and adults can pay to remove them.

| Plan | Price | Covers |
| --- | --- | --- |
| Ad-free, individual | R50 per month | One adult user |
| Ad-free, family | R150 per month | Up to 4 adults whose primary family it is |
| Extra adult | R35 per month each | Each adult beyond 4, offered when inviting them |

**Ad safety rules.** These are an internal safety rule and are not marketed to the public.

- Ads never appear for minors, on child profiles, or on any screen a child would see or use if they had access to their own account, on their own device or a parent's. The ad code does not load in those contexts.
- Ads are gated by who is logged in and by screen context.
- All ads are filtered by category (for example gambling, alcohol and dating), so a child who glances at a parent's screen sees nothing inappropriate.
- Spaces owned by schools and official libraries are fully ad-free.
- Ads are contextual or non-personalised. Reading profiles and family data are never used for targeting. Ad partners go in the data map, and the chosen network's policy for mixed-audience properties must be checked.

**Who sees ads.** Ad-free status is per user and comes from the user's own subscription or from their primary family's plan. If your primary family is ad-free, you are ad-free everywhere. A secondary family's subscription does not apply to you, and your joining it does not affect its billing, membership or adult limit. A grandparent with their own unpaid primary family who joins their children's ad-free family still sees ads.

**Inviting adults.** When a new adult is invited, the system checks the plan limit and offers the +R35 add-on only if this would be the adult's primary family, their own primary family is not already ad-free, and they have no subscription of their own. Adults who join as secondary members do not count towards the 4-adult limit.

A payment provider still needs to be chosen. It will send webhooks to Supabase to keep each user's ad-free status current.

## Email, notifications and scheduled jobs

Resend is the only sender of outgoing email, including user auth and 2FA emails. It can also act as the SMTP for Supabase auth emails. Authenticator-app 2FA is not email, so Resend covers only email codes. Set up SPF, DKIM and DMARC on the sending domain before launch.

| Email | Trigger | Recipient |
| --- | --- | --- |
| Consent request | School creates a child account | Parent |
| Family invite | Owner sends a join link or invite | Invited adult |
| Auth and 2FA | Sign-in and security events | The user |
| Parent report | Weekly or monthly, configurable | Parent of each minor |
| Month in review | End of each month | The reader, and parents for a child |

These reports are also pushed in-app, and parents configure notifications in-app. A non-participating parent still receives the reports.

Scheduling is kept minimal: one weekly job and one monthly job (Supabase pg_cron or Vercel Cron) that queue the emails, rather than one job per user. Month boundaries follow each user's timezone. Check Resend's plan limits against projected volume, since every parent gets weekly reports and every user a monthly one.

## Super admin, collaborators and content

There is exactly one super admin. They create schools and official libraries (after an in-person interview or an application review), grant verified badges to bookstores, manage default moderation across all clubs and social interactions, and own the profanity filter used on badge text and other moderated content.

The super admin can invite collaborators with roles, such as blog writer or fact-finder, to produce content for designated places in the app. A Moderator role is limited to the report queue.

Because one account carries so much on a children's platform:

- The super admin account requires a passkey or 2FA.
- A named emergency successor exists for safety reports and account recovery.
- Collaborators get access only to what their role needs, and no access to user data.

**Content workflow.** Collaborator content never goes live directly. It moves from draft to super admin approval, and every item is tagged with an age band and a placement (login fun fact, encouragement card, blog post or recommendation list). Fun facts need a curated library per age band, since one appears at every login. All user reports land in the moderation queue.

## Navigation and sitemap

The bottom navigation is mobile-first and not yet final. The sitemap will be tested and refined as the app is built. What is decided so far:

| Surface | Contents |
| --- | --- |
| Home | Default landing page: the month's bookmark progress map, the timer and checkbox flows, a dismissible encouragement card, a link to the dashboard |
| Dashboard | Stats only: reading overview, "Current read/s", "Active challenges", and for parents the family dashboard |
| Clubs | Clubs and bookstores |
| Explore | Schools, official public libraries and open challenges. Parents find a school here and apply to join |
| Family | Family members and the family switcher for users in more than one family |

The name "Home" refers only to the monthly progress page, and "Dashboard" only to the stats page, so the two never overlap in the UI or in this document.

## Technical notes for the build

The database structure is kept wherever possible. The changes below are expected, but they are unconfirmed until checked against Bookie's actual schema, which has not yet been reviewed. The Supabase project connected to the planning session holds the Signal UX Business OS, not Bookie.

| Area | Expected change |
| --- | --- |
| Families | Many-to-many membership table (user, family, role, permissions, `is_primary` with a unique partial index) if a user currently has a single family |
| Reads | One row per read of a book by a user, replacing a single status per user-book where that exists |
| Reading sessions | Server-side start timestamp, end, owning day (the start day) and user timezone; session cap |
| Read-alouds | A per-session flag, kept out of books-read counts |
| Custom books | Creator, creator visibility rule (adults only), and a merge path to a real ISBN entry |
| Libraries | Family, club and school libraries kept separate, with accepted-book progress sharing |
| Groups and tags | Nested groups (ltree or a closure table) separate from flat tags |
| Consent | Consent log: wording version, timestamp, IP, revocation, pending records with expiry |
| Challenges and badges | Per-challenge rules, results, badge records with copied text |
| Ads | Per-user ad-free status derived from subscription or primary family plan |

Other technical decisions:

- **Access rules:** design the visibility matrix (parent, child, school, club, challenge) before the screens. This is the hardest part of Supabase row-level security, and group nesting affects performance.
- **Barcode scanning:** the browser BarcodeDetector API is not available in iOS Safari as far as I know, so plan on a JS scanner library such as ZXing.
- **Consent links:** signed, single-use, expiring tokens, issued and checked server-side.
- **Email and jobs:** Resend for all email, one weekly and one monthly scheduled job (see Email, notifications and scheduled jobs).
- **Payments:** a provider is still to be chosen, with webhooks into Supabase.

## Open items and next steps

The feature set is settled. The items below still need a decision or an input before or during the build.

**Before the build**

- [ ] Brand changes and style rules (colour, typography), then the initial Figma designs via MCP
- [ ] Review Bookie's actual Supabase schema against the Technical notes (needs the project connected or a schema-only dump)
- [ ] POPIA specialist review of the consent flow, the data map and the privacy notice
- [ ] Choose the ad network (check its mixed-audience policy) and the payment provider

**Decisions still open**

- [ ] Can the family owner delegate permission to change family settings and manage junior users to other adults?
- [ ] How is an adult designated as "parent or guardian" for the status-editing permission?
- [ ] When someone leaves their primary family, do they create a new one or promote a secondary family? Can a grown child make a new household family their primary once?
- [ ] At 18: confirm automatic conversion, and set the length of the claim window
- [ ] Can a parent reclaim a school-handed account, and what happens when a child leaves the school?
- [ ] Who can see tags such as "special needs", which may be sensitive data?
- [ ] How are duplicate parent accounts handled when a school-created account's parent email matches an existing user?
- [ ] How many age bands, and are they derived from date of birth and shifted automatically as a child grows?
- [ ] Where do age-appropriate and read-aloud recommendation lists come from (curation by collaborators)?
- [ ] Final bottom navigation slots, and whether navigation varies by role (parent, SAO, DH)
- [ ] Timer session cap length, pending-consent expiry days, and the exact deletion grace period (30 to 90 days)
