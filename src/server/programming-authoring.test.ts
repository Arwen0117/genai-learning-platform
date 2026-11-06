import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  course: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  module: vi.fn(),
  lesson: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { course: { findUnique: m.course }, $transaction: m.transaction },
}));
vi.mock("@/lib/teach", () => ({ loadEditorCourse: m.reload }));
vi.mock("@/i18n/server", () => ({
  getI18n: async () => ({ t: (key: string) => key }),
}));
import { saveCourse } from "./editor";
import { createParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
import type { EditorCourseInput } from "@/lib/teach-editor";
import { createProgrammingPayload } from "@/lib/programming-game/config";

function draft() {
  return {
    title: "Programming course",
    description: "A course about programming concepts.",
    audience: "Students",
    difficulty: "beginner" as const,
    coverEmoji: "🤖",
    status: "DRAFT" as const,
    modules: [
      {
        id: "m",
        title: "Module",
        lessons: [
          {
            id: "l",
            title: "Lesson",
            estimatedMinutes: 5,
            blocks: [
              {
                id: "b",
                title: "Route",
                type: "game" as const,
                payload: createProgrammingPayload("first-route", "en"),
              },
            ],
          },
        ],
      },
    ],
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "teacher", role: "INSTRUCTOR" } });
  m.course.mockResolvedValue({
    id: "course",
    createdById: "teacher",
    modules: [{ id: "m", lessons: [{ id: "l" }] }],
  });
  m.transaction.mockImplementation((fn) =>
    fn({
      course: { update: m.update },
      module: { update: m.module },
      lesson: { update: m.lesson },
    }),
  );
  m.reload.mockResolvedValue({ id: "course" });
});
describe("programming course authoring", () => {
  it("persists the preset, task, commands, hints and edited knowledge in the existing lesson JSON", async () => {
    const input = draft();
    const payload = input.modules[0].lessons[0].blocks[0].payload;
    payload.task = "Teacher task";
    payload.hints = ["Teacher hint"];
    payload.knowledge = [
      { title: "Teacher concept", body: "Explain the concept." },
    ];
    expect((await saveCourse("course", input)).ok).toBe(true);
    expect(m.lesson.mock.calls[0][0].data.blocks[0].payload).toEqual(payload);
    expect(m.reload).toHaveBeenCalledWith("course");
  });
  it("rejects a configuration with a disabled reference solution before any transaction", async () => {
    const input = draft();
    input.modules[0].lessons[0].blocks[0].payload.allowed = ["left"];
    const result = await saveCourse("course", input);
    expect(result).toMatchObject({ ok: false });
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("keeps existing teacher ownership protection for the new variant", async () => {
    m.course.mockResolvedValue({
      id: "course",
      createdById: "other",
      modules: [],
    });
    expect((await saveCourse("course", draft())).ok).toBe(false);
    expect(m.transaction).not.toHaveBeenCalled();
  });
});

describe("v2 course authoring", () => {
  it("persists a four-robot v2 activity without changing its block ID", async () => {
    const input: EditorCourseInput = draft();
    const p = createParallelProgrammingPayload("parallel-goal-guard", "zh", 4);
    input.modules[0].lessons[0].blocks[0] = { id: "b", type: "game", title: "Robots", payload: p };
    expect((await saveCourse("course", input)).ok).toBe(true);
    expect(m.lesson.mock.calls[0][0].data.blocks[0]).toEqual({ id: "b", type: "game", title: "Robots", payload: p });
  });
  it("rejects unknown v2 revisions before entering a transaction", async () => {
    const input = draft();
    Object.assign(input.modules[0].lessons[0].blocks[0], { payload: { ...createParallelProgrammingPayload("parallel-lanes", "en"), templateRevision: 99 } });
    expect((await saveCourse("course", input)).ok).toBe(false); expect(m.transaction).not.toHaveBeenCalled();
  });
  it("keeps v2 teacher ownership protection", async () => {
    const input: EditorCourseInput = draft(); input.modules[0].lessons[0].blocks[0] = { id: "b", type: "game", title: "Robots", payload: createParallelProgrammingPayload("parallel-lanes", "en") };
    m.course.mockResolvedValue({ id: "course", createdById: "another", modules: [] });
    expect((await saveCourse("course", input)).ok).toBe(false); expect(m.transaction).not.toHaveBeenCalled();
  });
});
