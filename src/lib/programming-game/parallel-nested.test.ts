import { describe, expect, it } from "vitest";
import { createParallelExecution, executeParallelProgram, parseParallelProgram, stepParallelExecution, type ParallelCommand, type ParallelProgram, type ParallelLevel } from "./parallel-engine";
import { getParallelEditorList, insertParallelCommand, moveParallelCommand } from "./parallel-editor";
import { createParallelProgrammingPayload, parallelProgrammingPayloadSchema, parallelProgrammingVersion } from "./parallel-config";
import { gradeParallelProgramming } from "./parallel-grade";
import { readParallelHistory } from "./parallel-history";
const map: ParallelLevel = { id: "nested", rulesVersion: 2, width: 4, height: 2, walls: [], goals: [{ x: 1, y: 0 }], robots: [{ id: "a", start: { x: 0, y: 0 } }], allowed: ["if", "repeat", "right", "down", "up", "wait", "end", "label", "jump"] };
function choose(test: boolean, then: ParallelProgram, otherwise: ParallelProgram = []): ParallelCommand {
  return { op: "if", condition: { kind: "boundary", direction: "up", not: !test }, then, else: otherwise };
}
function chain(depth: number, leaf: ParallelProgram = [{ op: "right" }]): ParallelProgram {
  return depth ? [choose(true, chain(depth - 1, leaf))] : leaf;
}
describe("bounded nested IF", () => {
  it.each([true, false])("outer THEN exits skip outer ELSE when inner test is %s", (test) => {
    const p: ParallelProgram = [choose(true, [choose(test, [{ op: "right" }], [{ op: "wait" }])], [{ op: "down" }]), { op: "end" }];
    const result = executeParallelProgram(map, p);
    expect(result.robots[0].position).toEqual({ x: test ? 1 : 0, y: 0 });
    expect(result.worldTicks).toBe(4);
  });
  it("empty inner ELSE resumes after the outer IF without executing outer ELSE", () => {
    const p = [choose(true, [choose(false, [{ op: "down" }])], [{ op: "down" }]), { op: "right" as const }];
    expect(executeParallelProgram(map, p)).toMatchObject({ status: "passed", worldTicks: 3 });
  });
  it("skips an unselected nested tree without charging its ticks", () => {
    const p = [choose(false, chain(3), [{ op: "right" }])];
    expect(executeParallelProgram(map, p)).toMatchObject({ status: "passed", worldTicks: 2 });
  });
  it("supports ELSE nesting and sequential outer continuations", () => {
    const p = [choose(false, [{ op: "down" }], chain(3)), { op: "end" as const }];
    expect(executeParallelProgram(map, p)).toMatchObject({ status: "passed", worldTicks: 6 });
  });
  it("preserves control exits in each repetition", () => {
    const p: ParallelProgram = [{ op: "repeat", count: 2, body: [choose(true, [choose(false, [{ op: "down" }])], [{ op: "down" }]), { op: "right" }] }];
    const result = executeParallelProgram({ ...map, goals: [{ x: 2, y: 0 }] }, p);
    expect(result).toMatchObject({ status: "passed", worldTicks: 6 });
    expect(result.robots[0].loopIterations).toBe(2);
  });
  it("four levels work but a fifth fails before execution", () => {
    expect(executeParallelProgram(map, chain(4))).toMatchObject({ status: "passed", worldTicks: 5 });
    expect(() => parseParallelProgram(chain(5), map)).toThrow("IF_DEPTH_LIMIT");
  });
  it("bounds depth even in a branch that is never executed", () => {
    expect(() => parseParallelProgram([choose(false, chain(4))], map)).toThrow("IF_DEPTH_LIMIT");
  });
  it("keeps nested error paths and iteration for history diagnostics", () => {
    const p: ParallelProgram = [{ op: "repeat", count: 1, body: chain(4, [{ op: "up" }]) }];
    const result = executeParallelProgram(map, p);
    expect(result.errors[0].at).toEqual({ path: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], iteration: 1 });
  });
  it("single stepping and full execution agree", () => {
    const p = chain(4); let state = createParallelExecution(map, p);
    while (state.status === "ready" || state.status === "paused") state = stepParallelExecution(state);
    expect(state).toEqual(executeParallelProgram(map, p));
  });
  it("nested END stops the robot and nested jump retains its named destination", () => {
    expect(executeParallelProgram(map, chain(2, [{ op: "end" }]))).toMatchObject({ status: "incomplete", worldTicks: 3 });
    const p: ParallelProgram = [choose(true, [choose(true, [{ op: "jump", target: "A" }])], [{ op: "down" }]), { op: "down" }, { op: "label", id: "A" }, { op: "right" }];
    expect(executeParallelProgram(map, p)).toMatchObject({ status: "passed", worldTicks: 5 });
  });
  it("allows nested palette insertion and whole IF moves, but refuses excessive depth", () => {
    const p = chain(4), parent = [0, 0, 0, 0, 0, 0, 0, 0];
    expect(getParallelEditorList(p, parent)).toEqual([{ op: "right" }]);
    expect(insertParallelCommand(p, map.allowed, "if", 0, parent)).toBeNull();
    expect(insertParallelCommand(p, map.allowed, "wait", 0, parent)).not.toBeNull();
    expect(moveParallelCommand([...p, choose(true, [{ op: "right" }])], map.allowed, [1], 0, parent)).toBeNull();
    expect(moveParallelCommand([choose(true, []), ...chain(2)], map.allowed, [1], 0, [0, 0])).not.toBeNull();
  });
  it("grades custom nested answers and reads deep recorded errors without rerunning", async () => {
    const payload = parallelProgrammingPayloadSchema.parse({ ...createParallelProgrammingPayload("parallel-lanes", "en", 1), allowed: map.allowed, customLevel: map, referenceProgram: chain(4) });
    const program: ParallelProgram = [{ op: "repeat", count: 1, body: chain(4, [{ op: "up" }]) }];
    const grade = gradeParallelProgramming(payload, { program });
    const result = { version: 1, answer: { program }, feedback: { ...grade.feedback as object, levelVersion: await parallelProgrammingVersion(payload) } };
    expect(grade.completed).toBe(false);
    expect(readParallelHistory(result)?.feedback.errors[0].at.path).toHaveLength(10);
    expect(gradeParallelProgramming(payload, { program: chain(4) }).completed).toBe(true);
  });
});
