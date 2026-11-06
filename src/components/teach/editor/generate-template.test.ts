import { describe, expect, it } from "vitest";

import type { GameActivityContainer } from "@/lib/game-activity";
import type { SimulationBlock } from "@/lib/blocks/schema";
import {
  createBlock,
  createGameActivity,
  isTemplateGameActivity,
  isTemplateSimulationBlock,
} from "./block-templates";

describe("isTemplateGameActivity", () => {
  it("treats a fresh scaffold as template content", () => {
    expect(isTemplateGameActivity(createGameActivity("en"), "en")).toBe(true);
    expect(isTemplateGameActivity(createGameActivity("zh"), "zh")).toBe(true);
  });

  it("treats teacher-edited Challenges as non-template", () => {
    const activity = createGameActivity("en");
    const edited: GameActivityContainer = {
      ...activity,
      challenges: activity.challenges.map((challenge, index) =>
        index === 0
          ? { ...challenge, title: "Teacher-written Challenge" }
          : challenge,
      ),
    };

    expect(isTemplateGameActivity(edited, "en")).toBe(false);
  });

  it("treats a teacher-edited Game Activity title as non-template", () => {
    const activity = createGameActivity("en");
    expect(
      isTemplateGameActivity({ ...activity, title: "My custom practice" }, "en"),
    ).toBe(false);
  });
});

describe("isTemplateSimulationBlock", () => {
  it("treats the add-block Simulation starter as template content", () => {
    const block = createBlock("simulation", "en") as SimulationBlock;
    expect(isTemplateSimulationBlock(block, "en")).toBe(true);
  });

  it("treats an edited Simulation as non-template", () => {
    const block = createBlock("simulation", "en") as SimulationBlock;
    const edited: SimulationBlock = {
      ...block,
      title: "Handle a production alert",
      payload: {
        ...block.payload,
        intro: "An alert just fired.",
      },
    };

    expect(isTemplateSimulationBlock(edited, "en")).toBe(false);
  });
});
