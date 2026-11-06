# Spec: Simulation motion and Supporting media

**Status:** local draft (not yet published to GitHub)  
**Triage:** ready-for-agent (when published)  
**Test seam (agreed):** simulation payload contract + beat resolution — a pure resolve function over Simulation Block payload / node / beat that yields effective motion pattern id and optional Supporting media; schema enforces catalog membership and simulation animation duration ≤ 10s (Game Activity Challenges remain ≤ 5s).

## Problem Statement

Learners experience Simulation Blocks as plain text decision trees: node copy, choice buttons, feedback, and a score summary, with no motion between beats. Authors cannot attach reusable motion patterns or optional Supporting media to a scenario. That makes simulations feel flat compared to Challenges that already support brief Supporting media, and it blocks a subject-agnostic way to polish any branching scenario without inventing new interaction types.

## Solution

Enhance Simulation Blocks only (v1) with a motion-first presentation layer on the existing interactive flow (choose → feedback → continue → summary). Authors get block-level motion defaults and per-node overrides from a fixed pattern catalog, plus optional Supporting media on nodes. Short CSS/UI motion runs on four beats; when media is present, that beat may run up to ~10 seconds and remains skippable. Missing motion fields resolve to runtime defaults so existing courses pick up polish without migration. Shared Supporting media and motion primitives are extracted for reuse later; Game Activity Challenges are not rewired in this feature beyond a safe prefactor. No clip-generation pipeline in v1 — materials are instructor-provided or existing uploads; LLM lesson generation may emit catalog pattern ids only, never media URLs.

## User Stories

1. As a learner, I want Simulation Blocks to feel responsive when I enter a node, so that the scenario feels alive rather than a static form.
2. As a learner, I want clear motion when I select a choice, so that I know my decision registered.
3. As a learner, I want feedback to appear with a distinct motion beat, so that consequences stand out from the decision prompt.
4. As a learner, I want the run summary to enter with a calm motion beat, so that the close of the scenario feels intentional.
5. As a learner, I want the decision graph itself unchanged (one choice at a time, then Continue), so that I am not forced to learn new interaction mechanics.
6. As a learner, I want optional node Supporting media (image or brief animation) to enrich a beat, so that subject matter can use existing materials when available.
7. As a learner, I want pure UI motion to stay short (sub-second), so that I am not slowed down on every click.
8. As a learner, I want media beats that may last up to about 10 seconds when an animation is attached, so that short scenes have room to play.
9. As a learner, I want to continue or skip without waiting for media to finish, so that repeats and slow networks do not trap me.
10. As a learner with reduced-motion preferences, I want decorative UI motion suppressed, so that the experience stays comfortable.
11. As a learner with reduced-motion preferences, I want animation media shown as a static poster (or first frame) with an explicit Play control, so that I still get the content without forced motion.
12. As a learner, I want scoring, attempt recording, and Mark complete behaviour unchanged, so that progress and grades stay trustworthy.
13. As a learner, I want Start over to reset the run including motion/media state, so that a replay feels clean.
14. As a learner, I want broken-link and too-many-steps endings to still work, so that badly authored graphs cannot trap me.
15. As an instructor, I want block-level default motion patterns for the four beats, so that I can set a coherent feel once per Simulation Block.
16. As an instructor, I want per-node pattern overrides, so that key moments can differ without editing every node.
17. As an instructor, I want to attach optional Supporting media to a node, so that I can use existing images or short animations when I have them.
18. As an instructor, I want option rows to stay label / next / feedback / score only, so that the option editor does not explode in v1.
19. As an instructor, I want a fixed catalog of named motion patterns, so that I pick from known reusable options instead of writing CSS.
20. As an instructor, I want invalid pattern ids rejected at validation time, so that broken motion config cannot ship.
21. As an instructor, I want simulation animation Supporting media capped at 10 seconds, so that long clips cannot stall a lesson beat.
22. As an instructor, I want Game Activity Challenge Supporting media to remain capped at 5 seconds, so that Challenge play feel does not change.
23. As an instructor, I want approval, moderation, provenance, alt text, and decorative rules for Supporting media to match existing Challenge rules, so that media governance stays consistent.
24. As an instructor, I want existing Simulation Blocks without motion fields to keep validating and to pick up default patterns at runtime, so that I do not re-save every course.
25. As an instructor, I want the teach editor to expose motion defaults and per-node override plus media controls, so that I can author without raw JSON.
26. As an instructor, I want live schema validation errors for motion and media in the Simulation form, so that I can fix issues before save.
27. As an instructor authoring via AI lesson generation, I want generated simulations to include safe catalog pattern defaults, so that new scenarios feel polished out of the box.
28. As an instructor authoring via AI lesson generation, I want the model never to invent media URLs, so that lessons do not ship broken Supporting media paths.
29. As a developer, I want a pure beat-resolution function as the test seam, so that effective pattern and media can be verified without React timing.
30. As a developer, I want shared Supporting media rendering and duration-policy primitives, so that Simulation can consume them now and Challenges can migrate later.
31. As a developer, I want activity-result / grading of simulation paths to ignore motion and media, so that presentation never affects scores.
32. As a content designer, I want the same Simulation + motion model to work across subject domains, so that compliance, soft-skills, and STEM narrative scenarios share one authoring shape.
33. As a product owner, I want v1 limited to Simulation Blocks, so that we ship polish without boiling the ocean across quiz, reading, roleplay, and Game Activity.
34. As a product owner, I want no auto-generated clip pipeline in v1, so that shipping is not blocked on media generation infrastructure.
35. As an accessibility reviewer, I want non-decorative Supporting media to require alt text under the same rules as Challenges, so that screen-reader users get equivalent meaning.
36. As a learner on a repeat run, I want motion and media not to force watching again, so that practice stays efficient.
37. As an instructor, I want removing a node's media or clearing an override to fall back to block defaults / runtime defaults, so that partial authoring stays predictable.
38. As a developer, I want new Simulation Block templates to include sensible motion defaults, so that freshly added blocks already demonstrate the feature in the editor.

## Implementation Decisions

- **Scope:** Simulation Block only for learner/author behaviour in v1. Do not wire motion into quiz, reading, slides, flashcards, coding, roleplay, or Game Activity Challenges beyond a shared-module prefactor.
- **Interaction model unchanged:** choose → feedback → Continue → (next node or summary). No hotspots, drag, timed choices, or multi-select in v1.
- **Four motion beats:** `nodeEnter`, `choiceSelected`, `feedbackReveal`, `summaryEnter`. Continue and Start over use subtle built-in defaults only (not author-facing in v1).
- **Pattern catalog:** small fixed set of named pattern ids (e.g. fade-up, emphasis-pulse, slide-feedback, summary-rise — exact ids chosen at implement time, documented in catalog module). Authors select from the catalog; freeform CSS strings are rejected.
- **Motion vs media duration:** UI pattern motion is short (~300–800ms). Optional Supporting media on a node may occupy up to 10 seconds for `kind: "animation"` in simulation context; images have no play duration.
- **Payload shape (conceptual):**
  - Block `payload.motion` optional defaults: pattern id per beat.
  - Each node may optionally include `motionPattern` (override for relevant beats — implement as either a single override applied where that node is shown, or per-beat overrides on the node; prefer the smallest schema that supports block defaults + per-node override without option-level fields) and optional `supportingMedia` reusing the Supporting media shape.
  - Options remain `{ label, next, feedback, score }` only.
- **Resolution seam:** pure function resolve(simulation payload, nodeId, beat) → `{ patternId, supportingMedia | undefined }` applying runtime defaults when fields are absent, then block defaults, then node overrides. This is the agreed primary test seam.
- **Supporting media duration policy:** shared helper / schema factory with per-context max — simulation max 10s, Game Activity Challenge max remains 5s. Do not silently raise the Challenge cap.
- **Skippable media:** learner can Continue / Skip without waiting for animation end; media must not gate the decision graph.
- **Reduced motion:** when `prefers-reduced-motion: reduce`, suppress decorative UI patterns; for animation media show static poster/first frame and explicit Play (no autoplay).
- **Backward compatibility:** absent `motion` / node media fields remain valid; runtime defaults supply patterns. No migration script; no re-save required.
- **Grading:** simulation `onAttempt` / activity-result path ignores motion and Supporting media; scores and completion rules unchanged.
- **Shared modules:** extract Supporting media view and duration policy (and motion catalog / applier) into shared primitives consumed by Simulation now; Challenges may keep calling through a thin compatibility path after extract. Full Challenge migration onto the new module is optional follow-on, not required to close this spec.
- **Teach editor:** Simulation form gains a “Motion defaults” section (pattern per beat) and per-node pattern override + Supporting media controls in the same spirit as Challenge Supporting media authoring. No option-level media UI. No timeline editor.
- **LLM lesson generation:** may emit catalog pattern defaults on Simulation payloads; must not invent Supporting media URLs or paths. Prefer prompt + structured output rules over post-hoc URL scrubbing alone.
- **Templates:** English/Chinese Simulation Block templates include default motion pattern ids so new blocks demonstrate the feature.
- **No clip generator in v1:** patterns drive CSS/UI motion only; materials are upload/existing. Document generation as a later phase.
- **Glossary:** extend domain language so Simulation motion and reuse of Supporting media on Simulation nodes are named consistently with existing Supporting media (enrichment, not sole learning-critical meaning).

## Testing Decisions

- Good tests assert external behaviour of the payload contract and beat resolution (effective pattern, effective Supporting media, validation errors, duration caps, backward-compatible omission), not CSS class names, animation frame timing, or React transition implementation details.
- **Primary seam under test:** resolve(simulation payload, nodeId, beat) + Simulation Block schema validation (catalog membership, simulation animation ≤ 10s, Challenge path still ≤ 5s via shared duration policy).
- **Also protect:** activity-result / simulation grading still ignores motion/media (regression: existing simulation activity-result cases keep passing; add a case with motion/media present proving score path unchanged).
- **Prior art:** block schema tests, game-activity Supporting media validation, supporting-media draft duration clamping, simulation activity-result tests.
- Prefer not to add brittle UI timing tests; editor behaviour can be covered lightly if there is existing form-test prior art, otherwise rely on schema acceptance of editor-produced shapes.
- Reduced-motion and skippable media are specified for implementation; automate only if a stable seam exists (e.g. resolve does not need reduced-motion; a small media-policy helper might encode “autoplay allowed”).

## Out of Scope

- Wiring motion/Supporting media into non-simulation lesson blocks or full Game Activity Challenge redesign in the same delivery
- Option-level Supporting media or per-option motion
- Interactive stage inputs (hotspots, drag, timed choices)
- Auto-generating video/Lottie/clips from patterns or LLM
- In-browser canvas/SVG generative visuals as a materials substitute
- Visual timeline / advanced motion graph editor
- Raising Challenge Supporting media cap to 10s
- Forced watch-to-end or auto-advance on media end
- Migration scripts rewriting saved course JSON
- Closing or replacing the existing simulation scoring / attempt model

## Further Notes

- Design locked via grilling (2026-11-02): Q1–Q18 all accepted as recommended options (sim-only v1; motion UI primary with optional clips; subject-agnostic content; hybrid patterns + materials; interaction unchanged; 5–10s only when media attached; four beats; node media; sim 10s / game 5s; fixed catalog; block defaults + node overrides; CSS+upload only; reduced-motion A; skippable media; shared primitives; editor A; LLM patterns only; backward-compatible defaults).
- Prefer expand–contract if Supporting media duration max is today a single Zod `.max(5)`: introduce context-aware validation beside the old Challenge path, migrate Simulation onto 10s, leave Challenge callers on 5s, then optionally contract duplication.
- Publish to GitHub Issues with `ready-for-agent` when leaving local-scratch mode; tickets live under `.scratch/simulation-motion/issues/` until then.
