# 04: Teach-editor motion defaults and per-node media

**What to build:** In the teach editor Simulation form, instructors set block-level motion defaults (pattern per beat), per-node pattern overrides, and optional node Supporting media using the same governance spirit as Challenge Supporting media. Option rows stay text and score only. Invalid motion or media surfaces as live validation. Clearing an override or removing media falls back to block defaults / runtime defaults.

**Blocked by:** 02: Simulation motion schema, catalog, and beat resolution

**Status:** done

- [x] Simulation form exposes motion defaults for the four beats from the fixed catalog
- [x] Each node can override pattern and optionally attach Supporting media (image or animation ≤ 10s)
- [x] Option editor has no motion or media fields
- [x] Schema validation errors for motion/media appear in the form before save
- [x] Removing override/media restores fallback behaviour (block defaults / runtime defaults)
- [x] New Simulation Block templates include sensible motion defaults so a freshly added block demonstrates the feature
