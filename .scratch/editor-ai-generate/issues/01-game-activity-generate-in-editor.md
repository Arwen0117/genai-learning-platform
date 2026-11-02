# 01: Game Activity — Generate with AI in the lesson editor

**What to build:** An instructor editing a lesson can use **Generate with AI** on the Game Activity panel to create (if missing) or refill the whole five-Challenge Game Activity from that lesson’s title, objectives/summary, other blocks, and locale. Success fills the existing Game Activity / Challenge editors in memory only; Save stays separate. Skip confirm when the activity is missing or still template; confirm before replacing teacher-edited content. On failure, show an error and keep prior content. Reuse the existing Game Activity generate action; do not regenerate the whole lesson.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Generate with AI is available on the Game Activity panel in the course editor.
- [x] Generate creates a full five-Challenge Game Activity when the lesson has none yet.
- [x] Generate refills the whole activity (not per-Challenge) from lesson-scoped context and locale.
- [x] Success updates in-memory editor state via existing change handlers; does not auto-save.
- [x] Confirm is skipped for missing/template content and required before replacing teacher-edited content.
- [x] Validation or LLM failure shows a panel error and leaves prior content unchanged.
- [x] Generate is disabled or clearly busy while a request is in flight.
- [x] Invalid generated activities are rejected before apply (visible failure).
- [x] Tests cover the generation contract reuse and editor apply / confirm / fail-closed behavior.
