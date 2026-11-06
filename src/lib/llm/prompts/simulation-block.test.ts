import { describe, expect, it } from "vitest";

import {
  generatedSimulationBlockSchema,
  mockSimulationBlock,
  simulationBlockPrompt,
} from "./simulation-block";

const prompt = simulationBlockPrompt({
  lessonTitle: "Why version control exists",
  objectives: "Explain the problem Git solves.",
  sourceContent: JSON.stringify({
    title: "Why version control exists",
    blocks: [{ type: "reading", title: "A project needs a memory" }],
  }),
  language: "en",
});

describe("simulationBlockPrompt", () => {
  it("carries lesson-scoped context and catalog motion rules", () => {
    expect(prompt).toContain("Lesson title: Why version control exists");
    expect(prompt).toContain("fade-up");
    expect(prompt).toContain("emphasis-pulse");
    expect(prompt).toContain("Never invent Supporting media URLs");
    expect(prompt).toContain("Do not include supportingMedia");
  });
});

describe("generatedSimulationBlockSchema", () => {
  it("accepts a catalog-motion Simulation with no Supporting media", () => {
    const block = mockSimulationBlock("en");
    expect(generatedSimulationBlockSchema.safeParse(block).success).toBe(true);
  });

  it("rejects a Simulation that invents Supporting media", () => {
    const block = mockSimulationBlock("en");
    const withMedia = {
      ...block,
      payload: {
        ...block.payload,
        nodes: {
          ...block.payload.nodes,
          triage: {
            ...block.payload.nodes.triage!,
            supportingMedia: {
              kind: "image" as const,
              url: "https://example.com/alert.png",
              decorative: true,
              approvalStatus: "approved" as const,
              moderationStatus: "passed" as const,
              provenance: { source: "instructor-provided" as const },
            },
          },
        },
      },
    };

    expect(generatedSimulationBlockSchema.safeParse(withMedia).success).toBe(
      false,
    );
  });
});

describe("mockSimulationBlock", () => {
  it("returns locale-aware content that satisfies the generate schema", () => {
    const en = generatedSimulationBlockSchema.parse(mockSimulationBlock("en"));
    const zh = generatedSimulationBlockSchema.parse(mockSimulationBlock("zh"));

    expect(en.payload.motion?.nodeEnter).toBe("fade-up");
    expect(zh.title).toContain("告警");
  });
});
