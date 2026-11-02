import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(), lessonUpdate: vi.fn(), lessonCreate: vi.fn(), stamp: vi.fn(), transaction: vi.fn(), enrolled: vi.fn(), progress: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { course: { findUnique: m.find }, enrollment: { findUnique: m.enrolled }, lessonProgress: { findMany: m.progress }, $transaction: m.transaction } }));
vi.mock("@/lib/llm/provider", () => ({ generateJson: m.generate, isMockMode: () => true }));
import { saveRobotCourse, loadRobotCourseDraft } from "./robot-courses";
import { generateProgrammingHints } from "./programming-hints";
import { loadRobotGame } from "@/lib/programming-game/robot-course-access";
import { createRobotCourseDraft } from "@/lib/programming-game/robot-course";
let i = 0; const id = () => `00000000-0000-4000-8000-${String(++i).padStart(12, "0")}`;
function fixture() {
  const p = createRobotCourseDraft("en", id); p.updatedAt = "2026-11-02T00:00:00.000Z";
  const row = { id: p.draftId, slug: "robot-game-example", topic: "Robot programming", title: p.title, description: p.description, language: p.language, status: "PUBLISHED", createdById: "teacher", updatedAt: new Date(p.updatedAt), modules: [{ id: "module", lessons: p.levels.map((l) => ({ id: l.lessonId, title: l.title, blocks: [{ id: l.blockId, type: "game", title: l.title, payload: l.payload }] })) }] };
  return { p, row };
}
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ user: { id: "teacher", role: "INSTRUCTOR" } }); m.find.mockResolvedValue(null);
  m.create.mockImplementation(async ({ data }) => ({ id: data.id, updatedAt: new Date("2026-11-02T00:00:00.000Z") }));
  m.update.mockResolvedValue({ count: 1 }); m.stamp.mockResolvedValue({ updatedAt: new Date("2026-11-02T01:00:00.000Z") });
  m.transaction.mockImplementation((fn) => fn({ course: { findUnique: m.find, create: m.create, updateMany: m.update, findUniqueOrThrow: m.stamp }, lesson: { update: m.lessonUpdate, create: m.lessonCreate } }));
  m.enrolled.mockResolvedValue({ id: "enrollment" }); m.progress.mockResolvedValue([]); m.generate.mockResolvedValue({ hints: ["[MOCK] Observe first"] });
});
describe("dedicated course persistence", () => {
  it("creates a separate teacher-owned draft with seven level lessons", async () => {
    const p = createRobotCourseDraft("en", id); const result = await saveRobotCourse(null, p);
    expect(result).toMatchObject({ ok: true, courseId: p.draftId });
    const data = m.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ createdById: "teacher", topic: "Robot programming", source: "INSTRUCTOR", status: "DRAFT" });
    expect(data.slug).toMatch(/^robot-game-/); expect(data.modules.create.lessons.create).toHaveLength(7);
  });
  it("reuses an existing creation identity after a network retry", async () => {
    const { p, row } = fixture(); m.find.mockResolvedValue(row);
    expect(await saveRobotCourse(null, p)).toMatchObject({ ok: true, courseId: row.id }); expect(m.create).not.toHaveBeenCalled();
  });
  it("updates only owned levels and preserves their lesson/block identities", async () => {
    const { p, row } = fixture(); m.find.mockResolvedValue(row); p.levels[0].title = "Updated level";
    expect(await saveRobotCourse(row.id, p)).toMatchObject({ ok: true });
    expect(m.lessonUpdate).toHaveBeenCalledTimes(7); expect(m.lessonUpdate.mock.calls[0][0]).toMatchObject({ where: { id: p.levels[0].lessonId }, data: { blocks: [{ id: p.levels[0].blockId }] } });
  });
  it("adds new levels without removing old history-bearing lessons", async () => {
    const { p, row } = fixture(); m.find.mockResolvedValue(row); p.levels.push({ ...p.levels[0], lessonId: id(), blockId: id() });
    expect(await saveRobotCourse(row.id, p)).toMatchObject({ ok: true }); expect(m.lessonCreate).toHaveBeenCalledOnce();
  });
  it.each(["owner", "stamp", "deleted", "identity"])("rejects unsafe update %s before writing any lessons", async (kind) => {
    const { p, row } = fixture();
    if (kind === "owner") row.createdById = "someone-else";
    if (kind === "stamp") p.updatedAt = "2020-01-01T00:00:00.000Z";
    if (kind === "deleted") p.levels.pop();
    if (kind === "identity") p.levels[0].blockId = id();
    m.find.mockResolvedValue(row); expect(await saveRobotCourse(row.id, p)).toMatchObject({ ok: false }); expect(m.lessonUpdate).not.toHaveBeenCalled();
  });
  it("rejects invalid map/reference or learner access before a transaction", async () => {
    const p = createRobotCourseDraft("en", id); p.levels[0].payload.allowed = [];
    expect(await saveRobotCourse(null, p)).toMatchObject({ ok: false }); expect(m.transaction).not.toHaveBeenCalled();
    m.auth.mockResolvedValue({ user: { id: "student", role: "LEARNER" } });
    expect(await saveRobotCourse(null, createRobotCourseDraft("en", id))).toMatchObject({ ok: false }); expect(m.transaction).not.toHaveBeenCalled();
  });
  it("rejects an optimistic update that loses the atomic course stamp check", async () => {
    const { p, row } = fixture(); m.find.mockResolvedValue(row); m.update.mockResolvedValue({ count: 0 });
    expect(await saveRobotCourse(row.id, p)).toMatchObject({ ok: false }); expect(m.lessonUpdate).not.toHaveBeenCalled();
  });
  it("loads the saved game course as the same editable draft", async () => {
    const { p, row } = fixture(); m.find.mockResolvedValue(row);
    expect(await loadRobotCourseDraft(row.id)).toMatchObject({ courseId: row.id, draft: { draftId: p.draftId, levels: p.levels } });
  });
});
describe("dedicated player access", () => {
  it("preview reads no enrollments or student progress", async () => {
    const { row } = fixture(); m.find.mockResolvedValue(row);
    expect(await loadRobotGame(row.id, true)).toMatchObject({ title: row.title }); expect(m.enrolled).not.toHaveBeenCalled(); expect(m.progress).not.toHaveBeenCalled();
  });
  it("requires enrollment and a published course for learners", async () => {
    const { row } = fixture(); m.find.mockResolvedValue(row); m.auth.mockResolvedValue({ user: { id: "student", role: "LEARNER" } });
    expect(await loadRobotGame(row.id, false)).not.toBeNull();
    m.enrolled.mockResolvedValue(null); expect(await loadRobotGame(row.id, false)).toBeNull();
    m.enrolled.mockResolvedValue({ id: "enrolled" }); row.status = "DRAFT"; expect(await loadRobotGame(row.id, false)).toBeNull();
  });
  it("does not let a student claim preview access or expose someone else's draft", async () => {
    const { row } = fixture(); row.status = "DRAFT"; m.find.mockResolvedValue(row);
    m.auth.mockResolvedValue({ user: { id: "student", role: "LEARNER" } }); expect(await loadRobotGame(row.id, true)).toBeNull();
    m.auth.mockResolvedValue({ user: { id: "other-teacher", role: "INSTRUCTOR" } }); expect(await loadRobotGame(row.id, true)).toBeNull();
  });
  it("returns only this learner's saved level completions", async () => {
    const { p, row } = fixture(); m.find.mockResolvedValue(row); m.auth.mockResolvedValue({ user: { id: "student", role: "LEARNER" } });
    m.progress.mockResolvedValue([{ lessonId: p.levels[0].lessonId, completedBlocks: [p.levels[0].blockId] }]);
    const result = await loadRobotGame(row.id, false); expect(result?.levels[0].completed).toBe(true); expect(result?.levels[1].completed).toBe(false);
    expect(m.progress.mock.calls[0][0].where.userId).toBe("student");
  });
});
describe("teacher AI hint access", () => {
  it("uses the shared audited provider and clearly labels mock mode", async () => {
    const { p } = fixture(); const result = await generateProgrammingHints({ locale: "zh", payload: p.levels[0].payload });
    expect(result).toMatchObject({ ok: true, mock: true }); expect(m.generate.mock.calls[0][2]).toMatchObject({ usage: "programming-hints", userId: "teacher" });
  });
  it("rejects another teacher's course or learner calls before generation", async () => {
    const { p, row } = fixture(); row.createdById = "other"; m.find.mockResolvedValue(row);
    expect(await generateProgrammingHints({ courseId: row.id, locale: "en", payload: p.levels[0].payload })).toMatchObject({ ok: false });
    m.auth.mockResolvedValue({ user: { id: "student", role: "LEARNER" } });
    expect(await generateProgrammingHints({ locale: "en", payload: p.levels[0].payload })).toMatchObject({ ok: false }); expect(m.generate).not.toHaveBeenCalled();
  });
  it("does not send an invalid reference to the model", async () => {
    const { p } = fixture(); p.levels[0].payload.allowed = [];
    expect(await generateProgrammingHints({ locale: "en", payload: p.levels[0].payload })).toMatchObject({ ok: false }); expect(m.generate).not.toHaveBeenCalled();
  });
});
