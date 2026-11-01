import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  access: vi.fn(),
  persist: vi.fn(),
  find: vi.fn(),
  grade: vi.fn(),
}));
vi.mock("@/lib/activity-access", () => ({ activityAccess: m.access }));
vi.mock("@/lib/activity-store", () => ({ persistActivity: m.persist }));
vi.mock("@/lib/prisma", () => ({
  prisma: { activityAttempt: { findUnique: m.find } },
}));
vi.mock("@/lib/blocks/activity-result", async (original) => {
  const actual =
    await original<typeof import("@/lib/blocks/activity-result")>();
  return {
    ...actual,
    gradeActivity: m.grade.mockImplementation(actual.gradeActivity),
  };
});
import { submitActivity } from "./activities";
import {
  createProgrammingPayload,
  programmingVersion,
} from "@/lib/programming-game/config";
import { gradeActivity } from "@/lib/blocks/activity-result";
import type { Block } from "@/lib/blocks/schema";

const payload = createProgrammingPayload("first-route", "en");
const block: Block = { id: "b", type: "game", title: "Game", payload };
const program = [{ op: "right" }, { op: "right" }, { op: "down" }];
const attemptId = "ad77ae57-789a-4b3c-a723-717ffcd21c63";
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue({
    userId: "student",
    courseId: "course",
    block,
    blocks: [block],
    preview: false,
  });
  m.find.mockResolvedValue(null);
  m.persist.mockImplementation(async (input) => ({
    id: "saved",
    result: {
      ...input.grade,
      answer: input.answer,
      activitySnapshot: input.block,
    },
  }));
});
describe("programming submissions", () => {
  it("regrades server-side and persists the hash and complete level snapshot", async () => {
    const levelVersion = await programmingVersion(payload);
    const result = await submitActivity("lesson", "b", {
      attemptId,
      answer: { program, levelVersion, completed: false },
    });
    expect(result).toMatchObject({
      ok: true,
      id: "saved",
      grade: {
        completed: true,
        score: { raw: 100 },
        feedback: {
          levelVersion,
          levelSnapshot: { width: 3, start: { x: 0, y: 0 } },
        },
      },
    });
    expect(m.persist.mock.calls[0][0].answer.program).toEqual(program);
    expect(m.persist.mock.calls[0][0].block).toEqual(block);
  });
  it("rejects new attempts against changed content before grading or writing", async () => {
    const levelVersion = await programmingVersion({
      ...payload,
      task: "An older task",
    });
    const result = await submitActivity("lesson", "b", {
      attemptId,
      answer: { program, levelVersion },
    });
    expect(result).toMatchObject({ ok: false, code: "LEVEL_CHANGED" });
    expect(m.grade).not.toHaveBeenCalled();
    expect(m.persist).not.toHaveBeenCalled();
  });
  it("returns a saved retry before version comparison or regrading", async () => {
    const oldGrade = {
      ...gradeActivity(block, { program }),
      feedback: { levelVersion: "old-version" },
    };
    m.grade.mockClear();
    m.find.mockResolvedValue({ id: "old", result: oldGrade });
    const result = await submitActivity("lesson", "b", {
      attemptId,
      answer: { program: [], levelVersion: "old-version" },
    });
    expect(result).toMatchObject({ ok: true, id: "old", grade: oldGrade });
    expect(m.grade).not.toHaveBeenCalled();
    expect(m.persist).not.toHaveBeenCalled();
    expect(
      m.find.mock.calls[0][0].where.userId_lessonId_blockId_attemptId,
    ).toEqual({
      userId: "student",
      lessonId: "lesson",
      blockId: "b",
      attemptId,
    });
  });
  it("authorizes before looking up a saved result", async () => {
    m.access.mockRejectedValue(new Error("Not enrolled"));
    expect(
      await submitActivity("lesson", "b", { attemptId, answer: { program } }),
    ).toMatchObject({ ok: false, error: "Not enrolled" });
    expect(m.find).not.toHaveBeenCalled();
    expect(m.persist).not.toHaveBeenCalled();
  });
  it("teacher preview never queries student attempts or creates a record", async () => {
    m.access.mockResolvedValue({ userId: "teacher", block, preview: true });
    expect(
      await submitActivity(
        "lesson",
        "b",
        { attemptId, answer: { program } },
        true,
      ),
    ).toEqual({ ok: true, id: null });
    expect(m.find).not.toHaveBeenCalled();
    expect(m.grade).not.toHaveBeenCalled();
    expect(m.persist).not.toHaveBeenCalled();
  });
  it("persists a failed run without granting completion", async () => {
    const levelVersion = await programmingVersion(payload);
    const result = await submitActivity("lesson", "b", {
      attemptId,
      answer: { program: [{ op: "left" }], levelVersion, completed: true },
    });
    expect(result).toMatchObject({
      ok: true,
      grade: {
        completed: false,
        score: { raw: 0 },
        feedback: { status: "error", error: { code: "OUT_OF_BOUNDS" } },
      },
    });
  });
  it("uses the stored winner's grade when a concurrent retry wins the transaction", async () => {
    const grade = {
      ...gradeActivity(block, { program }),
      completed: false,
      passed: false,
    };
    m.persist.mockResolvedValue({ id: "winner", result: grade });
    expect(
      await submitActivity("lesson", "b", {
        attemptId,
        answer: { program, levelVersion: await programmingVersion(payload) },
      }),
    ).toMatchObject({ ok: true, id: "winner", grade: { completed: false } });
  });
});
