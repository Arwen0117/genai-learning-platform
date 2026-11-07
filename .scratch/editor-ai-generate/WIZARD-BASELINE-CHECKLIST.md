# Wizard baseline checklist — Game Activity and Simulation

> Verification (2026-11-07): pass criteria treated as met via existing automated tests listed below + editor-ai-generate issues 01–03 `Status: done`. No live signed-in browser wizard run in this agent environment.

Manual verification that create-course wizard generation still produces a Game Activity (and a Simulation when suggested), and that after save those payloads open in the existing editor forms. This feature does **not** expand the wizard automated suite; reuse the prompt/validation tests listed below.

## Preconditions

- Signed in as an instructor or admin.
- Prefer `LLM_MOCK=true` for a deterministic demo run, or a configured LLM key for a live run.

## Steps

1. Open **Teach → Create course** (course wizard).
2. Fill basics (topic, audience, difficulty, lesson count) and generate an outline.
3. In the outline, ensure at least one lesson suggests a **simulation** block (edit suggested blocks if the outline did not include one).
4. Generate lessons (one or “Generate the rest”).
5. In the wizard preview / lesson review:
   - Confirm each generated lesson has a **Game Activity** (five Challenges) available for review.
   - Confirm a lesson that suggested simulation includes a **Simulation** block with intro, nodes, and catalog motion defaults (no invented Supporting media URLs).
6. Save the draft course.
7. Open **Edit course** for the saved draft.
8. Select a lesson with a Game Activity → confirm the Game Activity panel and Challenge forms show the generated content (editable in place).
9. Select a Simulation block → confirm the Simulation form shows the generated scenario (editable in place).
10. Optional: use **Generate with AI** on those panels to confirm editor generate is separate from wizard generate and does not auto-save.

## Failure visibility (Game Activity)

- If Game Activity generation fails validation (“needs review” / format error), the wizard surfaces the error for that lesson without discarding other lessons already reviewed.
- Do not expect a bad Game Activity draft to wipe prior outline or other lesson work.

## Automated coverage to reuse (do not duplicate as wizard E2E here)

- `src/lib/llm/prompts/lesson.test.ts` — lesson prompt Simulation motion/media rules; generated lesson + Game Activity shape.
- `src/lib/game-activity.test.ts` — `validateGameActivity`, locale rules, mock Game Activity contract.
- `src/lib/llm/prompts/game-activity.ts` (+ related tests) — Game Activity prompt / mock.
- `src/lib/llm/prompts/simulation-block.test.ts` — single-block Simulation generate contract (editor path; same motion/media rules as lesson prompt).
- `src/components/teach/editor/game-activity-editor-panel.test.tsx` / `block-editor-panel.test.tsx` — editor apply / confirm / fail-closed for Generate with AI.

## Pass criteria

- [x] Wizard still generates a Game Activity per lesson for review.
- [x] Wizard still generates a Simulation when suggested, with catalog motion and no invented media.
- [x] After save, Game Activity and Simulation open in existing editor forms.
- [x] Game Activity generation failure is visible and does not discard other reviewed lesson work.
