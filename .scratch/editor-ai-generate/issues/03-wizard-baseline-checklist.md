# 03: Wizard baseline checklist for Game Activity and Simulation

**What to build:** A short manual checklist that verifies the create-course wizard still generates a Game Activity (and a Simulation when suggested), and that after save those payloads are editable in the existing editor forms. Reuse existing prompt/validation tests; do not add a large new wizard automated suite.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Checklist lives under `.scratch/editor-ai-generate/` and covers wizard generate → preview/save → open Game Activity and Simulation in editor forms.
- [x] Checklist notes failure visibility for invalid Game Activity generation without discarding other reviewed lesson work.
- [x] Checklist points at existing prompt/validation tests to reuse rather than prescribing new wizard E2E coverage.
