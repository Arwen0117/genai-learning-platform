import { describe, expect, it } from "vitest";

import {
  CHALLENGE_MAX_ANIMATION_SECONDS,
  SIMULATION_MAX_ANIMATION_SECONDS,
  clampAnimationDuration,
  effectiveAnimationPlaybackSeconds,
} from "./supporting-media-duration";

describe("supporting media duration policy", () => {
  it("keeps Challenge and Simulation caps distinct", () => {
    expect(CHALLENGE_MAX_ANIMATION_SECONDS).toBe(5);
    expect(SIMULATION_MAX_ANIMATION_SECONDS).toBe(10);
  });

  it("clamps drafts to the Challenge max by default shape", () => {
    expect(clampAnimationDuration(9, CHALLENGE_MAX_ANIMATION_SECONDS)).toBe(5);
    expect(clampAnimationDuration(undefined, CHALLENGE_MAX_ANIMATION_SECONDS)).toBe(
      5,
    );
  });

  it("allows Simulation drafts up to ten seconds", () => {
    expect(clampAnimationDuration(9, SIMULATION_MAX_ANIMATION_SECONDS)).toBe(9);
    expect(clampAnimationDuration(12, SIMULATION_MAX_ANIMATION_SECONDS)).toBe(10);
  });

  it("caps playback at the context max even when stored duration is higher", () => {
    expect(effectiveAnimationPlaybackSeconds(8, CHALLENGE_MAX_ANIMATION_SECONDS)).toBe(
      5,
    );
    expect(
      effectiveAnimationPlaybackSeconds(8, SIMULATION_MAX_ANIMATION_SECONDS),
    ).toBe(8);
  });
});
