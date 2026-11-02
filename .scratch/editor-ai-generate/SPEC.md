# Spec: AI generate Game Activity and Simulation in the lesson editor

**Status:** local draft (not yet published to GitHub)  
**Triage:** ready-for-agent (when published)  
**Test seams (agreed):**

1. **Generation contract (primary)** — instructor server actions that take lesson-scoped context and return a validated Game Activity or Simulation Block, or a visible failure without mutating caller state. Reuse `generateGameActivity`; add `generateSimulationBlock`. Prior art: Game Activity validation and lesson/Simulation prompt tests.
2. **Editor apply behavior** — course editor panels wire Generate into existing forms via normal change handlers: confirm-before-replace when content is not still the add-block template (or Game Activity missing), keep prior content on failure, do not auto-save. Prior art: Game Activity editor panel component tests.

Wizard baseline is verified with a short manual checklist plus existing prompt/validation tests; this feature does not expand the wizard test suite.

## Problem Statement

Instructors can get AI-filled Game Activities and Simulation Blocks when creating a course through the wizard, then review them in the normal editor forms after save. When they open **Edit lesson** and add a Game Activity or Simulation by hand, they only get empty templates—there is no way to generate content with AI and land it in the same forms for review. That forces either leaving the editor to regenerate a whole lesson, or writing Challenges and simulation trees manually.

## Solution

Keep the wizard path as the baseline that already generates a five-Challenge Game Activity and (when suggested) Simulation Blocks for review in existing forms. In the course editor, add **Generate with AI** on the right-hand block editor when a Game Activity Challenge or Simulation Block is selected so instructors can create or refill those two types from lesson-scoped context. Generated payloads populate the existing Game Activity / Challenge and Simulation forms; the instructor still saves explicitly. Overwrites of teacher-edited content require confirmation; failures leave prior content intact. Other block types are out of scope for this slice.

## User Stories

1. As an instructor, I want the course wizard to keep generating a Game Activity for each lesson, so that new courses still get practice Challenges without extra steps.
2. As an instructor, I want the course wizard to keep generating Simulation Blocks when the outline suggests them, so that decision scenarios still appear in drafts.
3. As an instructor, I want wizard-generated Game Activity and Simulation content to open in the existing editor forms after save, so that I can review and edit without a separate review screen.
4. As an instructor, I want wizard generation failures for a Game Activity to fail visibly without discarding other reviewed lesson work, so that a bad practice draft does not wipe my progress.
5. As an instructor, I want a short checklist to confirm the wizard still fills Game Activity and Simulation for review, so that we know the baseline still works before relying on the editor path.
6. As an instructor editing a lesson, I want a **Generate with AI** action on the block editor when a Game Activity Challenge is selected, so that I can fill practice Challenges without leaving the editor.
7. As an instructor editing a lesson, I want a **Generate with AI** action when a Simulation Block is selected, so that I can fill the scenario form without writing the tree by hand.
8. As an instructor, I want Generate to appear after I am working on that Game Activity or Simulation in the block editor (not as a persistent empty panel or a separate add-block picker mode), so that the flow stays “add or select → generate → edit in place.”
9. As an instructor, I want Game Activity Generate to produce the whole five-Challenge activity in one shot, so that I get a complete practice set aligned with lesson rules.
10. As an instructor, I want to add a Game Challenge (scaffolding the Game Activity if missing) then Generate from the block editor, so that I do not need a sticky empty Game Activity strip.
11. As an instructor, I want Simulation Generate to replace the selected Simulation Block’s content with one generated Simulation Block, so that the form shows a full scenario ready to edit.
12. As an instructor, I want generation grounded on this lesson’s title, objectives or summary, other blocks’ content, and locale, so that Challenges and scenarios match what I am teaching.
13. As an instructor, I want generation not to use other lessons or the full course outline as required context, so that the draft stays focused on the current lesson.
14. As an instructor, I want a successful generate to update only in-memory editor state, so that I can still discard or edit before Save.
15. As an instructor, I want Save to remain the only persist step, so that Generate never silently publishes or writes the course.
16. As an instructor, I want Generate on still-template (or missing Game Activity) content to run without a confirm dialog, so that the first fill is fast.
17. As an instructor, I want Generate to ask for confirmation before replacing teacher-edited content, so that I do not lose work by accident.
18. As an instructor, I want a failed generate (validation or LLM error) to show an error on the panel and keep prior form content, so that a bad run never partially overwrites my draft.
19. As an instructor, I want the generate control disabled or clearly busy while a request is in flight, so that I do not double-submit.
20. As an instructor, I want generated Game Activity Challenges to use Sort, Match, and Choose with deterministic answer keys, feedback, optional Hints, and Distractors in the lesson locale, so that the activity meets existing Game Activity rules.
21. As an instructor, I want invalid generated Game Activities to be rejected before they enter the form, so that “needs review” failures stay visible instead of landing broken Challenges.
22. As an instructor, I want generated Simulation Blocks to use catalog Motion pattern ids only and never invent Supporting media URLs, so that I attach media myself in the editor.
23. As an instructor, I want generated Simulation payloads to pass existing Simulation schema and motion rules, so that the form and learner runtime stay valid.
24. As an instructor, I want to edit every generated field in the existing GameForm / SimulationForm / Game Activity panel after generate, so that review means the same tools as manual authoring.
25. As an instructor, I want other block types in the picker to stay manual templates only in this slice, so that scope stays Game Activity and Simulation.
26. As an instructor, I want the add-block picker itself unchanged aside from later editing with Generate on those two types, so that adding a block does not grow a second AI mode.
27. As an admin or instructor authorized to teach, I want only instructors and admins to call these generate actions, so that learners cannot trigger authoring generation.
28. As an instructor, I want Game Activity editor generation to reuse the existing standalone Game Activity generator rather than regenerating the whole lesson, so that the editor path stays fast and focused.
29. As an instructor, I want Simulation editor generation to use a dedicated single-block generator rather than full lesson generation, so that I do not rebuild unrelated blocks.
30. As an instructor, I want the wizard’s full lesson generator left in place for course creation, so that create-course and edit-lesson paths do not fight each other.
31. As an instructor working in Chinese or English UI locale, I want generated copy to follow the content language for that locale, so that Challenges and simulations match the course language.
32. As an instructor, I want generation errors phrased so I can retry or edit manually, so that a failure is actionable.
33. As an instructor, I want to regenerate after a successful generate (with confirm if I edited), so that I can try again without deleting the block.
34. As an instructor, I want selecting a Challenge after Game Activity generate to still use the existing Challenge editor, so that review of each Challenge is unchanged.
35. As a developer agent, I want automated tests at the generation contract and editor apply seams, so that regressions in fill, confirm, and fail-closed behavior are caught without a large wizard suite.
36. As a developer agent, I want a documented manual checklist for the wizard baseline, so that humans can verify create-course generate → preview/save → forms still works.
37. As an instructor, I want Supporting media on Simulations to remain instructor-attached after AI generate, so that media governance and approval rules stay intact.
38. As an instructor, I want legacy loose `game` blocks to continue migrating into the Game Activity container through existing editor behavior, so that Generate does not revive five separate game blocks as the target model.

## Implementation Decisions

- Scope is **Game Activity** and **Simulation Block** only in the course editor; glossary language: Game Activity (not “game block”), Challenge, Simulation, Supporting media, Motion pattern / Motion beat.
- Wizard baseline remains `generateLessonBlocks` (lesson blocks including Simulation when suggested, plus second-call Game Activity). No product change required there beyond verification.
- Editor Game Activity generation calls the existing `generateGameActivity` server action with lesson title, objectives/summary, and truncated JSON (or equivalent text) of other lesson blocks as source content, plus content language from locale.
- Editor Simulation generation adds a new `generateSimulationBlock` server action with the same lesson-scoped context idea and the same Simulation rules already used in lesson generation (catalog motion ids; never invent Supporting media).
- Do not call full `generateLessonBlocks` from the editor for this slice.
- UI: **Generate with AI** on the right-hand **block editor** when a Game Activity Challenge or a Simulation Block is selected — same placement for both types. Not a persistent empty Game Activity strip above LESSON CONTENT, and not a separate add-block picker mode. The middle-column Game Activity list (title + Challenges) still appears only when an activity already exists.
- Successful generate applies results through existing editor change handlers into in-memory course editor state; Save remains separate.
- If the lesson has no Game Activity, the instructor adds a Game Challenge via Add a block (which scaffolds the container), then uses Generate on the block editor to refill the whole five-Challenge activity.
- Confirm-before-replace when current content is not still the add-block template (Simulation) or when a Game Activity already exists with non-template / teacher-edited content; skip confirm when content still matches the template starter.
- On failure: show panel error; do not apply partial payloads; keep prior content.
- While generating: disable the action / show busy state to prevent double submit.
- Auth: same instructor/admin gate as other teach generate actions; audit via existing LLM job usage keys where applicable (`course-game-activity`; add an appropriate usage key for simulation-only generation).
- No new accept/reject review workflow; no auto-save; no per-Challenge generate; no AI for other block types.
- No ADR required for this wiring; no new glossary terms unless a domain word is introduced later.

## Testing Decisions

- Good tests assert external behavior: given lesson context or panel state, generate returns/applies valid content, confirm gates overwrite, failure preserves prior content and surfaces an error. Do not assert prompt string internals or private React state.
- **Seam 1 — Generation contract:** tests around `generateGameActivity` / `generateSimulationBlock` (and shared validation): shape, locale rules, motion/media constraints, visible failure on invalid output. Prefer schema + validation + prompt contract tests already used for lessons/Game Activities; extend for the Simulation single-block action.
- **Seam 2 — Editor apply:** component/integration tests on the block editor (Challenge + Simulation) wiring: generate success → apply via change handlers; template skips confirm; edited content requires confirm; failure keeps previous props/content.
- Prior art: Game Activity editor panel tests, block template tests, lesson prompt / Simulation payload tests, `validateGameActivity`.
- Wizard: manual checklist only in this feature (create course → generate lessons → confirm Game Activity and Simulation appear → save → open editor forms). Reuse existing automated prompt/validation tests; do not add a large new wizard E2E suite here.

## Out of Scope

- AI generate for reading, quiz, flashcards, slides, coding, roleplay, reflection, or other non-Simulation blocks.
- Per-Challenge generate or partial Game Activity regenerate.
- Separate accept/reject or staged “AI draft” review UI.
- Auto-save or auto-publish on generate.
- Regenerating an entire lesson from the editor via `generateLessonBlocks`.
- Model-generated Supporting media URLs or media approval pipeline changes.
- Changing learner runtime for Game Activity or Simulation beyond consuming already-valid payloads.
- Publishing this spec/tickets to GitHub (kept under `.scratch/` until explicitly published).
- Expanding the wizard automated test suite.

## Further Notes

- Shared understanding from grilling: verify wizard baseline (checklist) and close the edit-lesson gap for Game Activity + Simulation only; populate existing forms; lesson-scoped context; confirm before overwrite of edited content; fail closed; generate ≠ save; whole Game Activity via existing action; create Game Activity if missing; dedicated Simulation action.
- Local path: `.scratch/editor-ai-generate/` (spec + tickets). Publish to GitHub Issues with `ready-for-agent` only when leaving local-scratch mode.
