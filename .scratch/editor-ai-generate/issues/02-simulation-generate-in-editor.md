# 02: Simulation — Generate with AI in the lesson editor

**What to build:** An instructor editing a lesson can use **Generate with AI** on the selected Simulation Block to fill the existing Simulation form from that lesson’s title, objectives/summary, other blocks, and locale. A dedicated single-block Simulation generate action returns one Simulation (catalog Motion patterns only; never invent Supporting media). Success applies in memory only; Save stays separate. Skip confirm when content is still the add-block template; confirm before replacing teacher-edited content. On failure, show an error and keep prior content. Do not call full lesson generation from the editor.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A dedicated Simulation generate action accepts lesson-scoped context and returns one validated Simulation Block or a visible failure.
- [x] Generated payloads use catalog Motion pattern ids only and do not invent Supporting media URLs or objects.
- [x] Generate with AI is available on the Simulation block editor when a Simulation is selected.
- [x] Success updates in-memory editor state via existing change handlers; does not auto-save.
- [x] Confirm is skipped for template content and required before replacing teacher-edited content.
- [x] Validation or LLM failure shows a panel error and leaves prior content unchanged.
- [x] Generate is disabled or clearly busy while a request is in flight.
- [x] Tests cover the Simulation generation contract and editor apply / confirm / fail-closed behavior.
