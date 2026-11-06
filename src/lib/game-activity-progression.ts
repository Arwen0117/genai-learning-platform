import type { GameActivityContainer } from "@/lib/game-activity";

export type GameActivityProgress = {
  completed: boolean;
  completedChallengeIds: string[];
  nextChallenge: GameActivityContainer["challenges"][number] | null;
  nextChallengeIndex: number | null;
};

/**
 * Returns the first ordered Challenge that has not been attempted.
 *
 * Unknown completed ids are ignored so progress written by an older lesson
 * version cannot make a current activity appear complete.
 */
export function getGameActivityProgress(
  activity: GameActivityContainer,
  completedChallengeIds: readonly string[],
): GameActivityProgress {
  const completed = new Set(completedChallengeIds);
  const orderedCompletedIds = activity.challenges
    .filter((challenge) => completed.has(challenge.id))
    .map((challenge) => challenge.id);
  const nextChallengeIndex = activity.challenges.findIndex(
    (challenge) => !completed.has(challenge.id),
  );

  return {
    completed: nextChallengeIndex === -1,
    completedChallengeIds: orderedCompletedIds,
    nextChallenge:
      nextChallengeIndex === -1
        ? null
        : (activity.challenges[nextChallengeIndex] ?? null),
    nextChallengeIndex: nextChallengeIndex === -1 ? null : nextChallengeIndex,
  };
}
