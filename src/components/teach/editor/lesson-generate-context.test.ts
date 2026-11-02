import { describe, expect, it } from "vitest";

import { createBlock } from "./block-templates";
import { lessonGenerateContext } from "./lesson-generate-context";

describe("lessonGenerateContext", () => {
  it("uses reading markdown as objectives when present", () => {
    const reading = createBlock("reading", "en");
    if (reading.type !== "reading") {
      throw new Error("Expected a reading block.");
    }
    reading.payload.markdown = "# Goals\n\nLearn commits safely.";

    const context = lessonGenerateContext({
      title: "Why version control exists",
      blocks: [reading],
    });

    expect(context.lessonTitle).toBe("Why version control exists");
    expect(context.objectives).toContain("Learn commits safely.");
    expect(context.sourceContent).toContain("reading");
  });

  it("falls back to the lesson title when there are no blocks", () => {
    const context = lessonGenerateContext({
      title: "Why version control exists",
      blocks: [],
    });

    expect(context.objectives).toBe("Why version control exists");
    expect(context.sourceContent.length).toBeGreaterThanOrEqual(20);
  });
});
