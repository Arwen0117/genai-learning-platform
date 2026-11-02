# Game Activity Retrospective TODOs

These are follow-up tasks identified by comparing the agreed Game Activity design with the current implementation. They are ordered so foundational model changes precede dependent UI, persistence, media, and environment work.

Status values:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete

## Current progress

Thirteen of fourteen follow-up tasks are complete. Task 12 still needs a human
to enable the GitHub required status check; run
`.scratch/game-activity/require-verify-check.sh` to finish that step.

## Implementation backlog

### 1. Replace independent game blocks with one Game Activity

- **Status:** [x]
- **Blocked by:** None
- **Finding:** The agreed model is one Game Activity containing an ordered sequence of Challenges, but the current implementation represents the activity as five independent Game Activity blocks.
- **Work:**
  - Define an explicit Game Activity container and ordered Challenge model.
  - Keep Sort, Match, and Choose as Challenge formats within the container.
  - Add activity-level progress, completion, replay, and authoring boundaries.
  - Update learner rendering and lesson composition to use the container.
- **Done when:** A learner sees one Game Activity with ordered Challenge progress, and the editor/generator operate on that same model.
- **Progress:** Container schema, learner boundary, ordered access, editor, and
  generation are in place. Legacy standalone `game` blocks migrate into the
  container on save, are stripped from lesson `blocks` when a container exists,
  and can no longer be added from the block picker. Validation requires the
  explicit container shape.

### 2. Separate attempted, correct, and completed states
- **Status:** [x]
- **Blocked by:** 1
- **Finding:** Current grading requires a Challenge to be solved correctly before it completes, which conflicts with the agreed rule that learners continue after mistakes and completion follows attempted Challenges.
- **Work:**
  - Record whether a Challenge was attempted.
  - Record first-pass correctness separately from later retries.
  - Reveal Correction after an incorrect response.
  - Advance to the next Challenge after incorrect submission.
  - Complete the Game Activity after all Challenges are attempted.
- **Done when:** An incorrect first response is recorded, explained, and does not block activity completion.
- **Progress:** Server grading records `attempted` / `passed` / `firstPass` /
  `completed` separately, reveals Correction, and completes after an incorrect
  substantive response. Sort, Match, and Choose now auto-complete the Challenge
  after the first attempt so ordered activity progression continues without a
  manual “Mark as complete” click.

### 3. Unify all generation paths around the Game Activity contract

- **Status:** [x]
- **Blocked by:** 1 and 2
- **Finding:** Full course generation still emits the older Match/Sort block contract, while direct Game Activity generation supports Choose, feedback, Hints, and media metadata.
- **Work:**
  - Update the course-generation prompt to produce the Game Activity container.
  - Reuse the same schema and validation for direct and course generation.
  - Require lesson-grounded content, deterministic answer keys, feedback, Hints, and locale validation.
  - Preserve visible failure for invalid or ambiguous output.
- **Done when:** Every generation entry point creates the same validated Game Activity shape.
- **Progress:** The direct Game Activity generator now uses the explicit
  container schema and prompt contract. Full course generation now carries the
  validated container in generated lesson results, and learner-facing course
  generation now uses the same container contract and persists it separately.
  Shared semantic validation covers challenge variants, feedback, Hints,
  accessibility, media, ambiguity, and locale before persistence.

### 4. Add activity-level editor authoring

- **Status:** [x]
- **Blocked by:** 1 and 2
- **Finding:** The editor is still block-oriented and does not expose a first-class Game Activity with ordered Challenges and activity-level settings.
- **Work:**
  - Add activity-level authoring and Challenge ordering.
  - Allow editing of prompts, options, answer metadata, feedback, Corrections, Hints, and Challenge count.
  - Surface validation errors at the activity and Challenge level.
  - Preserve instructor review before publication.
- **Done when:** An instructor can fully review and edit a generated Game Activity without manipulating five unrelated game blocks.
- **Progress:** The editor loads, validates, preserves, and saves the Game
  Activity container, and published-content checks count it as lesson content.
  The activity panel edits the activity title, selects Challenges for the
  existing Challenge forms, and supports Challenge ordering, duplication, and
  deletion with visible activity-level validation errors.

### 5. Remove learner-facing numeric game scores
- **Status:** [x]
- **Blocked by:** 2
- **Finding:** The agreed design defers numeric scores, but shared activity history renders percentages and raw/max scores.
- **Work:**
  - Keep correctness data available for server validation and aggregate analytics.
  - Hide numeric score, percentage, and raw/max score from learner-facing Game Activity history.
  - Show progress, completion, Correction, Hint state, and qualitative feedback instead.
- **Done when:** Learners never see numeric scoring for Game Activities.
- **Progress:** Numeric scores stay hidden from Game Activity history. History
  presents qualitative Correction, Hint, and Playthrough response details, and
  the learner Game Activity header shows ordered Challenge progress.

### 6. Establish explicit published content versions

- **Status:** [x]
- **Blocked by:** 1 and 4
- **Finding:** Current persistence derives a short block hash and stores a snapshot, but there is no explicit Game Activity publication/version lifecycle.
- **Work:**
  - Create a stable published Game Activity version identity.
  - Associate each Playthrough and Challenge attempt with the played version.
  - Create a new version when an instructor edits a published activity.
  - Keep historical results immutable and tied to their original version.
- **Done when:** Editing an activity cannot change the interpretation of historical Playthroughs.
- **Progress:** `GameActivityVersion` stores immutable published snapshots and
  content hashes. Publishing creates a new version when the activity hash
  changes. Playthroughs bind to `publishedVersionId` / `contentHash`, and
  recovery filters by the live published version hash.

### 7. Make Playthrough persistence first-class

- **Status:** [x]
- **Blocked by:** 1, 2, and 6
- **Finding:** Recovery is reconstructed from block-level attempts and a client-provided playthrough ID.
- **Work:**
  - Persist a first-class Playthrough record.
  - Persist Challenge attempts under the Playthrough.
  - Treat client IDs as correlation values, not authoritative identity.
  - Support refresh recovery, Replay, first-pass results, retries, Hint use, timestamps, and completion.
- **Done when:** The server can recover and report a Playthrough without inferring the activity state from loosely related block attempts.
- **Progress:** Server-owned Playthrough records group Challenge attempts,
  track completion, bind to published versions, and drive refresh recovery.
  Client playthrough IDs remain correlation metadata only.

### 8. Complete the model-generated Supporting media lifecycle

- **Status:** [x]
- **Blocked by:** 3 and 4
- **Finding:** The schema accepts model-generated media metadata, but there is no complete generation, moderation, storage, review, and approval lifecycle.
- **Work:**
  - Decide which image-generation provider and storage path are supported.
  - Generate media as instructor-reviewable drafts.
  - Run safety/moderation checks and retain provenance.
  - Require editable alt text or an explicit decorative designation.
  - Keep text as the complete learning path.
  - Keep animation optional, skippable, non-blocking, and capped at five seconds.
- **Done when:** Approved Supporting media can be safely published and rejected media cannot enter a learner-facing activity.
- **Progress:** Local draft provider writes public `/media/drafts/...` paths,
  moderation gates unsafe prompts, approval requires passed moderation plus alt
  text or decorative designation, and the learner renderer only shows approved
  moderated media. Publish-time schema checks remain in place.

### 9. Replace heuristic locale checks with explicit content-language validation
- **Status:** [x]
- **Blocked by:** 3
- **Finding:** Locale validation currently checks only for Chinese and Latin characters, which can reject legitimate technical content or miss other mismatches.
- **Work:**
  - Use the supported content-language model.
  - Define exceptions for identifiers, URLs, code, and technical terminology.
  - Keep mixed-language failures explicit for instructor review.
- **Done when:** Valid technical content is accepted without weakening detection of unintended mixed-language generated content.
- **Progress:** Locale validation uses the supported `ContentLanguage` model and
  ignores approved technical terms, identifiers, URLs, email addresses, and
  inline code while continuing to reject unintended mixed-language prose.

### 10. Expand learner behavior tests
- **Status:** [x]
- **Blocked by:** 1 and 2
- **Finding:** Sort, Match, and Choose have component tests, but the agreed activity-level behavior is not covered as one external flow.
- **Work:**
  - Test activity progression and visible progress.
  - Test incorrect submission, Correction reveal, and continuation.
  - Test Hint use without a correctness penalty.
  - Test Replay and refresh recovery.
  - Test first-pass versus retry history.
  - Test keyboard, screen-reader announcements, and non-drag interaction paths.
- **Done when:** The agreed learner behavior is covered through public behavior rather than component internals.
- **Progress:** Challenge component tests cover incorrect continuation,
  Correction, Hint, Replay, recovery, and keyboard paths. Activity-level tests
  cover ordered progression after incorrect attempts, activity completion, and
  published-version / Playthrough binding.

### 11. Update terminology and documentation
- **Status:** [x]
- **Blocked by:** 1
- **Finding:** Comments still describe the renderer as dispatching over “the two mini-games,” and some code comments use the earlier block-oriented language.
- **Work:**
  - Use Game Activity, Challenge, Playthrough, Replay, Correction, Hint, and Supporting media consistently.
  - Remove stale descriptions of the two-game model.
  - Keep the glossary as the domain-language source of truth.
- **Done when:** Public comments, types, tests, and docs describe the same domain model.
- **Progress:** Comments, prompts, learner labels, and Challenge badges use
  glossary terminology. Storage still uses `type: "game"` as the Challenge
  payload discriminator.

## Environment and guardrail backlog

### 12. Add continuous integration for the existing verification command
- **Status:** [~]
- **Blocked by:** None
- **Finding:** `package.json` provides `npm run verify`, but no visible CI workflow runs linting, type checking, tests, and the production build.
- **Work:**
  - Run `npm run verify` on pull requests and the main branch.
  - Report failures as required checks.
- **Done when:** A pull request cannot merge without the repository’s existing verification command passing.
- **Progress:** `.github/workflows/verify.yml` runs `npm run verify`. Remaining
  step: enable it as a required branch-protection check with
  `.scratch/game-activity/require-verify-check.sh`.

### 13. Add a lightweight pre-commit guardrail
- **Status:** [x]
- **Blocked by:** 12
- **Finding:** No visible Husky or equivalent pre-commit hook protects the repository from avoidable lint/type/test regressions.
- **Work:**
  - Add the smallest repository-standard hook that runs the appropriate fast checks.
  - Keep the full `npm run verify` check in CI rather than making every commit run the production build.
- **Done when:** Local commits receive fast feedback while CI remains the authoritative full check.

### 14. Track agent configuration files
- **Status:** [x]
- **Blocked by:** None
- **Finding:** `.gitignore` ignores `/docs/` and `/AGENTS.md`, so the setup configuration is not visible as a normal tracked change.
- **Work:**
  - Unignore the specific agent configuration paths, or relocate the configuration to a tracked location.
  - Preserve the single-context domain and GitHub issue-tracker conventions.
- **Done when:** Future agents in a fresh checkout can read the configured issue tracker and domain-doc rules.

## Suggested execution order

1. 12 — Add CI verification.
2. 14 — Track agent configuration.
3. 1 — Replace independent blocks with one Game Activity.
4. 2 — Separate attempted, correct, and completed states.
5. 4 — Add activity-level editor authoring.
6. 3 — Unify generation paths.
7. 5 — Remove learner-facing numeric scores.
8. 6 — Establish explicit published versions.
9. 7 — Make Playthrough persistence first-class.
10. 9 — Improve locale validation.
11. 10 — Expand learner behavior tests continuously with the preceding changes.
12. 8 — Complete the Supporting media lifecycle.
13. 11 — Refresh terminology and documentation after the model settles.
14. 13 — Add the pre-commit guardrail after CI conventions are established.
