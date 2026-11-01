import { describe, expect, it } from "vitest";
import {
  createParallelExecution, executeParallelProgram, stepParallelExecution,
  parseParallelProgram, observeParallelCondition, PARALLEL_COMMANDS,
  type ParallelCondition, type ParallelLevel, type ParallelProgram,
} from "./parallel-engine";
import { getParallelTemplate } from "./parallel-levels";

const condition: ParallelCondition = { kind: "wall", direction: "right", not: false };
const choose: ParallelProgram = [{ op: "if", condition, then: [{ op: "up" }], else: [] }];
function level(overrides: Partial<ParallelLevel> = {}): ParallelLevel {
  return { id: "conditional-test", rulesVersion: 2, width: 5, height: 3,
    walls: [{ x: 1, y: 2 }], robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 0, y: 2 } }],
    goals: [{ x: 4, y: 0 }, { x: 4, y: 1 }], allowed: [...PARALLEL_COMMANDS], ...overrides };
}
describe("local observations and IF timing", () => {
  it("uses one tick for each IF, then diverges on the same program", () => {
    const p: ParallelProgram = [...choose, { op: "repeat", count: 4, body: [{ op: "right" }] }];
    const first = stepParallelExecution(createParallelExecution(level(), p));
    expect(first.robots.map((r) => r.position)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 2 }]);
    expect(first.robots.map((r) => r.decision?.result)).toEqual([false, true]);
    expect(first.robots[0].cursor).not.toBe(first.robots[1].cursor);
    const second = stepParallelExecution(first);
    expect(second.robots.map((r) => r.position)).toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    const final = executeParallelProgram(level(), p);
    expect(final.status).toBe("passed"); expect(final.worldTicks).toBe(6);
    expect(final.instructionAttempts).toBe(11); expect(final.nodeCount).toBe(4);
    let stepped = createParallelExecution(level(), p);
    while (["ready", "paused"].includes(stepped.status)) stepped = stepParallelExecution(stepped);
    expect(stepped).toEqual(final);
  });
  it("executes only the chosen arm and skips the other arm without extra ticks", () => {
    const p: ParallelProgram = [{ op: "if", condition, then: [{ op: "up" }], else: [{ op: "right" }] }, { op: "wait" }];
    const s = executeParallelProgram(level(), p);
    expect(s.worldTicks).toBe(3); expect(s.instructionAttempts).toBe(6);
    expect(s.robots.map((r) => r.position)).toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
  });
  it("can end at the false arm of a final IF with an empty ELSE", () => {
    const s = executeParallelProgram(level({ walls: [] }), choose);
    expect(s.worldTicks).toBe(1); expect(s.robots.every((r) => r.status === "ended")).toBe(true);
  });
  it("IF consumes a tick but does not falsely cause movement deadlock", () => {
    const s = stepParallelExecution(createParallelExecution(level(), [...choose, { op: "wait" }]));
    expect(s.status).toBe("paused"); expect(s.successfulMoves).toBe(0);
  });
  it("distinguishes boundary, wall and another robot, including NOT", () => {
    const s = createParallelExecution(level(), choose); const a = s.robots[0]; const b = s.robots[1];
    expect(observeParallelCondition(s.level, s.robots, a, { kind: "boundary", direction: "up", not: false })).toBe(true);
    expect(observeParallelCondition(s.level, s.robots, a, { kind: "wall", direction: "up", not: false })).toBe(false);
    expect(observeParallelCondition(s.level, s.robots, b, condition)).toBe(true);
    expect(observeParallelCondition(s.level, s.robots, b, { ...condition, not: true })).toBe(false);
    expect(observeParallelCondition(s.level, s.robots, a, { kind: "goal", not: true })).toBe(true);
  });
  it("reads old occupancy even when that occupant successfully leaves in the same tick", () => {
    const l = level({ walls: [], robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 1, y: 0 } }] });
    const p: ParallelProgram = [{ op: "if", condition: { kind: "robot", direction: "right", not: false }, then: [{ op: "wait" }], else: [] }, { op: "right" }];
    const initial = createParallelExecution(l, p);
    // Isolate an asynchronous runtime: a judges while b moves.
    const s = stepParallelExecution({ ...initial, robots: initial.robots.map((r) => r.id === "b" ? { ...r, cursor: 2 } : r) });
    expect(s.robots[0].decision?.result).toBe(true);
    expect(s.robots[1].position.x).toBe(2);
  });
  it("keeps ended robots observable as occupied cells", () => {
    const s = createParallelExecution(level(), choose);
    const robots = [{ ...s.robots[0], position: { x: 0, y: 1 } }, { ...s.robots[1], status: "ended" as const }];
    expect(observeParallelCondition(s.level, robots, robots[0], { kind: "robot", direction: "down", not: false })).toBe(true);
  });
  it("retains a fresh decision snapshot without mutating previous ticks or inputs", () => {
    const s = createParallelExecution(level(), choose); const before = JSON.stringify(s);
    const next = stepParallelExecution(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(next.robots[1].decision).toMatchObject({ tick: 1, result: true, at: { path: [0], iteration: null } });
    expect(condition).toEqual({ kind: "wall", direction: "right", not: false });
  });
  it("supports IF inside repeat and preserves loop/path accounting", () => {
    const t = getParallelTemplate("parallel-goal-guard");
    const s = executeParallelProgram(t.level, t.reference);
    expect(s.status).toBe("passed"); expect(s.worldTicks).toBe(8);
    expect(s.robots.map((r) => r.loopIterations)).toEqual([4, 4]);
    expect(s.successfulMoves).toBe(6);
    expect(s.robots[1].decision?.at.path).toEqual([0, 0]);
    expect(s.robots[1].decision?.at.iteration).toBe(4);
  });
  it("reproduces conditional outcomes after robot input order changes", () => {
    const l = level();
    expect(executeParallelProgram({ ...l, robots: [...l.robots].reverse() }, choose)).toEqual(executeParallelProgram(l, choose));
  });
  it("budget checks still reserve the entire IF tick before any judgment", () => {
    const s = executeParallelProgram(level(), choose, { attempts: 1 });
    expect(s.worldTicks).toBe(0); expect(s.failure?.code).toBe("ATTEMPT_LIMIT");
    expect(s.robots.every((r) => !r.decision)).toBe(true);
  });
  it("reaches a real contention deadlock from a shared conditional program", () => {
    const l = level({ width: 3, height: 2, walls: [],
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 2, y: 0 } }],
      goals: [{ x: 0, y: 1 }, { x: 2, y: 1 }],
    });
    const s = executeParallelProgram(l, [{ op: "if", condition: { kind: "boundary", direction: "right", not: false }, then: [{ op: "left" }], else: [{ op: "right" }] }]);
    expect(s.worldTicks).toBe(2); expect(s.failure?.code).toBe("DEADLOCK");
    expect(s.robots.map((r) => r.blocked?.reason)).toEqual(["CONTENDED", "CONTENDED"]);
  });
  it("accepts an alternative goal-guard solution with empty ELSE and different work", () => {
    const t = getParallelTemplate("parallel-goal-guard");
    const alternative: ParallelProgram = [{ op: "repeat", count: 4, body: [{ op: "if", condition: { kind: "goal", not: true }, then: [{ op: "right" }], else: [] }] }];
    const s = executeParallelProgram(t.level, alternative);
    expect(s.status).toBe("passed"); expect(s.worldTicks).toBe(8);
    expect(s.instructionAttempts).toBe(14);
    expect(s.robots[1].attempts).toBe(6);
  });
  it("END in a selected branch ends only that robot", () => {
    const s = executeParallelProgram(level(), [{ op: "if", condition, then: [{ op: "end" }], else: [{ op: "wait" }] }, { op: "right" }]);
    expect(s.robots.map((r) => r.attempts)).toEqual([3, 2]);
    expect(s.robots[1].position).toEqual({ x: 0, y: 2 });
    expect(s.robots[0].position).toEqual({ x: 1, y: 0 });
  });
});

describe("conditional program validation", () => {
  it.each([null, {}, { kind: "id", not: false }, { kind: "wall", not: false },
    { kind: "wall", direction: "diagonal", not: false }, { kind: "goal", not: "yes" },
    { kind: "and", conditions: [condition], not: false }])("rejects malformed or unapproved condition %j", (bad) => {
    expect(() => parseParallelProgram([{ op: "if", condition: bad, then: [{ op: "wait" }], else: [] }], level())).toThrow("INVALID_CONDITION");
  });
  it("requires IF capability and a nonempty THEN; ELSE must be an array", () => {
    expect(() => parseParallelProgram(choose, level({ allowed: ["up"] }))).toThrow("DISALLOWED_IF");
    expect(() => parseParallelProgram([{ ...choose[0], then: [] }], level())).toThrow("INVALID_THEN_BODY");
    expect(() => parseParallelProgram([{ ...choose[0], else: null }], level())).toThrow("INVALID_ELSE_BODY");
  });
  it("rejects controls inside either arm without traversing cycles", () => {
    const cycle = { op: "if", condition, then: [] as unknown[], else: [] };
    cycle.then.push(cycle);
    expect(() => parseParallelProgram([cycle], level())).toThrow("INVALID_ACTION");
    expect(() => parseParallelProgram([{ ...choose[0], else: [{ op: "repeat", count: 2, body: [{ op: "wait" }] }] }], level())).toThrow("INVALID_ACTION");
  });
  it("validates both branches even if one will never be taken", () => {
    expect(() => parseParallelProgram([{ ...choose[0], else: [{ op: "teleport" }] }], level())).toThrow("INVALID_ACTION");
  });
  it("counts both branches toward the shared 80-node limit", () => {
    expect(() => parseParallelProgram([{ op: "if", condition, then: Array.from({ length: 40 }, () => ({ op: "wait" })), else: Array.from({ length: 40 }, () => ({ op: "wait" })) }], level())).toThrow("TOO_MANY_NODES");
  });
  it("returns branch-specific paths for errors", () => {
    const s = executeParallelProgram(level(), [{ op: "if", condition, then: [{ op: "right" }], else: [{ op: "left" }] }]);
    expect(s.errors.find((e) => e.robotId === "a")?.at.path).toEqual([0, 1, 0]);
    expect(s.errors.find((e) => e.robotId === "b")?.at.path).toEqual([0, 0, 0]);
  });
});
