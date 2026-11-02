# 05: Lesson LLM emits simulation motion pattern defaults

**What to build:** When AI lesson generation produces Simulation Blocks, it may include catalog motion pattern defaults so new scenarios feel polished without instructor setup. Generation must never invent Supporting media URLs or paths; instructors attach materials in the editor. Generated payloads validate against the Simulation motion schema.

**Blocked by:** 02: Simulation motion schema, catalog, and beat resolution

**Status:** done

- [x] Lesson generation guidance allows emitting catalog pattern ids on Simulation motion defaults
- [x] Generation does not invent Supporting media URLs or paths
- [x] Generated Simulation payloads with motion defaults pass schema validation
- [x] Simulations generated without media still resolve runtime/block defaults correctly for learners
