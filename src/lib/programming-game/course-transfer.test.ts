import { describe, expect, it, vi } from "vitest";
import { createRobotCourseDraft, robotCourseDraftSchema } from "./robot-course";
import { exportRobotCourse, importRobotCourse, ROBOT_COURSE_FILE_LIMIT } from "./course-transfer";
import { createDeliveryPayload } from "./delivery-level";
import { createNumericDeliveryPayload } from "./numeric-delivery";
import { parallelProgrammingLevel, parallelProgrammingReference } from "./parallel-config";
import * as engine from "./parallel-engine";
let seq = 0;
const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
function example() {
  const d = createRobotCourseDraft("zh", id);
  d.status = "PUBLISHED"; d.updatedAt = "2026-11-06T00:00:00.000Z";
  d.levels[0].payload = { ...createNumericDeliveryPayload("zh"), tutorial: true };
  d.levels[1].payload = createDeliveryPayload("zh");
  d.levels[0].payload.teaching = { version: 1, concepts: "学习 if 与 loop", pseudocode: "重复执行\n  如果有物品：拾取" };
  return d;
}
describe("robot course transfer", () => {
  it("round-trips every level and teaching field, freezing preset maps and answers", () => {
    const source = example(), imported = importRobotCourse(exportRobotCourse(source), id);
    expect(imported.levels).toHaveLength(source.levels.length);
    for (const [i, level] of imported.levels.entries()) {
      expect(level.title).toBe(source.levels[i].title);
      expect(level.payload).toEqual({ ...source.levels[i].payload, customLevel: parallelProgrammingLevel(source.levels[i].payload), referenceProgram: parallelProgrammingReference(source.levels[i].payload) });
    }
    expect(robotCourseDraftSchema.safeParse(imported).success).toBe(true);
  });
  it("creates a fresh unpublished course without identity or history leakage", () => {
    const source = example(), json = exportRobotCourse(source), file = JSON.parse(json);
    expect(file.course).not.toHaveProperty("status"); expect(file.course).not.toHaveProperty("updatedAt");
    expect(json).not.toContain(source.draftId);
    const a = importRobotCourse(json, id), b = importRobotCourse(json, id);
    expect(a.status).toBe("DRAFT"); expect(a.updatedAt).toBeUndefined(); expect(a.draftId).not.toBe(b.draftId);
    expect(a.levels[0].lessonId).not.toBe(source.levels[0].lessonId);
    expect(a.levels[0].blockId).not.toBe(source.levels[0].blockId);
    expect(source.status).toBe("PUBLISHED");
  });
  it("never executes references during export/import; authoritative save validation rejects incomplete solutions", () => {
    const source = example(); source.levels[0].payload.referenceProgram = [{ op: "end" }];
    const spy = vi.spyOn(engine, "executeParallelProgram");
    try {
      const imported = importRobotCourse(exportRobotCourse(source), id);
      expect(spy).not.toHaveBeenCalled(); expect(imported.levels[0].payload.referenceProgram).toEqual([{ op: "end" }]);
      expect(robotCourseDraftSchema.safeParse(imported).success).toBe(false);
    } finally { spy.mockRestore(); }
  });
  it.each(["bad json", "{}", '{"format":"other","version":1}', '{"format":"genai-robot-course","version":99}'])("rejects invalid or unknown formats %s", (json) => {
    expect(() => importRobotCourse(json, id)).toThrow();
  });
  it.each(["createdById", "draftId", "status", "updatedAt", "attempts"])("rejects database or runtime fields: %s", (key) => {
    const file = JSON.parse(exportRobotCourse(example())); file.course[key] = "injected";
    expect(() => importRobotCourse(JSON.stringify(file), id)).toThrow();
  });
  it("rejects invalid maps, unsupported rules, excess levels and wrong teaching versions", () => {
    for (const mutate of [
      (f: ReturnType<typeof JSON.parse>) => { f.course.levels[0].payload.customLevel.width = 999; },
      (f: ReturnType<typeof JSON.parse>) => { f.course.levels[0].payload.rulesVersion = 99; },
      (f: ReturnType<typeof JSON.parse>) => { f.course.levels = Array(21).fill(f.course.levels[0]); },
      (f: ReturnType<typeof JSON.parse>) => { f.course.levels[0].payload.teaching.version = 99; },
    ]) {
      const file = JSON.parse(exportRobotCourse(example())); mutate(file);
      expect(() => importRobotCourse(JSON.stringify(file), id)).toThrow();
    }
  });
  it("checks byte size before JSON parsing", () => {
    expect(() => importRobotCourse("中".repeat(ROBOT_COURSE_FILE_LIMIT / 2), id)).toThrow("2 MiB");
  });
});
