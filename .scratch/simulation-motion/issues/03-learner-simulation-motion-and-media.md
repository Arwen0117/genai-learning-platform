# 03: Learner Simulation motion + node Supporting media

**What to build:** On a Simulation Block in the learner view, the four beats use catalog motion patterns from beat resolution. When a node has Supporting media, it appears on the relevant beat, may run up to ~10 seconds for animations, and never blocks Continue / Skip. With reduced-motion preferences, decorative UI motion is suppressed and animation media is a static poster (or first frame) with explicit Play. The decision graph stays choose → feedback → Continue → summary (or Start over), with scoring and Mark complete unchanged.

**Blocked by:** 01: Prefactor shared Supporting media + duration policy; 02: Simulation motion schema, catalog, and beat resolution

**Status:** done

- [x] Node enter, choice selected, feedback reveal, and summary enter each apply the resolved catalog pattern
- [x] Pure UI motion stays short; long beats only occur when Supporting media is attached
- [x] Node Supporting media renders via the shared Supporting media primitive
- [x] Learner can Continue / Skip without waiting for media to finish
- [x] `prefers-reduced-motion: reduce` suppresses decorative UI motion and avoids animation autoplay (poster + Play)
- [x] Choose → feedback → Continue → summary / Start over behaviour and attempt completion path unchanged
- [x] Simulations without authored motion still show runtime default patterns
