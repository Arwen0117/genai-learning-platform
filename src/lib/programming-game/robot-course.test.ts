import { describe, expect, it, vi } from "vitest";
import { createParallelProgrammingPayload, parallelProgrammingEditingSchema, parallelProgrammingPayloadSchema, parallelProgrammingLevel, parallelProgrammingReference, parallelProgrammingVersion } from "./parallel-config";
import { createRobotCourseDraft, robotCourseEditingSchema, robotCourseDraftSchema, isRobotCourse } from "./robot-course";
import * as parallelEngine from "./parallel-engine";
import { gradeParallelProgramming } from "./parallel-grade";
import { programmingHintsSchema, programmingHintsPrompt, mockProgrammingHints } from "@/lib/llm/prompts/programming-hints";
const custom = () => ({ ...createParallelProgrammingPayload("parallel-lanes", "en", 1), allowed: ["right", "repeat"] as ("right" | "repeat")[],
  customLevel: { id: "teacher-map", rulesVersion: 2 as const, width: 3, height: 2, walls: [{ x: 1, y: 1 }], goals: [{ x: 2, y: 0 }], robots: [{ id: "a", start: { x: 0, y: 0 } }], allowed: ["right", "repeat"] as ("right" | "repeat")[] },
  referenceProgram: [{ op: "repeat" as const, count: 2, body: [{ op: "right" as const }] }],
});
// Stable UUIDs without relying on a server/client random draw during rendering.
let seq = 0; const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
describe("custom maps and teacher answers", () => {
  it("validates a custom map and teacher reference answer", () => {
    const p = parallelProgrammingPayloadSchema.parse(custom());
    expect(parallelProgrammingLevel(p).id).toBe("teacher-map"); expect(parallelProgrammingReference(p)).toEqual(custom().referenceProgram);
    expect(gradeParallelProgramming(p, { program: [{ op: "right" }, { op: "right" }] })).toMatchObject({ completed: true, score: { raw: 100 }, feedback: { levelSnapshot: { id: "teacher-map" } } });
  });
  it.each(["map", "answer"])("rejects an unpaired custom %s", (part) => {
    const p: Record<string, unknown> = { ...custom() }; delete p[part === "map" ? "referenceProgram" : "customLevel"];
    expect(parallelProgrammingPayloadSchema.safeParse(p).success).toBe(false);
  });
  it("rejects a teacher reference answer that does not actually pass", () => {
    const p = custom(); expect(parallelProgrammingPayloadSchema.safeParse({ ...p, referenceProgram: [{ op: "right" }] }).success).toBe(false);
  });
  it.each([{ width: 13 }, { height: 0 }, { walls: [{ x: 2, y: 0 }] }, { robots: [] }, { robots: [{ id: "a", start: { x: 3, y: 0 } }] }, { goals: [] }])("rejects invalid custom geometry %j", (change) => {
    const p = custom(); expect(parallelProgrammingPayloadSchema.safeParse({ ...p, customLevel: { ...p.customLevel, ...change } }).success).toBe(false);
  });
  it("rejects mismatched robot counts or commands", () => {
    expect(parallelProgrammingPayloadSchema.safeParse({ ...custom(), robotCount: 2 }).success).toBe(false);
    expect(parallelProgrammingPayloadSchema.safeParse({ ...custom(), allowed: ["right"] }).success).toBe(false);
  });
  it("normalizes map/program data before persistence, dropping arbitrary extra runtime keys", () => {
    const p = custom(); const result = parallelProgrammingPayloadSchema.parse({ ...p, customLevel: { ...p.customLevel, passed: true }, referenceProgram: [{ op: "repeat", count: 2, body: [{ op: "right", arbitrary: "x".repeat(10000) }] }] });
    expect(result.customLevel).not.toHaveProperty("passed"); expect(JSON.stringify(result.referenceProgram)).not.toContain("arbitrary");
  });
  it("binds custom reference and map revisions into the hash", async () => {
    const p = parallelProgrammingPayloadSchema.parse(custom()), hash = await parallelProgrammingVersion(p);
    expect(await parallelProgrammingVersion({ ...p, referenceProgram: [{ op: "right" }, { op: "right" }] })).not.toBe(hash);
    const changed = { ...p, customLevel: { ...p.customLevel!, goals: [{ x: 1, y: 0 }] }, referenceProgram: [{ op: "right" as const }] };
    expect(await parallelProgrammingVersion(changed)).not.toBe(hash);
  });
  it.each([["parallel-lanes", "8d17656497bec3dab47abbe31dfc23deb1f9e5f6791926b6299ddc4d854649c7"], ["parallel-goal-guard", "8280efe1d8a29e11aef3aecca306d9e9b08f174c5ff3045f67ba93670fa20281"]] as const)("preserves published preset hash %s", async (templateId, hash) => {
    expect(await parallelProgrammingVersion(createParallelProgrammingPayload(templateId, "en"))).toBe(hash);
  });
});
describe("standalone game course contract", () => {
  it("creates a separate seven-level course draft with stable unique identities", () => {
    const d = createRobotCourseDraft("zh", id); expect(robotCourseDraftSchema.safeParse(d).success).toBe(true); expect(d.levels).toHaveLength(7);
    expect(new Set(d.levels.map((l) => l.lessonId)).size).toBe(7);
    expect(isRobotCourse({ slug: "robot-game-example", topic: "Robot programming" })).toBe(true);
    expect(isRobotCourse({ slug: "ordinary-course", topic: "Robot programming" })).toBe(false);
  });
  it("rejects duplicate level or block identities, oversized lists and unknown fields", () => {
    const d = createRobotCourseDraft("en", id);
    for (const levels of [[d.levels[0], d.levels[0]], Array(21).fill(d.levels[0])]) expect(robotCourseDraftSchema.safeParse({ ...d, levels }).success).toBe(false);
    expect(robotCourseDraftSchema.safeParse({ ...d, createdById: "someone-else" }).success).toBe(false);
  });
});
describe("AI hint constraints", () => {
  it("provides the validated geometry/reference and requested language as data", () => {
    const prompt = JSON.parse(programmingHintsPrompt(parallelProgrammingPayloadSchema.parse(custom()), "zh"));
    expect(prompt.locale).toBe("zh"); expect(prompt.level.id).toBe("teacher-map"); expect(prompt.reference).toEqual(custom().referenceProgram);
  });
  it("marks no-key hints as mock and bounds all model output", () => {
    const result = mockProgrammingHints('{"locale":"en"}'); expect(result.hints.every((h) => h.startsWith("[MOCK]"))).toBe(true);
    expect(programmingHintsSchema.safeParse(result).success).toBe(true);
    expect(programmingHintsSchema.safeParse({ hints: ["x".repeat(501)] }).success).toBe(false);
    expect(programmingHintsSchema.safeParse({ hints: ["ok"], program: [] }).success).toBe(false);
  });
});

describe("manual teacher verification boundaries", () => {
  it("does not simulate while checking drafts, rendering levels, or hashing", async () => {
    const spy = vi.spyOn(parallelEngine, "executeParallelProgram");
    try {
      const p = { ...custom(), referenceProgram: [{ op: "right" as const }] };
      const draft = createRobotCourseDraft("en", id); draft.levels[0].payload = p;
      expect(parallelProgrammingEditingSchema.safeParse(p).success).toBe(true);
      expect(robotCourseEditingSchema.safeParse(draft).success).toBe(true);
      parallelProgrammingLevel(p); parallelProgrammingReference(p); await parallelProgrammingVersion(p);
      expect(spy).not.toHaveBeenCalled();
      expect(robotCourseDraftSchema.safeParse(draft).success).toBe(false);
      expect(spy).toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
  it("still rejects malformed map geometry and duplicate course IDs during editing", () => {
    const p = custom();
    expect(parallelProgrammingEditingSchema.safeParse({ ...p, customLevel: { ...p.customLevel, goals: [] } }).success).toBe(false);
    const d = createRobotCourseDraft("en", id);
    expect(robotCourseEditingSchema.safeParse({ ...d, levels: [d.levels[0], d.levels[0]] }).success).toBe(false);
  });
});
