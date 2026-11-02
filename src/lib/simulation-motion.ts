import type { SupportingMedia } from "@/lib/blocks/schema";

/** Named motion beats authors can configure on a Simulation Block. */
export const MOTION_BEATS = [
  "nodeEnter",
  "choiceSelected",
  "feedbackReveal",
  "summaryEnter",
] as const;

export type MotionBeat = (typeof MOTION_BEATS)[number];

/**
 * Fixed catalog of reusable UI motion patterns. Freeform CSS strings are rejected
 * at schema validation — authors pick from this list only.
 */
export const MOTION_PATTERN_IDS = [
  "fade-up",
  "emphasis-pulse",
  "slide-feedback",
  "summary-rise",
  "none",
] as const;

export type MotionPatternId = (typeof MOTION_PATTERN_IDS)[number];

/** Runtime defaults applied when block and node leave a beat unset. */
export const RUNTIME_DEFAULT_MOTION: Record<MotionBeat, MotionPatternId> = {
  nodeEnter: "fade-up",
  choiceSelected: "emphasis-pulse",
  feedbackReveal: "slide-feedback",
  summaryEnter: "summary-rise",
};

export type SimulationMotionDefaults = Partial<
  Record<MotionBeat, MotionPatternId>
>;

/** Minimal payload surface the resolve seam needs. */
export type SimulationMotionPayload = {
  motion?: SimulationMotionDefaults;
  nodes: Record<
    string,
    {
      motion?: SimulationMotionDefaults;
      supportingMedia?: SupportingMedia;
    }
  >;
};

export type ResolvedSimulationMotion = {
  patternId: MotionPatternId;
  supportingMedia?: SupportingMedia;
};

/**
 * Resolve effective motion pattern and optional Supporting media for a beat.
 *
 * Precedence: node overrides → block defaults → runtime defaults.
 * Supporting media always comes from the named node when present.
 */
export function resolveSimulationMotion(
  payload: SimulationMotionPayload,
  nodeId: string,
  beat: MotionBeat,
): ResolvedSimulationMotion {
  const node = payload.nodes[nodeId];
  const patternId =
    node?.motion?.[beat] ??
    payload.motion?.[beat] ??
    RUNTIME_DEFAULT_MOTION[beat];

  const supportingMedia = node?.supportingMedia;

  return supportingMedia === undefined
    ? { patternId }
    : { patternId, supportingMedia };
}

/** Tailwind / tw-animate-css classes for each catalog pattern. */
export function motionPatternClassName(
  patternId: MotionPatternId,
  reducedMotion: boolean,
): string {
  if (reducedMotion || patternId === "none") return "";
  switch (patternId) {
    case "fade-up":
      return "animate-in fade-in-0 slide-in-from-bottom-2 duration-500";
    case "emphasis-pulse":
      return "animate-in fade-in-0 zoom-in-95 duration-300";
    case "slide-feedback":
      return "animate-in fade-in-0 slide-in-from-left-2 duration-500";
    case "summary-rise":
      return "animate-in fade-in-0 slide-in-from-bottom-1 duration-700";
    default: {
      const _exhaustive: never = patternId;
      return _exhaustive;
    }
  }
}
