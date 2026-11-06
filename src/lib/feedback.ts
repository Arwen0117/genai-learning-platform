/**
 * Lesson-feedback vocabulary, shared by the server action, the learner widget
 * and the teacher dashboard.
 *
 * Kept free of Prisma imports so the client can import the same list; the
 * stored value is a plain string, so reading old rows never throws.
 */

export const FEEDBACK_REASONS = [
  "CONTENT_ERROR",
  "TOO_HARD",
  "TOO_SHALLOW",
  "BAD_EXAMPLE",
] as const;

export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

/** Display name of each reason; translated where it is rendered. */
export const FEEDBACK_REASON_KEYS: Record<FeedbackReason, string> = {
  CONTENT_ERROR: "feedback.reason.contentError",
  TOO_HARD: "feedback.reason.tooHard",
  TOO_SHALLOW: "feedback.reason.tooShallow",
  BAD_EXAMPLE: "feedback.reason.badExample",
};

export const MAX_FEEDBACK_NOTE_CHARS = 500;

/** Narrows a stored string back to the union; unknown values are kept as-is. */
export function isFeedbackReason(value: string): value is FeedbackReason {
  return (FEEDBACK_REASONS as readonly string[]).includes(value);
}
