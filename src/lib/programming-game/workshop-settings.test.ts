import { describe, expect, it } from "vitest";
import { PARALLEL_TEMPLATES, getParallelTemplate, configureParallelTemplate } from "./parallel-levels";
import { executeParallelProgram, parseParallelLevel } from "./parallel-engine";
import { createWorkshopSettings, parseWorkshopSettings } from "./workshop-settings";

describe("unified workshop levels", () => {
  for (const t of PARALLEL_TEMPLATES) for (const count of [1, 2, 3, 4])
    it(`${t.id} has a valid answer with ${count} robot(s)`, () => {
      const configured = configureParallelTemplate(t.id, count);
      expect(configured.level.robots).toHaveLength(count);
      expect(executeParallelProgram(configured.level, configured.reference).status).toBe("passed");
      expect(configured.hints.en.length).toBeGreaterThan(0);
      expect(configured.hints.zh.length).toBeGreaterThan(0);
      expect(parseParallelLevel(configured.level)).toEqual(configured.level);
    });
  it("keeps existing two-robot templates and their goals unchanged", () => {
    for (const t of PARALLEL_TEMPLATES)
      expect(configureParallelTemplate(t.id, 2).level).toEqual(getParallelTemplate(t.id).level);
  });
  it("does not mutate defaults or couple consecutive teacher previews", () => {
    const one = configureParallelTemplate("parallel-conditional-route", 1);
    one.hints.zh[0] = "changed"; one.level.robots[0].start.x = 4;
    const four = configureParallelTemplate("parallel-conditional-route", 4);
    expect(four.hints.zh[0]).not.toBe("changed"); expect(four.level.robots[0].start.x).toBe(0);
    expect(getParallelTemplate("parallel-conditional-route").level.robots).toHaveLength(2);
  });
  it.each([0, 5, 1.5, "1", null])("rejects invalid teacher robot count %j", (count) => {
    expect(() => configureParallelTemplate("parallel-lanes", count)).toThrow("INVALID_ROBOT_COUNT");
  });
  it("uses the same IF/jump semantics for one robot", () => {
    const t = configureParallelTemplate("parallel-jump-route", 1);
    const s = executeParallelProgram(t.level, t.reference);
    expect(s.status).toBe("passed"); expect(s.worldTicks).toBe(19);
    expect(s.robots[0].position).toEqual({ x: 4, y: 0 });
  });
});

describe("teacher workshop settings drafts", () => {
  it("roundtrips bounded task, hints, knowledge and count", () => {
    const s = { ...createWorkshopSettings("parallel-lanes", "zh"), robotCount: 1, task: "任务", hints: ["提示"], knowledge: [{ title: "知识", body: "讲解" }] };
    expect(parseWorkshopSettings(JSON.parse(JSON.stringify(s)), "parallel-lanes", "zh")).toEqual(s);
  });
  it.each([
    { robotCount: 0 }, { robotCount: 5 }, { robotCount: 1.5 }, { version: 9 }, { task: "" },
    { hints: Array(13).fill("a") }, { hints: ["a".repeat(2001)] },
    { knowledge: [{ title: "a", body: "a".repeat(4001) }] },
  ])("rejects malformed or oversized saved data %j", (overrides) => {
    expect(() => parseWorkshopSettings({ ...createWorkshopSettings("parallel-lanes", "en"), ...overrides }, "parallel-lanes", "en")).toThrow();
  });
  it("rejects cross-level/cross-language drafts without replacing current content", () => {
    const current = createWorkshopSettings("parallel-lanes", "en");
    expect(() => parseWorkshopSettings(current, "parallel-queue", "en")).toThrow();
    expect(() => parseWorkshopSettings(current, "parallel-lanes", "zh")).toThrow();
    expect(current.templateId).toBe("parallel-lanes");
  });
});
