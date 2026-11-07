import { describe, expect, it } from "vitest";
import { executeParallelProgram, parseParallelProgram, type ParallelProgram, type ParallelLevel } from "./parallel-engine";
import { insertParallelCommand, moveParallelCommand, parallelLabels } from "./parallel-editor";
import { createParallelProgrammingPayload, parallelProgrammingPayloadSchema } from "./parallel-config";
import { gradeParallelProgramming } from "./parallel-grade";
const level: ParallelLevel = { id: "if-label", rulesVersion: 2, width: 3, height: 2, walls: [], goals: [{ x: 1, y: 0 }], robots: [{ id: "a", start: { x: 0, y: 0 } }], allowed: ["if", "repeat", "right", "down", "wait", "end", "label", "jump"] };
const label = { op: "label" as const, id: "A" };
const choose = (test: boolean, then: ParallelProgram, otherwise: ParallelProgram = []): ParallelProgram => [{ op: "if", condition: { kind: "boundary", direction: "up", not: !test }, then, else: otherwise }];
describe("IF branch labels", () => {
  it.each([true, false])("executes selected branch markers and skips the other arm (%s)", test => {
    const selected: ParallelProgram = [label, { op: "right" }];
    const p = choose(test, test ? selected : [{ op: "down" }], test ? [{ op: "down" }] : selected);
    expect(executeParallelProgram(level, p)).toMatchObject({ status: "passed", worldTicks: 3 });
  });
  it.each([0, 1])("jumps directly into branch %s without evaluating its enclosing IF", arm => {
    const p: ParallelProgram = [{ op: "jump", target: "A" }, ...choose(arm === 1, arm === 0 ? [label, { op: "right" }] : [{ op: "end" }], arm === 1 ? [label, { op: "right" }] : [{ op: "down" }])];
    expect(executeParallelProgram(level, p)).toMatchObject({ status: "passed", worldTicks: 3 });
  });
  it("keeps backward branch jumps bounded", () => {
    const p = choose(true, [label, { op: "jump", target: "A" }]);
    expect(executeParallelProgram(level, p, { ticks: 8 })).toMatchObject({ status: "error", worldTicks: 8 });
  });
  it("collects deep branch labels, avoids name reuse and preserves jump targets when moving", () => {
    const p: ParallelProgram = [...choose(true, choose(true, [label]), [{ op: "label", id: "B" }]), { op: "jump", target: "A" }];
    expect(parallelLabels(p)).toEqual(["A", "B"]);
    expect(insertParallelCommand(p, level.allowed, "label", 0, [0, 1])?.[0]).toMatchObject({ else: [{ op: "label", id: "C" }, { op: "label", id: "B" }] });
    const moved = moveParallelCommand(p, level.allowed, [0, 0, 0, 0, 0], 0, [0, 1])!;
    expect(parallelLabels(moved)).toEqual(["A", "B"]);
    expect(moved[1]).toEqual({ op: "jump", target: "A" });
  });
  it("rejects duplicate labels across branches, missing targets and disallowed labels", () => {
    expect(() => parseParallelProgram(choose(true, [label], [label]), level)).toThrow("DUPLICATE_LABEL");
    expect(() => parseParallelProgram(choose(true, [label]), { ...level, allowed: level.allowed.filter(op => op !== "label") })).toThrow("DISALLOWED_LABEL");
    expect(() => parseParallelProgram(choose(true, [{ op: "jump", target: "A" }]), level)).toThrow("MISSING_JUMP_TARGET");
  });
  it("rejects markers in repeat descendants for clicks, moves and forged programs", () => {
    const p: ParallelProgram = [{ op: "repeat", count: 2, body: choose(true, [{ op: "wait" }]) }, ...choose(true, [label])];
    expect(insertParallelCommand(p, level.allowed, "label", 0, [0, 0, 0])).toBeNull();
    expect(moveParallelCommand(p, level.allowed, [1], 0, [0])).toBeNull();
    expect(() => parseParallelProgram([{ op: "repeat", count: 2, body: choose(true, [label]) }], level)).toThrow("INVALID_ACTION");
  });
  it("round-trips IF labels and grades the reference answer", () => {
    const program = choose(true, [label, { op: "right" }]);
    const payload = parallelProgrammingPayloadSchema.parse({ ...createParallelProgrammingPayload("parallel-lanes", "zh", 1), allowed: level.allowed, customLevel: level, referenceProgram: program });
    const restored = parallelProgrammingPayloadSchema.parse(JSON.parse(JSON.stringify(payload)));
    expect(restored.referenceProgram).toEqual(program);
    expect(gradeParallelProgramming(restored, { program })).toMatchObject({ passed: true });
  });
});
