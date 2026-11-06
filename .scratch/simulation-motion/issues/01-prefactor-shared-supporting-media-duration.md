# 01: Prefactor shared Supporting media + duration policy

**What to build:** Challenges still show Supporting media the same way for learners, but rendering and duration limits come from shared primitives. Challenge animations remain capped at 5 seconds. The shared duration policy can accept a higher max so Simulation can later allow 10-second animations without changing Challenge feel.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Supporting media for Challenges renders through the shared primitive with no learner-visible regression
- [x] Challenge `animation` Supporting media still rejects or clamps durations above 5 seconds
- [x] Duration policy is parameterized by context max (Challenge 5s; ready for Simulation 10s)
- [x] Existing Supporting media approval, moderation, provenance, alt text, and decorative rules still apply on Challenges
- [x] Expand–contract: old Challenge call sites keep working while the shared form exists beside them
