# Spec: Course Invitations and roster CSV template download

**Status:** shipped  
**Triage:** done  
**Test seam (agreed):** Invitation module — create / list / revoke / redeem rules (and outcomes) behind thin server actions; same shape as CSV roster import. CSV template download is a fixed document helper, not a second seam.  
**ADR:** `docs/adr/0001-open-multi-use-course-invitations.md`

## Problem Statement

Instructors can already enroll Learners by CSV roster import and Learners can self-enroll on published Courses, but there is no shareable Course link for join-by-Invitation. The roster import UI shows an inline CSV example, but Instructors still lack a one-click downloadable template file they can fill in Excel/Sheets and re-upload. Insights and roster CSV export already exist; this slice does not rebuild analytics.

## Solution

Add open, multi-use **Invitation** links for PUBLISHED Courses (creator mints/revokes; redeemers get Enrollment, new Users choose a password) per the ADR, and upgrade the roster import surface with a downloadable `name,email` CSV **template**. Keep self-enroll and CSV import. Do not add Excel parsers, email-bound one-time invites, new Learning Record storage, or new Insights metrics in this delivery.

## User Stories

1. As an Instructor, I want to create an Invitation for my PUBLISHED Course, so that I can share one link with a class.
2. As an Instructor, I want to copy the Invitation URL easily, so that I can paste it into email or chat.
3. As an Instructor, I want optional expiry on an Invitation, so that stale links stop working without manual cleanup.
4. As an Instructor, I want to revoke an Invitation immediately, so that a leaked link stops enrolling people.
5. As an Instructor, I want multiple active Invitations on one Course, so that I can rotate links without instantly killing the previous URL.
6. As an Instructor, I want to see which Invitations are active, expired, or revoked, so that I know what is still shareable.
7. As an Instructor who does not own the Course, I want create/list/revoke to be denied, so that only the course owner manages join links (same gate as roster import).
8. As an Instructor, I want Invitation create to fail on non-PUBLISHED Courses, so that draft content is not joinable via link.
9. As a Learner with an Invitation link, I want to redeem it and become Enrolled, so that I can start learning without waiting for CSV import.
10. As a new person with an Invitation link, I want to register as a Learner with a password I choose, so that I can sign in again later without a temp-password sheet.
11. As an existing Learner already signed in, I want redeeming a valid Invitation to Enroll me in that Course, so that I join in one step.
12. As a Learner already Enrolled in the Course, I want redeeming again to succeed as a no-op, so that I am not blocked by “already enrolled” errors.
13. As a User with role INSTRUCTOR, I want redeem to be rejected, so that teachers do not create empty learner Enrollments (same rule as self-enroll).
14. As anyone holding an expired Invitation, I want redeem to fail clearly, so that I know to ask for a new link.
15. As anyone holding a revoked Invitation, I want redeem to fail clearly, so that revoked links cannot be reused.
16. As anyone holding an Invitation for a Course that is no longer PUBLISHED, I want redeem to fail, so that unpublished Courses stay closed.
17. As an Instructor, I want CSV roster import to keep working unchanged, so that named rosters with temporary passwords still work.
18. As an Instructor, I want to download a CSV template with `name` and `email` columns (and example rows), so that I can fill it in a spreadsheet and import without guessing the format.
19. As an Instructor, I want the template to match what the importer accepts, so that a filled template imports without header surprises.
20. As an Instructor, I want the existing inline format hint to stay coherent with the downloadable template, so that I am not shown two conflicting examples.
21. As a Learner, I want self-enroll on PUBLISHED Courses to keep working, so that Invitation is an extra path rather than a replacement.
22. As an Instructor, I want Insights and roster Report exports to remain available as they are today, so that analytics is not blocked on this work.
23. As an Admin viewing platform overview, I want this slice not to change Admin metrics requirements, so that Admin work stays separate.
24. As a product owner, I want no new Learning Record / xAPI / Mastery tables in this delivery, so that progress stays on existing Playthrough, Lesson Progress, and related writes.
25. As a product owner, I want no SSO or magic-link login redesign, so that Auth.js credentials remain the auth model.
26. As a product owner, I want no native `.xlsx` import, so that Instructors export CSV from Excel instead of us parsing workbooks.
27. As a developer, I want Invitation rules concentrated in one module behind thin server actions, so that redeem/create/revoke behaviour is testable without the browser.
28. As a developer, I want Invitation tokens to be unguessable, so that enumeration of join links is impractical.
29. As a developer, I want redeem of an already-enrolled User to be idempotent at the Enrollment uniqueness boundary, so that double-clicks and retries are safe.
30. As a security-conscious Instructor, I want revoke and expiry to be the only v1 caps on open multi-use links (no redemption counter), so that classroom sharing stays simple while leaks remain containable.
31. As a Learner completing Invitation signup, I want to land in a state where I can open the Course, so that join friction stays low after password creation.
32. As an Instructor on the roster page, I want Invitation management near enrollment tools, so that join paths live in one teaching surface.
33. As a translator / i18n maintainer, I want user-visible Invitation and template strings to go through the existing i18n layer, so that en/zh stay consistent with the rest of teach UI.
34. As a future agent implementing tickets, I want glossary terms (User, Learner, Course, Enrollment, Invitation, Insights, Report) used in the work, so that naming stays aligned with `GLOSSARY.md`.

## Implementation Decisions

- **v1 scope:** (1) downloadable roster CSV template on the existing students/import UI; (2) Invitation persistence + owner manage UI + public redeem/accept flow. No Insights metric changes, no Report entity, no auth redesign.
- **Respect ADR 0001:** open multi-use Course Invitations; safety via optional expiry + revoke; not email-bound; not use-capped; three join paths remain (self-enroll, CSV import, Invitation).
- **Schema:** add an Invitation model (or equivalent) scoped to a Course, with at least: opaque token, course id, created-by user id, created-at, optional expires-at, revoked-at (or equivalent revoked flag). Multiple rows per Course allowed. Do not store redemption counts in v1.
- **Ownership gate:** create / list / revoke require the same course-owner check as roster import today (`Course.createdById` matches the signed-in User). Do not invent a one-off ADMIN bypass for Invitations alone.
- **PUBLISHED gate:** create and redeem require Course `PUBLISHED`. Draft/archived Courses reject Invitation use.
- **Redeem rules:**
  - Valid token + PUBLISHED + not expired + not revoked → ensure Learner User (create if needed with caller-chosen password on accept) → create Enrollment; duplicate Enrollment is success.
  - Role `INSTRUCTOR` cannot redeem.
  - ADMIN is not specially blocked beyond existing self-enroll behaviour (role alone does not block ADMIN).
- **Password paths:** Invitation signup uses self-chosen password; CSV import keeps temporary passwords + one-time credentials download.
- **Server shape:** thin server actions (or equivalent server entrypoints) call a dedicated Invitation module — the agreed test seam — mirroring how roster import sits behind `importStudents` / import helper.
- **Token URL:** stable redeem route carrying the token; treat token like a secret (no logging of full tokens in normal paths).
- **CSV template:** produce a UTF-8 CSV (BOM acceptable if needed for Excel) with header `name,email` and a small set of example rows consistent with the importer; expose a download control on the roster import panel. Prefer one shared template string/helper over duplicating divergent examples.
- **UI placement:** Invitation mint/list/revoke on the teach Course students (roster) area; template download on the import panel. Redeem/accept is a learner-facing (or auth) page, not teach-only.
- **Analytics unchanged:** Insights, admin overview, and roster CSV export remain as-is; no new Mastery persistence.
- **Glossary / ADR:** use existing terms; ADR 0001 is normative for Invitation shape.

## Testing Decisions

- Good tests assert external behaviour of the Invitation module (who can create/revoke, when redeem succeeds or fails, idempotent Enrollment, Instructor reject, expiry/revoke/unpublished rejects, new User created as Learner with provided password hash path mocked as appropriate) — not React markup, Prisma client call order, or exact URL path strings unless those are part of the module’s returned contract.
- **Primary seam under test:** Invitation module API used by server actions.
- **Template:** optional tiny assertion that the shared template document includes the required header columns; do not add a second architectural seam.
- **Prior art:** `student-import` / `csv` unit tests; server modules that mock Prisma (e.g. activity-store tests); ownership checks patterned like students/editor access tests.
- Prefer not to require full browser E2E for v1 acceptance if the module + a thin action wiring cover the rules; add UI tests only where the repo already has similar teach-panel prior art and they stay stable.

## Out of Scope

- Native Excel (`.xlsx`) import/export
- Email-bound or single-use-per-email Invitations
- Redemption max-use counters
- Replacing self-enroll or CSV import
- Changing Insights metrics, Admin overview, or inventing a Report aggregate
- Learning Record / xAPI / LRS / stored Mastery
- SSO, OAuth, magic-link login, or fine-grained per-course RBAC
- Class / cohort / section enrollment units
- ADMIN bypass of course ownership for roster or Invitations (unless a separate change updates both together)
- Reworking temporary-password CSV import semantics

## Further Notes

- Design locked via grilling (2026-11-04): Course-only Enrollment; single User identity; global Role + creator ownership; no Learning Record table; Instructor/ADMIN analytics audience; CSV not xlsx + downloadable template; Invitation yes; self-enroll stays; Report = export; Insights = dashboard; multi-use open invites; expiry+revoke; no use cap; invite signup chooses password; PUBLISHED only; v1 = template + Invitation; idempotent redeem; Instructors cannot redeem; creator-only mint/revoke; many tokens per Course; credentials auth unchanged; ADR written.
- Roster import already shows an inline template in a `<details>` block; this spec upgrades that to a real file download while keeping format aligned.
- Keep this work under `.scratch/course-invitations/` until deliberately published to GitHub Issues with `ready-for-agent`. Tickets: `.scratch/course-invitations/issues/` (`01`–`04`). Frontier: `01` and `02` (then `03` and `04` after `02`).
