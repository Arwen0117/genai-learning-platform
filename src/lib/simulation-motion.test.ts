import { describe, expect, it } from "vitest";

import {
  RUNTIME_DEFAULT_MOTION,
  resolveSimulationMotion,
  type SimulationMotionPayload,
} from "./simulation-motion";

const basePayload: SimulationMotionPayload = {
  nodes: {
    start: { },
    end: { },
  },
};

describe("resolveSimulationMotion", () => {
  it("fills runtime defaults when motion fields are absent", () => {
    expect(resolveSimulationMotion(basePayload, "start", "nodeEnter")).toEqual({
      patternId: RUNTIME_DEFAULT_MOTION.nodeEnter,
    });
    expect(
      resolveSimulationMotion(basePayload, "start", "choiceSelected"),
    ).toEqual({ patternId: RUNTIME_DEFAULT_MOTION.choiceSelected });
    expect(
      resolveSimulationMotion(basePayload, "start", "feedbackReveal"),
    ).toEqual({ patternId: RUNTIME_DEFAULT_MOTION.feedbackReveal });
    expect(resolveSimulationMotion(basePayload, "end", "summaryEnter")).toEqual(
      {
        patternId: RUNTIME_DEFAULT_MOTION.summaryEnter,
      },
    );
  });

  it("applies block defaults over runtime defaults", () => {
    const payload: SimulationMotionPayload = {
      motion: { nodeEnter: "none", summaryEnter: "fade-up" },
      nodes: { start: {}, end: {} },
    };
    expect(resolveSimulationMotion(payload, "start", "nodeEnter")).toEqual({
      patternId: "none",
    });
    expect(resolveSimulationMotion(payload, "end", "summaryEnter")).toEqual({
      patternId: "fade-up",
    });
    expect(resolveSimulationMotion(payload, "start", "feedbackReveal")).toEqual(
      {
        patternId: RUNTIME_DEFAULT_MOTION.feedbackReveal,
      },
    );
  });

  it("applies node overrides over block defaults and exposes node media", () => {
    const media = {
      kind: "image" as const,
      url: "/media/scene.png",
      approvalStatus: "approved" as const,
      moderationStatus: "passed" as const,
      provenance: { source: "instructor-provided" as const },
      decorative: true,
    };
    const payload: SimulationMotionPayload = {
      motion: { nodeEnter: "fade-up" },
      nodes: {
        start: {
          motion: { nodeEnter: "emphasis-pulse" },
          supportingMedia: media,
        },
        end: {},
      },
    };
    expect(resolveSimulationMotion(payload, "start", "nodeEnter")).toEqual({
      patternId: "emphasis-pulse",
      supportingMedia: media,
    });
    expect(resolveSimulationMotion(payload, "end", "nodeEnter")).toEqual({
      patternId: "fade-up",
    });
  });
});
