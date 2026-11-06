/** Challenge Supporting media animations stay brief so play feel stays snappy. */
export const CHALLENGE_MAX_ANIMATION_SECONDS = 5;

/**
 * Simulation Supporting media may run longer than Challenges so short scenes
 * have room to play without raising the Challenge cap.
 */
export const SIMULATION_MAX_ANIMATION_SECONDS = 10;

/**
 * Clamp an authored or draft animation duration to a context max.
 * Missing durations default to the context max (matching prior Challenge draft behaviour).
 */
export function clampAnimationDuration(
  durationSeconds: number | undefined,
  maxSeconds: number,
): number {
  return Math.min(durationSeconds ?? maxSeconds, maxSeconds);
}

/** Effective playback cap for a stored animation, never above the context max. */
export function effectiveAnimationPlaybackSeconds(
  durationSeconds: number,
  maxSeconds: number,
): number {
  return Math.min(durationSeconds, maxSeconds);
}
