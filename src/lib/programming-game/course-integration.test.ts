import { describe, expect, it } from "vitest";
import { blockSchema, type Block } from "@/lib/blocks/schema";
import { gradeActivity } from "@/lib/blocks/activity-result";
import { createProgrammingPayload } from "./config";
import { courseProgrammingPayloadSchema, courseProgrammingVersion } from "./course-config";
import { createParallelProgrammingPayload } from "./parallel-config";
import { configureParallelTemplate, PARALLEL_TEMPLATES } from "./parallel-levels";
import { PARALLEL_FEEDBACK_BYTES } from "./parallel-grade";
import { readParallelHistory } from "./parallel-history";
function block(id = "parallel-lanes" as typeof PARALLEL_TEMPLATES[number]["id"], n = 2): Block {
  return { id: "game", title: "Robots", type: "game", payload: createParallelProgrammingPayload(id, "en", n) };
}
function record(b = block(), program: unknown = configureParallelTemplate("parallel-lanes", 2).reference) {
  const answer = { program }; return { answer, ...gradeActivity(b, answer) };
}
describe("formal v2 programming course contract", () => {
  for (const t of PARALLEL_TEMPLATES) for (const n of [1, 2, 3, 4]) it(`saves and grades ${t.id} with ${n} robot(s)`, () => {
    const b = blockSchema.parse(block(t.id, n)), grade = gradeActivity(b, { program: configureParallelTemplate(t.id, n).reference, passed: false, score: -99 });
    expect(grade).toMatchObject({ completed: true, passed: true, verification: "server", score: { raw: 100 }, feedback: { feedbackVersion: 2, rulesVersion: 2, levelSnapshot: { rulesVersion: 2 }, robots: expect.arrayContaining([expect.objectContaining({ id: expect.any(String), position: expect.any(Object), cursor: expect.any(Number), status: "ended", last: expect.any(Object), blocked: null, error: null, attempts: expect.any(Number), successfulMoves: expect.any(Number), loopIterations: expect.any(Number) })]) } });
    expect((grade.feedback.robots as unknown[])).toHaveLength(n);
  });
  it("accepts a different working solution rather than matching the reference answer", () => {
    expect(gradeActivity(block(), { program: Array.from({ length: 4 }, () => ({ op: "right" })) }).completed).toBe(true);
  });
  it.each([[{ op: "left" }], [{ op: "right" }], [{ op: "end" }]])("ignores forged client success and positions for a failed program %j", (...program) => {
    const grade = gradeActivity(block(), { program, passed: true, completed: true, score: 100, rulesVersion: 1, robots: [{ position: { x: 4, y: 0 } }] });
    expect(grade).toMatchObject({ score: { raw: 0 }, completed: false, passed: false });
  });
  it.each([{ program: [] }, { program: "alert(1)" }, { program: [{ op: "pickup" }] }, { program: [{ op: "repeat", count: 21, body: [{ op: "right" }] }] }])("rejects invalid input without a normal grade $program", ({ program }) => {
    expect(() => gradeActivity(block(), { program })).toThrow();
  });
  it("records loop-budget failure as a normal failed attempt", () => {
    const grade = gradeActivity(block("parallel-jump-route"), { program: [{ op: "label", id: "A" }, { op: "jump", target: "A" }] });
    expect(grade).toMatchObject({ completed: false, feedback: { failure: { code: "TICK_LIMIT" }, worldTicks: 1000 } });
  });
  it.each([0, 3, "2", null])("rejects explicit unsupported version %j even with a legacy template", (rulesVersion) => {
    expect(courseProgrammingPayloadSchema.safeParse({ ...createProgrammingPayload("first-route", "en"), rulesVersion }).success).toBe(false);
  });
  it("rejects a v2 template with missing rules version rather than treating it as v1", () => {
    const p: Record<string, unknown> = { ...createParallelProgrammingPayload("parallel-lanes", "en") };
    delete p.rulesVersion;
    expect(courseProgrammingPayloadSchema.safeParse(p).success).toBe(false);
  });
  it.each([
    ["first-route", "ce55516a71351f9d6987f387de37c77c407e85c9b1f772cb3fc380d0a2d238a5"],
    ["parcel-delivery", "a7603361377af0b914c7117039b13ea25cbf91cfa0386f00d85ec95364bc495c"],
    ["repeat-route", "f0797985b68ca9508090c1df277f035103f70509a5b06ba023271f345459571e"],
  ] as const)("preserves fixed v1 hash for %s, with absent or explicit version 1", async (id, hash) => {
    const p = createProgrammingPayload(id, "en");
    expect(await courseProgrammingVersion(p)).toBe(hash);
    expect(await courseProgrammingVersion(courseProgrammingPayloadSchema.parse({ ...p, rulesVersion: 1 }))).toBe(hash);
  });
  it("keeps maximal CJK teaching content and per-robot feedback within the event budget", () => {
    const p = { ...createParallelProgrammingPayload("parallel-lanes", "zh", 4), task: "汉".repeat(4000), hints: Array(12).fill("汉".repeat(2000)), knowledge: Array.from({ length: 12 }, () => ({ title: "汉".repeat(120), body: "汉".repeat(4000) })) };
    const grade = gradeActivity({ id: "g", title: "Game", type: "game", payload: p }, { program: [{ op: "left" }] });
    expect(new TextEncoder().encode(JSON.stringify({ ...grade.feedback, levelVersion: "0".repeat(64) })).length).toBeLessThanOrEqual(PARALLEL_FEEDBACK_BYTES);
    expect(grade.feedback).not.toHaveProperty("instructions"); expect(grade.feedback).not.toHaveProperty("trace");
  });
});
describe("snapshot history decoding", () => {
  it("reads the recorded map and program without using the current template", () => {
    const r = record(); r.feedback.levelVersion = "a".repeat(64);
    (r.feedback.levelSnapshot as { id: string }).id = "retired-template-r1";
    const decoded = readParallelHistory(r)!;
    expect(decoded.level.id).toBe("retired-template-r1"); expect(decoded.feedback.robots).toHaveLength(2);
    expect(decoded.feedback.worldTicks).toBe(4);
  });
  it.each([{ feedbackVersion: 99 }, { rulesVersion: 3 }, { robots: [] }, { levelSnapshot: null }, { worldTicks: -1 }])("does not reinterpret corrupt/unknown history %j", (change) => {
    const r = record(); r.feedback.levelVersion = "a".repeat(64); Object.assign(r.feedback, change);
    expect(readParallelHistory(r)).toBeNull();
  });
  it("rejects an unknown shared envelope version without interpreting the grade", () => {
    const r = { ...record(), version: 99 }; r.feedback.levelVersion = "a".repeat(64);
    expect(readParallelHistory(r)).toBeNull();
  });
  it("rejects duplicate robot identities and out-of-map positions in history", () => {
    const r = record(); r.feedback.levelVersion = "a".repeat(64);
    const robots = r.feedback.robots as { id: string; position: { x: number; y: number } }[];
    robots[1].id = robots[0].id; expect(readParallelHistory(r)).toBeNull();
    robots[1].id = "b"; robots[1].position.x = 11; expect(readParallelHistory(r)).toBeNull();
  });
});
