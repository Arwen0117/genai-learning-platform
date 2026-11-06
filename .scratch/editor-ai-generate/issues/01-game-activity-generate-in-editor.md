# 01: Game Activity — Generate with AI in the lesson editor

**What to build:** An instructor editing a lesson can use **Generate with AI** on the **block editor** when a Game Activity Challenge is selected, to refill the whole five-Challenge Game Activity from that lesson’s title, objectives/summary, other blocks, and locale. If the lesson has no Game Activity yet, add a Game Challenge via Add a block (scaffolds the container), then Generate. Success fills the existing Game Activity / Challenge editors in memory only; Save stays separate. Skip confirm when content is still template; confirm before replacing teacher-edited content. On failure, show an error and keep prior content. Reuse the existing Game Activity generate action; do not regenerate the whole lesson.

**UX note (follow-up):** Do **not** show a persistent empty Game Activity panel above LESSON CONTENT with Generate. Generate lives only on the right-hand block editor (parallel to Simulation). The middle Game Activity list shows only when an activity already exists.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Generate with AI is available on the block editor when a Game Activity Challenge is selected.
- [x] No persistent empty Game Activity / Generate strip above LESSON CONTENT.
- [x] Generate creates/refills a full five-Challenge Game Activity (after Add a block scaffolds if missing) from lesson-scoped context and locale.
- [x] Generate refills the whole activity (not per-Challenge) from lesson-scoped context and locale.
- [x] Success updates in-memory editor state via existing change handlers; does not auto-save.
- [x] Confirm is skipped for template content and required before replacing teacher-edited content.
- [x] Validation or LLM failure shows a panel error and leaves prior content unchanged.
- [x] Generate is disabled or clearly busy while a request is in flight.
- [x] Invalid generated activities are rejected before apply (visible failure).
- [x] Tests cover the generation contract reuse and editor apply / confirm / fail-closed behavior.
