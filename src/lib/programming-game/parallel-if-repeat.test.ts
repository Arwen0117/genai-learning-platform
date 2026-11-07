import { describe, expect, it } from "vitest";
import { executeParallelProgram, parseParallelProgram, type ParallelProgram, type ParallelLevel } from "./parallel-engine";
import { insertParallelCommand, moveParallelCommand, getParallelEditorList } from "./parallel-editor";
import { createParallelProgrammingPayload, parallelProgrammingPayloadSchema } from "./parallel-config";
import { gradeParallelProgramming } from "./parallel-grade";
import { buildProgrammingTeaching } from "./teaching";
const level: ParallelLevel = { id: "if-loop", rulesVersion: 2, width: 4, height: 2, walls: [], goals: [{ x: 3, y: 0 }], robots: [{ id: "a", start: { x: 0, y: 0 } }], allowed: ["if", "repeat", "right", "wait", "end", "label", "jump"] };
const loop = { op: "repeat" as const, count: 3, body: [{ op: "right" as const }] };
const choose = (test: boolean, then: ParallelProgram, otherwise: ParallelProgram = []): ParallelProgram => [{ op: "if", condition: { kind: "boundary", direction: "up", not: !test }, then, else: otherwise }];
describe("IF branch repeat and jump", () => {
  it("round-trips the reference answer, grades it on the server and generates pseudocode", () => {
    const program = choose(true, [loop]);
    const payload = parallelProgrammingPayloadSchema.parse({ ...createParallelProgrammingPayload("parallel-lanes", "zh", 1), allowed: level.allowed, customLevel: level, referenceProgram: program });
    const restored = parallelProgrammingPayloadSchema.parse(JSON.parse(JSON.stringify(payload)));
    expect(restored.referenceProgram).toEqual(program);
    expect(gradeParallelProgramming(restored, { program })).toMatchObject({ passed: true, completed: true });
    expect(buildProgrammingTeaching(level, program, "zh").pseudocode).toContain("重复 3 次");
  });
  it.each([true, false])("runs a repeat in selected branch %s and skips the other arm", test => {
    const p = choose(test, test ? [loop] : [{ op: "end" }], test ? [{ op: "end" }] : [loop]);
    expect(executeParallelProgram(level, p)).toMatchObject({ status: "passed", worldTicks: 4 });
  });
  it("jumps out of a branch repeat to a root marker and skips its remaining iterations", () => {
    const p: ParallelProgram = [...choose(true, [{ ...loop, body: [{ op: "jump", target: "A" }, { op: "end" }] }]), { op: "end" }, { op: "label", id: "A" }, loop];
    expect(executeParallelProgram(level, p)).toMatchObject({ status: "passed", worldTicks: 6 });
  });
  it("skips the outer ELSE after a repeated nested IF with an empty false arm", () => {
    const p = choose(true, [{ ...loop, body: [...choose(false, [{ op: "end" }]), { op: "right" }] }], [{ op: "end" }]);
    expect(executeParallelProgram(level, p)).toMatchObject({ status: "passed", worldTicks: 7 });
  });
  it("edits inside a branch repeat and moves the whole block without copying it", () => {
    const p: ParallelProgram = [...choose(true, [{ op: "wait" }]), loop];
    const moved = moveParallelCommand(p, level.allowed, [1], 0, [0, 1])!;
    expect(getParallelEditorList(moved, [0, 1, 0])).toEqual(loop.body);
    expect(insertParallelCommand(moved, level.allowed, "jump", 1, [0, 1, 0])).not.toBeNull();
    expect(insertParallelCommand(moved, level.allowed, "repeat", 1, [0, 1, 0])).toBeNull();
    expect(moveParallelCommand([...moved, loop], level.allowed, [1], 0, [0, 1, 0])).toBeNull();
  });
  it("validates unused branches, capabilities and missing jump labels", () => {
    expect(() => parseParallelProgram(choose(true, [loop]), { ...level, allowed: level.allowed.filter(op => op !== "repeat") })).toThrow("DISALLOWED_REPEAT");
    expect(() => parseParallelProgram(choose(true, [loop], [{ op: "jump", target: "MISSING" }]), level)).toThrow("MISSING_JUMP_TARGET");
    expect(() => parseParallelProgram(choose(true, [{ ...loop, body: choose(true, [loop]) }]), level)).toThrow("INVALID_ACTION");
  });
});
