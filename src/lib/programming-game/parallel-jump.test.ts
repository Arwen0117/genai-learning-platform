import { describe, expect, it } from "vitest";
import { createParallelExecution, executeParallelProgram, stepParallelExecution, parseParallelProgram, PARALLEL_COMMANDS, type ParallelLevel, type ParallelProgram } from "./parallel-engine";
import { getParallelTemplate } from "./parallel-levels";

function level(overrides: Partial<ParallelLevel> = {}): ParallelLevel {
  return { id: "jump-test", rulesVersion: 2, width: 5, height: 3, walls: [],
    robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 0, y: 2 } }],
    goals: [{ x: 4, y: 0 }, { x: 4, y: 2 }], allowed: [...PARALLEL_COMMANDS], ...overrides };
}
describe("named jump destinations", () => {
  it("can jump forward over an invalid move to a named root marker", () => {
    const p: ParallelProgram = [{ op: "jump", target: "A" }, { op: "left" }, { op: "label", id: "A" }, { op: "repeat", count: 4, body: [{ op: "right" }] }];
    const s = executeParallelProgram(level(), p);
    expect(s.status).toBe("passed"); expect(s.worldTicks).toBe(6);
    expect(s.robots.map((r) => r.attempts)).toEqual([6, 6]);
    expect(s.nodeCount).toBe(5);
  });
  it("keeps marker IDs stable after preceding nodes are inserted", () => {
    const p: ParallelProgram = [{ op: "jump", target: "B" }, { op: "left" }, { op: "label", id: "B" }, { op: "wait" }];
    const a = executeParallelProgram(level(), p); const b = executeParallelProgram(level(), [{ op: "wait" }, ...p]);
    expect(a.errors).toEqual([]); expect(b.errors).toEqual([]);
    expect(b.worldTicks).toBe(a.worldTicks + 1);
  });
  it("spends one tick on a jump and one on a marker", () => {
    const p: ParallelProgram = [{ op: "jump", target: "A" }, { op: "label", id: "A" }];
    const first = stepParallelExecution(createParallelExecution(level(), p));
    expect(first.worldTicks).toBe(1); expect(first.robots.map((r) => r.cursor)).toEqual([1, 1]);
    expect(first.successfulMoves).toBe(0);
    expect(stepParallelExecution(first).worldTicks).toBe(2);
  });
  it("bounds backward loops rather than hanging or reporting movement deadlock", () => {
    const p: ParallelProgram = [{ op: "label", id: "A" }, { op: "jump", target: "A" }];
    const s = executeParallelProgram(level(), p, { ticks: 5 });
    expect(s.worldTicks).toBe(5); expect(s.failure).toEqual({ code: "TICK_LIMIT", tick: 6 });
    expect(s.instructionAttempts).toBe(10);
  });
  it("enforces the unchanged hard world limit on a backward jump", () => {
    const s = executeParallelProgram(level(), [{ op: "label", id: "A" }, { op: "jump", target: "A" }]);
    expect(s.worldTicks).toBe(1000); expect(s.instructionAttempts).toBe(2000);
    expect(s.failure).toEqual({ code: "TICK_LIMIT", tick: 1001 });
  });
  it("stops before an atomic jump tick exceeding the attempt budget", () => {
    const s = executeParallelProgram(level(), [{ op: "label", id: "A" }, { op: "jump", target: "A" }], { attempts: 3 });
    expect(s.worldTicks).toBe(1); expect(s.instructionAttempts).toBe(2);
    expect(s.failure?.code).toBe("ATTEMPT_LIMIT");
  });
  it("reproduces the named-jump teaching reference", () => {
    const t = getParallelTemplate("parallel-jump-route");
    const s = executeParallelProgram(t.level, t.reference);
    expect(s.status).toBe("passed"); expect(s.worldTicks).toBe(19);
    expect(s.instructionAttempts).toBe(30);
    let manual = createParallelExecution(t.level, t.reference);
    while (["ready", "paused"].includes(manual.status)) manual = stepParallelExecution(manual);
    expect(manual).toEqual(s);
  });
  it.each([true, false])("follows a jump inside the selected IF arm, NOT=%s", (not) => {
    const s = executeParallelProgram(level(), [
      { op: "if", condition: { kind: "goal", not },
        then: not ? [{ op: "jump", target: "A" }] : [{ op: "left" }],
        else: not ? [{ op: "left" }] : [{ op: "jump", target: "A" }] },
      { op: "left" }, { op: "label", id: "A" }, { op: "wait" },
    ]);
    expect(s.errors).toEqual([]); expect(s.worldTicks).toBe(4);
    expect(s.robots[0].position).toEqual({ x: 0, y: 0 });
  });
  it("can jump out of a repeat to a root marker", () => {
    const p: ParallelProgram = [{ op: "repeat", count: 20, body: [{ op: "jump", target: "A" }, { op: "left" }] }, { op: "label", id: "A" }, { op: "wait" }];
    const s = executeParallelProgram(level(), p);
    expect(s.worldTicks).toBe(3); expect(s.errors).toEqual([]);
    expect(s.robots[0].loopIterations).toBe(1);
  });
  it("allows a backward branch to re-enter a bounded repeat correctly", () => {
    const p: ParallelProgram = [{ op: "label", id: "A" }, { op: "repeat", count: 2, body: [{ op: "wait" }] }, { op: "jump", target: "A" }];
    const s = executeParallelProgram(level(), p, { ticks: 8 });
    expect(s.robots[0].loopIterations).toBe(4);
    expect(s.failure?.code).toBe("TICK_LIMIT");
  });
  it("rejects dangling targets and duplicate marker IDs before executing", () => {
    expect(() => executeParallelProgram(level(), [{ op: "jump", target: "A" }])).toThrow("MISSING_JUMP_TARGET");
    expect(() => executeParallelProgram(level(), [{ op: "label", id: "A" }, { op: "label", id: "A" }])).toThrow("DUPLICATE_LABEL");
  });
  it.each(["", "<script>", "A".repeat(17), 1, null])("rejects invalid marker ID or target %j", (id) => {
    expect(() => executeParallelProgram(level(), [{ op: "label", id }])).toThrow("INVALID_LABEL");
    expect(() => executeParallelProgram(level(), [{ op: "jump", target: id }])).toThrow("INVALID_JUMP_TARGET");
  });
  it("keeps markers at root; does not allow jumping to interior line numbers", () => {
    expect(() => parseParallelProgram([{ op: "repeat", count: 1, body: [{ op: "label", id: "A" }] }], level())).toThrow("INVALID_ACTION");
    expect(() => parseParallelProgram([{ op: "if", condition: { kind: "goal", not: false }, then: [{ op: "label", id: "A" }], else: [] }], level())).toThrow("INVALID_ACTION");
  });
  it("enforces capabilities and ignores forged compiled destinations", () => {
    expect(() => executeParallelProgram(level({ allowed: ["wait"] }), [{ op: "label", id: "A" }])).toThrow("DISALLOWED_LABEL");
    expect(() => executeParallelProgram(level({ allowed: ["label"] }), [{ op: "label", id: "A" }, { op: "jump", target: "A" }])).toThrow("DISALLOWED_JUMP");
    const s = executeParallelProgram(level(), [{ op: "jump", target: "A", jumpTo: -99 }, { op: "left" }, { op: "label", id: "A" }]);
    expect(s.errors).toEqual([]); expect(s.worldTicks).toBe(2);
  });
});
