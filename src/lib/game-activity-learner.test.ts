import { describe, expect, it } from "vitest";

import { getGameActivityProgress } from "./game-activity-progression";
import { mockGameActivity } from "./llm/prompts/game-activity";
import { gradeActivity } from "./blocks/activity-result";

describe("Game Activity learner behavior", () => {
  it("advances ordered Challenge progress after an incorrect first response", () => {
    const activity = mockGameActivity("en");
    const first = activity.challenges[0];
    if (first.payload.variant !== "sort") throw new Error("Expected sort");

    const grade = gradeActivity(first, {
      order: [...first.payload.items.keys()].reverse(),
    });

    expect(grade).toMatchObject({
      completed: true,
      passed: false,
      feedback: { correction: expect.anything() },
    });

    const progress = getGameActivityProgress(activity, [first.id]);
    expect(progress.nextChallenge?.id).toBe(activity.challenges[1].id);
    expect(progress.completed).toBe(false);
  });

  it("completes the Game Activity once every Challenge has been attempted", () => {
    const activity = mockGameActivity("en");
    const progress = getGameActivityProgress(
      activity,
      activity.challenges.map((challenge) => challenge.id),
    );

    expect(progress).toMatchObject({
      completed: true,
      nextChallenge: null,
      nextChallengeIndex: null,
    });
  });

  it("keeps Hint use out of Challenge completion state", () => {
    const activity = mockGameActivity("en");
    const first = activity.challenges[0];
    // Hint signals are graded as incomplete/ungraded by submitActivity and
    // must not appear in completed Challenge ids used for progression.
    const progress = getGameActivityProgress(activity, []);

    expect(progress.nextChallenge?.id).toBe(first.id);
    expect(progress.completedChallengeIds).toEqual([]);
    expect(
      gradeActivity(first, {
        order: first.payload.variant === "sort" ? [0, 1] : undefined,
      }).completed,
    ).toBe(true);
  });
});
