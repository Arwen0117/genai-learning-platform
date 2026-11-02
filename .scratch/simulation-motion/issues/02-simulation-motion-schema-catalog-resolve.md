# 02: Simulation motion schema, catalog, and beat resolution

**What to build:** Authors can express motion on a Simulation Block via optional block-level defaults and per-node overrides from a fixed pattern catalog, plus optional Supporting media on a node. A pure beat-resolution function returns the effective pattern and media for each of the four beats, filling runtime defaults when fields are missing. Invalid catalog ids and simulation animations over 10 seconds fail validation. Existing simulations without motion fields still validate. Simulation scoring and completion ignore motion and media.

**Blocked by:** 01: Prefactor shared Supporting media + duration policy

**Status:** done

- [x] Fixed motion pattern catalog exists; unknown pattern ids fail Simulation Block validation
- [x] Optional `payload.motion` defaults and per-node override + optional node Supporting media are accepted by the schema
- [x] Options remain label / next / feedback / score only (no option-level media or motion)
- [x] `resolve(payload, nodeId, beat)` yields effective `{ patternId, supportingMedia? }` with runtime defaults → block defaults → node overrides
- [x] Four beats are supported: node enter, choice selected, feedback reveal, summary enter
- [x] Simulation animation Supporting media allows up to 10 seconds; Challenge path remains 5 seconds via shared duration policy
- [x] Missing motion/media fields remain valid (backward compatible; no migration required)
- [x] Activity-result / simulation grading behaviour unchanged when motion and media are present
- [x] Primary tests target the schema + resolve seam (external contract, not CSS/React timing)
