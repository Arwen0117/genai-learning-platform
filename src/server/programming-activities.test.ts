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
import { createParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
import { courseProgrammingVersion } from "@/lib/programming-game/course-config";
import { submitActivity, loadActivityAttempts } from "./activities";
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

describe("v2 programming submissions", () => {
  const p = createParallelProgrammingPayload("parallel-lanes", "en");
  const v2: Block = { id: "b", title: "Parallel", type: "game", payload: p };
  const solution = [{ op: "repeat", count: 4, body: [{ op: "right" }] }];
  beforeEach(() => { m.access.mockResolvedValue({ userId: "student", courseId: "course", block: v2, blocks: [v2], preview: false }); });
  it("regrades v2 using authoritative rules and stores only the bounded program and hash", async () => {
    const levelVersion = await courseProgrammingVersion(p);
    expect(await submitActivity("lesson", "b", { attemptId, answer: { program: solution, levelVersion, passed: false, robots: [], rulesVersion: 1 } })).toMatchObject({ ok: true, grade: { completed: true, feedback: { feedbackVersion: 2, levelVersion } } });
    expect(m.persist.mock.calls[0][0].answer).toEqual({ program: solution, levelVersion });
  });
  it("rejects stale v2 content without grading or persistence", async () => {
    const levelVersion = await courseProgrammingVersion({ ...p, robotCount: 1 });
    expect(await submitActivity("lesson", "b", { attemptId, answer: { program: solution, levelVersion } })).toMatchObject({ ok: false, code: "LEVEL_CHANGED" });
    expect(m.grade).not.toHaveBeenCalled(); expect(m.persist).not.toHaveBeenCalled();
  });
  it("rejects malformed programs without creating a zero-score attempt", async () => {
    expect(await submitActivity("lesson", "b", { attemptId, answer: { program: [], levelVersion: await courseProgrammingVersion(p) } })).toMatchObject({ ok: false });
    expect(m.persist).not.toHaveBeenCalled();
  });
  it("stores a genuine failed v2 run as zero despite forged success", async () => {
    expect(await submitActivity("lesson", "b", { attemptId, answer: { program: [{ op: "left" }], levelVersion: await courseProgrammingVersion(p), passed: true } })).toMatchObject({ ok: true, grade: { completed: false, score: { raw: 0 }, feedback: { feedbackVersion: 2, status: "error" } } });
  });
  it("returns a saved retry even after v2 content changes", async () => {
    const grade = gradeActivity(v2, { program: solution }); m.grade.mockClear();
    m.find.mockResolvedValue({ id: "old-v2", result: grade });
    expect(await submitActivity("lesson", "b", { attemptId, answer: { program: [], levelVersion: "outdated" } })).toMatchObject({ ok: true, id: "old-v2", grade });
    expect(m.grade).not.toHaveBeenCalled(); expect(m.persist).not.toHaveBeenCalled();
  });
  it("still authorizes before looking up a v2 retry", async () => {
    m.access.mockRejectedValue(new Error("Not enrolled"));
    expect(await submitActivity("lesson", "b", { attemptId, answer: { program: solution } })).toMatchObject({ ok: false });
    expect(m.find).not.toHaveBeenCalled(); expect(m.persist).not.toHaveBeenCalled();
  });
  it("preview neither reads student history nor writes submissions", async () => {
    m.access.mockResolvedValue({ userId: "teacher", block: v2, preview: true });
    expect(await submitActivity("lesson", "b", { attemptId, answer: { program: solution } }, true)).toEqual({ ok: true, id: null });
    expect(await loadActivityAttempts("lesson", "b", undefined, true)).toEqual({ ok: true, attempts: [], nextCursor: null });
    expect(m.find).not.toHaveBeenCalled(); expect(m.persist).not.toHaveBeenCalled();
  });
  it("returns the transaction winner's grade for concurrent v2 retries", async () => {
    const saved = { ...gradeActivity(v2, { program: [{ op: "right" }] }) };
    m.persist.mockResolvedValue({ id: "winner-v2", result: saved });
    expect(await submitActivity("lesson", "b", { attemptId, answer: { program: solution, levelVersion: await courseProgrammingVersion(p) } })).toMatchObject({ ok: true, id: "winner-v2", grade: { completed: false, score: { raw: 0 } } });
  });
});

describe("upstream hint and replay compatibility", () => {
  it.each(["hint", "replay"])("cannot bypass robot grading with a forged %s signal", async (kind) => {
    const p = createParallelProgrammingPayload("parallel-lanes", "en"), game: Block = { id: "b", type: "game", title: "Robots", payload: p };
    m.access.mockResolvedValue({ userId: "student", courseId: "course", block: game, blocks: [game], preview: false });
    const result = await submitActivity("lesson", "b", { attemptId, answer: { program: [{ op: "left" }], levelVersion: await courseProgrammingVersion(p), kind }, feedback: { kind: "hint" } });
    expect(result).toMatchObject({ ok: true, grade: { verification: "server", completed: false, score: { raw: 0 } } });
    expect(m.persist.mock.calls[0][0].answer).not.toHaveProperty("kind");
  });
});
