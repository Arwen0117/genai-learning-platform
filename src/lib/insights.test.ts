import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  groupBy: vi.fn(),
  feedbackFindMany: vi.fn(),
  lessonFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lessonFeedback: { groupBy: m.groupBy, findMany: m.feedbackFindMany },
    lesson: { findMany: m.lessonFindMany },
  },
}));

import { loadLessonFeedback } from "./insights";

describe("loadLessonFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns nothing (and reads no lessons) when no feedback exists", async () => {
    m.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const rows = await loadLessonFeedback({ courseId: "course-1" });

    expect(rows).toEqual([]);
    expect(m.lessonFindMany).not.toHaveBeenCalled();
  });

  it("tallies reasons per lesson and orders by total", async () => {
    m.groupBy
      .mockResolvedValueOnce([
        { lessonId: "lesson-a", reason: "TOO_HARD", _count: { _all: 2 } },
        { lessonId: "lesson-a", reason: "TOO_SHALLOW", _count: { _all: 1 } },
        { lessonId: "lesson-b", reason: "BAD_EXAMPLE", _count: { _all: 1 } },
        { lessonId: "lesson-b", reason: "SOMETHING_OLD", _count: { _all: 5 } },
      ])
      .mockResolvedValueOnce([
        { lessonId: "lesson-a", _max: { createdAt: new Date("2026-11-07T10:00:00Z") } },
      ]);
    m.lessonFindMany.mockResolvedValue([
      { id: "lesson-a", title: "A" },
      { id: "lesson-b", title: "B" },
    ]);
    m.feedbackFindMany.mockResolvedValue([
      {
        lessonId: "lesson-a",
        reason: "TOO_HARD",
        note: "The second half moves too fast.",
        createdAt: new Date("2026-11-07T10:00:00Z"),
      },
    ]);

    const rows = await loadLessonFeedback({ courseId: "course-1" });

    expect(rows.map((row) => row.lessonId)).toEqual(["lesson-a", "lesson-b"]);

    const [first, second] = rows;
    expect(first.lessonTitle).toBe("A");
    expect(first.counts).toEqual({
      CONTENT_ERROR: 0,
      TOO_HARD: 2,
      TOO_SHALLOW: 1,
      BAD_EXAMPLE: 0,
    });
    expect(first.total).toBe(3);
    expect(first.latestNote).toEqual({
      reason: "TOO_HARD",
      note: "The second half moves too fast.",
      createdAt: new Date("2026-11-07T10:00:00Z"),
    });

    // The unknown legacy reason is ignored instead of inflating the total.
    expect(second.total).toBe(1);
    expect(second.latestNote).toBeNull();
  });

  it("asks only for lessons that actually have a note", async () => {
    m.groupBy
      .mockResolvedValueOnce([
        { lessonId: "lesson-a", reason: "CONTENT_ERROR", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([]);
    m.lessonFindMany.mockResolvedValue([{ id: "lesson-a", title: "A" }]);

    const rows = await loadLessonFeedback({ courseId: "course-1" });

    expect(m.feedbackFindMany).not.toHaveBeenCalled();
    expect(rows[0].latestNote).toBeNull();
  });
});
