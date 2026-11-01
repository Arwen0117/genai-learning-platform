import { describe, expect, it } from "vitest";

import { getGameActivityProgress } from "./game-activity-progression";
import type { GameActivityContainer } from "./game-activity";

function activity(): GameActivityContainer {
  return {
    id: "activity-1",
    title: "Practice",
    challenges: Array.from({ length: 5 }, (_, index) => ({
      id: `challenge-${index + 1}`,
      title: `Challenge ${index + 1}`,
      type: "game" as const,
      payload: {
        variant: "choose" as const,
        prompt: `Prompt ${index + 1}`,
        options: [
          { id: "correct", text: "Correct", correct: true },
          { id: "distractor", text: "Distractor", correct: false },
        ],
      },
    })),
  };
}

describe("getGameActivityProgress", () => {
  it("returns the first incomplete Challenge in activity order", () => {
    const result = getGameActivityProgress(activity(), [
      "challenge-1",
      "challenge-3",
    ]);

    expect(result.completed).toBe(false);
    expect(result.nextChallenge?.id).toBe("challenge-2");
    expect(result.nextChallengeIndex).toBe(1);
    expect(result.completedChallengeIds).toEqual([
      "challenge-1",
      "challenge-3",
    ]);
  });

  it("ignores unknown ids and marks the activity complete only after every Challenge", () => {
    const result = getGameActivityProgress(activity(), [
      "challenge-5",
      "unknown-challenge",
      "challenge-1",
      "challenge-2",
      "challenge-3",
      "challenge-4",
    ]);

    expect(result).toEqual({
      completed: true,
      completedChallengeIds: [
        "challenge-1",
        "challenge-2",
        "challenge-3",
        "challenge-4",
        "challenge-5",
      ],
      nextChallenge: null,
      nextChallengeIndex: null,
    });
  });
});
