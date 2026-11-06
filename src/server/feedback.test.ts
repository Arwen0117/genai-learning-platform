import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  lessonFind: vi.fn(),
  enrollmentFind: vi.fn(),
  upsert: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.trackEvent }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lesson: { findUnique: m.lessonFind },
    enrollment: { findUnique: m.enrollmentFind },
    lessonFeedback: { upsert: m.upsert },
  },
}));
vi.mock("@/i18n/server", () => ({
  getI18n: async () => ({ locale: "en", t: (key: string) => key }),
}));

import { submitLessonFeedback } from "./feedback";

const learner = { id: "learner-1", role: "LEARNER" };
const lessonId = "lesson-1";

function publishedLesson(): void {
  m.lessonFind.mockResolvedValue({
    id: lessonId,
    module: { course: { id: "course-1", status: "PUBLISHED" } },
  });
}

describe("submitLessonFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.upsert.mockResolvedValue({ id: "feedback-1" });
    m.trackEvent.mockResolvedValue(undefined);
  });

  it("refuses a caller who is not signed in", async () => {
    m.auth.mockResolvedValue(null);

    const result = await submitLessonFeedback({ lessonId, reason: "TOO_HARD" });

    expect(result).toEqual({ ok: false, error: "server.feedback.signIn" });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("refuses an instructor, so preview never writes learner feedback", async () => {
    m.auth.mockResolvedValue({ user: { id: "teacher-1", role: "INSTRUCTOR" } });
    publishedLesson();

    const result = await submitLessonFeedback({ lessonId, reason: "TOO_HARD" });

    expect(result).toEqual({ ok: false, error: "server.feedback.learnerOnly" });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("refuses a learner who is not enrolled", async () => {
    m.auth.mockResolvedValue({ user: learner });
    publishedLesson();
    m.enrollmentFind.mockResolvedValue(null);

    const result = await submitLessonFeedback({ lessonId, reason: "TOO_HARD" });

    expect(result).toEqual({ ok: false, error: "server.feedback.notEnrolled" });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("refuses a lesson that does not exist", async () => {
    m.auth.mockResolvedValue({ user: learner });
    m.lessonFind.mockResolvedValue(null);

    const result = await submitLessonFeedback({ lessonId, reason: "TOO_HARD" });

    expect(result).toEqual({ ok: false, error: "server.feedback.notFound" });
  });

  it("rejects an unknown reason and an over-long note", async () => {
    m.auth.mockResolvedValue({ user: learner });
    publishedLesson();
    m.enrollmentFind.mockResolvedValue({ id: "enrollment-1" });

    const unknownReason = await submitLessonFeedback({
      lessonId,
      // @ts-expect-error the action must reject values outside the union too.
      reason: "NOT_A_REASON",
    });
    const longNote = await submitLessonFeedback({
      lessonId,
      reason: "TOO_HARD",
      note: "x".repeat(501),
    });

    expect(unknownReason).toEqual({ ok: false, error: "server.feedback.invalid" });
    expect(longNote).toEqual({ ok: false, error: "server.feedback.invalid" });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("upserts one row per learner and records the event", async () => {
    m.auth.mockResolvedValue({ user: learner });
    publishedLesson();
    m.enrollmentFind.mockResolvedValue({ id: "enrollment-1" });

    const result = await submitLessonFeedback({
      lessonId,
      reason: "BAD_EXAMPLE",
      note: "  The coffee example is out of date.  ",
    });

    expect(result).toEqual({ ok: true });
    expect(m.upsert).toHaveBeenCalledWith({
      where: { lessonId_userId: { lessonId, userId: learner.id } },
      update: {
        courseId: "course-1",
        reason: "BAD_EXAMPLE",
        note: "The coffee example is out of date.",
      },
      create: {
        lessonId,
        courseId: "course-1",
        userId: learner.id,
        reason: "BAD_EXAMPLE",
        note: "The coffee example is out of date.",
      },
    });
    expect(m.trackEvent).toHaveBeenCalledWith("LESSON_FEEDBACK", {
      userId: learner.id,
      courseId: "course-1",
      payload: {
        lessonId,
        reason: "BAD_EXAMPLE",
        hasNote: true,
      },
    });
  });

  it("stores a blank note as null", async () => {
    m.auth.mockResolvedValue({ user: learner });
    publishedLesson();
    m.enrollmentFind.mockResolvedValue({ id: "enrollment-1" });

    await submitLessonFeedback({ lessonId, reason: "TOO_SHALLOW", note: "   " });

    expect(m.upsert.mock.calls[0][0].create.note).toBeNull();
    expect(m.trackEvent.mock.calls[0][1].payload.hasNote).toBe(false);
  });

  it("reports a failed write without throwing", async () => {
    m.auth.mockResolvedValue({ user: learner });
    publishedLesson();
    m.enrollmentFind.mockResolvedValue({ id: "enrollment-1" });
    m.upsert.mockRejectedValue(new Error("db down"));

    const result = await submitLessonFeedback({ lessonId, reason: "TOO_HARD" });

    expect(result).toEqual({ ok: false, error: "server.feedback.failed" });
  });
});
