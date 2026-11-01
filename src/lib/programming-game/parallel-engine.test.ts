import { describe, expect, it } from "vitest";
import {
  PARALLEL_COMMANDS,
  PARALLEL_LIMITS,
  createParallelExecution,
  executeParallelProgram,
  parseParallelLevel,
  parseParallelProgram,
  resetParallelExecution,
  stepParallelExecution,
  type ParallelExecution,
  type ParallelLevel,
  type ParallelProgram,
} from "./parallel-engine";
import { getParallelTemplate, PARALLEL_TEMPLATES } from "./parallel-levels";
import { executeProgram } from "./engine";
import { TEMPLATES } from "./levels";

function level(overrides: Partial<ParallelLevel> = {}): ParallelLevel {
  return {
    id: "parallel-test", rulesVersion: 2, width: 5, height: 3, walls: [],
    robots: [
      { id: "a", start: { x: 0, y: 0 } },
      { id: "b", start: { x: 0, y: 2 } },
    ],
    goals: [{ x: 4, y: 0 }, { x: 4, y: 2 }],
    allowed: [...PARALLEL_COMMANDS], ...overrides,
  };
}
const route: ParallelProgram = [{ op: "repeat", count: 4, body: [{ op: "right" }] }];
const positions = (s: ParallelExecution) => s.robots.map((r) => r.position);

/** Trusted runtime fixtures isolate collision cases with different cursors.
 * Students cannot submit runtime snapshots; the authoritative entry always
 * creates every robot at cursor zero with the same program.
 */
function snapshot(
  starts: { x: number; y: number }[],
  program: ParallelProgram,
  cursors: number[],
): ParallelExecution {
  const state = createParallelExecution(level({
    robots: starts.map((start, i) => ({ id: String.fromCharCode(97 + i), start })),
    goals: starts.map((_, i) => ({ x: i, y: 2 })),
  }), program);
  return { ...state, robots: state.robots.map((r, i) => ({ ...r, cursor: cursors[i] })) };
}

describe("parallel world ticks", () => {
  it.each(PARALLEL_TEMPLATES)("solves $id with one shared program", (t) => {
    expect(executeParallelProgram(t.level, t.reference).status).toBe("passed");
  });
  it("advances the whole world once, not just one selected robot", () => {
    const s = stepParallelExecution(createParallelExecution(level(), route));
    expect(positions(s)).toEqual([{ x: 1, y: 0 }, { x: 1, y: 2 }]);
    expect(s.worldTicks).toBe(1);
    expect(s.instructionAttempts).toBe(2);
    expect(s.successfulMoves).toBe(2);
    expect(s.nodeCount).toBe(2);
    expect(s.robots.map((r) => r.last)).toEqual([
      { path: [0, 0], iteration: 1 }, { path: [0, 0], iteration: 1 },
    ]);
  });
  it("single stepping equals authoritative full execution", () => {
    let s = createParallelExecution(level(), route);
    while (s.status === "ready" || s.status === "paused") s = stepParallelExecution(s);
    expect(s).toEqual(executeParallelProgram(level(), route));
    expect(s.worldTicks).toBe(4);
    expect(s.instructionAttempts).toBe(8);
    expect(s.robots.map((r) => r.loopIterations)).toEqual([4, 4]);
    expect(stepParallelExecution(s)).toBe(s);
  });
  it("canonicalizes robot order without using IDs for arbitration", () => {
    const l = level();
    expect(executeParallelProgram({ ...l, robots: [...l.robots].reverse() }, route))
      .toEqual(executeParallelProgram(l, route));
  });
  it("WAIT advances its instruction without movement or premature deadlock", () => {
    const s = stepParallelExecution(createParallelExecution(level(), [{ op: "wait" }, ...route]));
    expect(s.status).toBe("paused");
    expect(s.robots.map((r) => r.cursor)).toEqual([1, 1]);
    expect(s.successfulMoves).toBe(0);
    expect(executeParallelProgram(level(), [{ op: "wait" }, ...route]).status).toBe("passed");
  });
  it("END terminates a robot even inside a repeat, without executing the tail", () => {
    const s = executeParallelProgram(level(), [{ op: "repeat", count: 3, body: [{ op: "end" }, { op: "left" }] }]);
    expect(s.status).toBe("incomplete");
    expect(s.worldTicks).toBe(1);
    expect(s.errors).toEqual([]);
    expect(s.robots.every((r) => r.status === "ended")).toBe(true);
  });
  it("checks all robots at normal completion and reports unmet IDs", () => {
    const s = executeParallelProgram(level({ goals: [{ x: 1, y: 0 }, { x: 4, y: 2 }] }), [{ op: "right" }]);
    expect(s.status).toBe("incomplete");
    expect(s.unmetRobotIds).toEqual(["b"]);
  });
  it("does not pass early before a later invalid move", () => {
    const s = executeParallelProgram(level(), [{ op: "repeat", count: 5, body: [{ op: "right" }] }]);
    expect(s.status).toBe("error");
    expect(s.worldTicks).toBe(5);
    expect(s.errors.map((e) => e.at)).toEqual([
      { path: [0, 0], iteration: 5 }, { path: [0, 0], iteration: 5 },
    ]);
  });
  it("does not mutate inputs or previous snapshots, and reset restores initial state", () => {
    const l = level(); const p: ParallelProgram = [{ op: "right" }];
    const s = createParallelExecution(l, p); const before = JSON.stringify(s);
    stepParallelExecution(s);
    expect(JSON.stringify(s)).toBe(before);
    l.robots[0].start.x = 3; p[0] = { op: "left" };
    expect(s.level.robots[0].start.x).toBe(0);
    expect(s.program[0].op).toBe("right");
    expect(resetParallelExecution(stepParallelExecution(s))).toEqual(s);
  });
});

describe("simultaneous collision resolution", () => {
  it("moves an occupied-cell chain together when its end is empty", () => {
    const s = executeParallelProgram(level({
      width: 4, height: 1,
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 1, y: 0 } }],
      goals: [{ x: 2, y: 0 }, { x: 3, y: 0 }],
    }), [{ op: "repeat", count: 2, body: [{ op: "right" }] }]);
    expect(s.status).toBe("passed"); expect(s.worldTicks).toBe(2);
  });
  it("rejects all contenders for the same empty cell", () => {
    const s = stepParallelExecution(snapshot([{ x: 0, y: 0 }, { x: 2, y: 0 }], [{ op: "right" }, { op: "left" }], [0, 1]));
    expect(positions(s)).toEqual([{ x: 0, y: 0 }, { x: 2, y: 0 }]);
    expect(s.robots.map((r) => r.cursor)).toEqual([0, 1]);
    expect(s.robots.map((r) => r.blocked?.reason)).toEqual(["CONTENDED", "CONTENDED"]);
    expect(s.failure?.code).toBe("DEADLOCK");
    expect(s.instructionAttempts).toBe(2);
  });
  it("does not give a reordered contender priority", () => {
    const base = snapshot([{ x: 0, y: 0 }, { x: 2, y: 0 }], [{ op: "right" }, { op: "left" }], [0, 1]);
    const a = stepParallelExecution(base);
    const b = stepParallelExecution({ ...base, robots: [...base.robots].reverse() });
    expect(b).toEqual(a);
    expect(a.successfulMoves).toBe(0);
  });
  it("does not grant movement priority to the smallest robot ID", () => {
    const base = snapshot([{ x: 0, y: 0 }, { x: 2, y: 0 }], [{ op: "right" }, { op: "left" }], [0, 1]);
    const s = stepParallelExecution({ ...base, robots: base.robots.map((r, i) => ({ ...r, id: i ? "a" : "z" })) });
    expect(s.robots.every((r) => r.status === "blocked")).toBe(true);
    expect(s.successfulMoves).toBe(0);
  });
  it("blocks two-way swaps", () => {
    const s = stepParallelExecution(snapshot([{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ op: "right" }, { op: "left" }], [0, 1]));
    expect(s.robots.every((r) => r.blocked?.reason === "CYCLE")).toBe(true);
    expect(s.failure?.code).toBe("DEADLOCK");
  });
  it("blocks a four-way cycle", () => {
    const s = stepParallelExecution(snapshot(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      [{ op: "right" }, { op: "down" }, { op: "left" }, { op: "up" }], [0, 1, 2, 3],
    ));
    expect(s.successfulMoves).toBe(0);
    expect(s.robots.every((r) => r.blocked?.reason === "CYCLE")).toBe(true);
  });
  it("retries a blocked move after a waiting occupant leaves", () => {
    const base = snapshot([{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ op: "right" }, { op: "wait" }, { op: "right" }], [0, 1]);
    const first = stepParallelExecution(base);
    expect(first.status).toBe("paused");
    expect(first.robots.map((r) => r.cursor)).toEqual([0, 2]);
    expect(first.robots[0].blocked?.reason).toBe("OCCUPIED");
    const second = stepParallelExecution(first);
    expect(positions(second)).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
    expect(second.robots.map((r) => r.cursor)).toEqual([1, 3]);
    expect(second.robots[0].blocked).toBeNull();
    expect(second.instructionAttempts).toBe(4);
  });
  it("keeps ended robots occupying their cells", () => {
    const base = snapshot([{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ op: "right" }, { op: "end" }], [0, 1]);
    const first = stepParallelExecution(base);
    expect(first.status).toBe("paused");
    expect(first.robots[1].status).toBe("ended");
    const s = stepParallelExecution(first);
    expect(s.failure?.code).toBe("DEADLOCK");
    expect(s.robots[0].cursor).toBe(0);
    expect(s.instructionAttempts).toBe(3);
  });
  it("propagates contention backwards to a dependent mover", () => {
    const s = stepParallelExecution(snapshot(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }],
      [{ op: "right" }, { op: "left" }], [0, 0, 1],
    ));
    expect(s.robots.map((r) => r.blocked?.reason)).toEqual(["OCCUPIED", "CONTENDED", "CONTENDED"]);
    expect(s.successfulMoves).toBe(0);
  });
  it("commits other legal moves on a runtime-error tick and then stops", () => {
    const s = executeParallelProgram(level({ walls: [{ x: 1, y: 0 }] }), [{ op: "right" }, { op: "right" }]);
    expect(s.failure?.code).toBe("RUNTIME_ERROR");
    expect(positions(s)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 2 }]);
    expect(s.worldTicks).toBe(1); expect(s.instructionAttempts).toBe(2);
    expect(s.errors).toEqual([{ robotId: "a", code: "WALL", tick: 1, op: "right", at: { path: [0], iteration: null } }]);
    expect(stepParallelExecution(s)).toBe(s);
  });
  it("an invalid mover remains an obstacle to its dependent", () => {
    const s = executeParallelProgram(level({
      width: 2, height: 2,
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 1, y: 0 } }],
      goals: [{ x: 0, y: 1 }, { x: 1, y: 1 }],
    }), [{ op: "right" }]);
    expect(s.errors[0].code).toBe("OUT_OF_BOUNDS");
    expect(s.robots[0].blocked?.reason).toBe("OCCUPIED");
    expect(s.successfulMoves).toBe(0);
  });
  it("counts a blocked loop iteration once rather than once per retry", () => {
    const base = snapshot([{ x: 0, y: 0 }, { x: 1, y: 0 }], [
      { op: "repeat", count: 1, body: [{ op: "right" }] },
      { op: "wait" }, { op: "wait" }, { op: "right" },
    ], [0, 1]);
    const s = stepParallelExecution(stepParallelExecution(stepParallelExecution(base)));
    expect(s.robots[0].loopIterations).toBe(1);
    expect(s.robots[0].attempts).toBe(3);
    expect(s.robots[0].position).toEqual({ x: 1, y: 0 });
  });
  it("moves a four-robot chain without dependence on traversal order", () => {
    const l = level({ width: 5, height: 1,
      robots: Array.from({ length: 4 }, (_, i) => ({ id: String(3 - i), start: { x: i, y: 0 } })),
      goals: Array.from({ length: 4 }, (_, i) => ({ x: i + 1, y: 0 })),
    });
    const s = executeParallelProgram(l, [{ op: "right" }]);
    expect(s.status).toBe("passed"); expect(s.successfulMoves).toBe(4);
  });
  it("preserves exclusivity and order independence for every four-robot action combination", () => {
    // Exhaust the 6^4 one-tick combinations at this densely occupied layout.
    const p: ParallelProgram = PARALLEL_COMMANDS.filter((op) => op !== "repeat").map((op) => ({ op }));
    for (let code = 0; code < 6 ** 4; code++) {
      const cursors = Array.from({ length: 4 }, (_, i) => Math.floor(code / 6 ** i) % 6);
      const base = snapshot([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }], p, cursors);
      const original = JSON.stringify(base);
      const a = stepParallelExecution(base);
      const b = stepParallelExecution({ ...base, robots: [...base.robots].reverse() });
      expect(a).toEqual(b);
      expect(new Set(a.robots.map((r) => `${r.position.x},${r.position.y}`)).size).toBe(4);
      expect(JSON.stringify(base)).toBe(original);
      expect(a.robots.every((r) => r.position.x >= 0 && r.position.x < 5 && r.position.y >= 0 && r.position.y < 3)).toBe(true);
      expect(a.instructionAttempts).toBe(4);
    }
  });
});

describe("bounded evaluation and untrusted input", () => {
  it("allows exact tick and attempt budgets including normal completion", () => {
    const s = executeParallelProgram(level(), route, { ticks: 4, attempts: 8 });
    expect(s.status).toBe("passed");
  });
  it("does not execute the tick exceeding the tick budget", () => {
    const s = executeParallelProgram(level(), route, { ticks: 3 });
    expect(s.failure).toEqual({ code: "TICK_LIMIT", tick: 4 });
    expect(s.worldTicks).toBe(3); expect(s.instructionAttempts).toBe(6);
    expect(positions(s)).toEqual([{ x: 3, y: 0 }, { x: 3, y: 2 }]);
  });
  it("rejects the whole next tick if the remaining attempt budget cannot cover it", () => {
    const s = executeParallelProgram(level(), route, { attempts: 3 });
    expect(s.failure).toEqual({ code: "ATTEMPT_LIMIT", tick: 2 });
    expect(s.worldTicks).toBe(1); expect(s.instructionAttempts).toBe(2);
    expect(positions(s)).toEqual([{ x: 1, y: 0 }, { x: 1, y: 2 }]);
  });
  it("reset preserves the authority-selected execution budgets", () => {
    const s = executeParallelProgram(level(), route, { ticks: 2, attempts: 6 });
    expect(resetParallelExecution(s).limits).toEqual({ ticks: 2, attempts: 6 });
  });
  it.each([null, [], {}, "right", [null], [{ op: "if" }], [{ op: "pickup" }]])("rejects malformed/unsupported program %j", (p) => {
    expect(() => executeParallelProgram(level(), p)).toThrow();
  });
  it.each([0, 21, 1.5, "2", Infinity, NaN])("rejects repeat count %s", (count) => {
    expect(() => executeParallelProgram(level(), [{ op: "repeat", count, body: [{ op: "wait" }] }])).toThrow("INVALID_REPEAT_COUNT");
  });
  it("rejects empty or nested repeats before compiling", () => {
    expect(() => executeParallelProgram(level(), [{ op: "repeat", count: 1, body: [] }])).toThrow("INVALID_LOOP_BODY");
    const cyclic: { op: string; count: number; body: unknown[] } = { op: "repeat", count: 1, body: [] };
    cyclic.body.push(cyclic);
    expect(() => executeParallelProgram(level(), [cyclic])).toThrow("INVALID_ACTION");
  });
  it("bounds expanded work even for maximum-sized repeats", () => {
    const p = [{ op: "repeat", count: 20, body: Array.from({ length: 79 }, () => ({ op: "wait" })) }];
    const s = executeParallelProgram(level(), p);
    expect(s.nodeCount).toBe(80); expect(s.worldTicks).toBe(1000);
    expect(s.failure?.code).toBe("TICK_LIMIT");
    expect(s.instructions.length).toBe(1580);
  });
  it("counts containers toward the node budget", () => {
    expect(() => parseParallelProgram([{ op: "repeat", count: 1, body: Array.from({ length: 80 }, () => ({ op: "wait" })) }], level()))
      .toThrow("TOO_MANY_NODES");
  });
  it("checks allowed instructions, including loop bodies", () => {
    expect(() => executeParallelProgram(level({ allowed: ["wait"] }), route)).toThrow("DISALLOWED_REPEAT");
    expect(() => executeParallelProgram(level({ allowed: ["repeat", "wait"] }), route)).toThrow("DISALLOWED_ACTION");
  });
  it("ignores forged runtime state and scores in submitted nodes", () => {
    const s = executeParallelProgram(level(), [{ op: "wait", completed: true, cursor: 999, score: 100 }]);
    expect(s.status).toBe("incomplete"); expect(s.worldTicks).toBe(1);
  });
  it.each([
    { rulesVersion: 1 }, { rulesVersion: 3 }, { width: 13 }, { height: 0 },
    { robots: [] }, { robots: [{ id: "a", start: { x: 0, y: 0 } }] },
    { robots: Array.from({ length: 5 }, (_, i) => ({ id: String(i), start: { x: i, y: 0 } })) },
    { robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "a", start: { x: 1, y: 0 } }] },
    { robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 0, y: 0 } }] },
    { goals: [] }, { goals: [{ x: 4, y: 0 }, { x: 4, y: 0 }] },
    { walls: [{ x: 0, y: 0 }] }, { walls: [{ x: 4, y: 0 }] },
    { walls: [{ x: 2, y: 1 }, { x: 2, y: 1 }] },
    { robots: [{ id: "bad id", start: { x: 0, y: 0 } }, { id: "b", start: { x: 1, y: 0 } }] },
    { allowed: [] }, { allowed: ["wait", "wait"] }, { allowed: ["if"] },
  ])("rejects invalid parallel level %j", (p) => {
    expect(() => parseParallelLevel({ ...level(), ...p })).toThrow();
  });
  it.each([{ ticks: 0 }, { ticks: 1001 }, { attempts: 4001 }, { ticks: 1.5 }, { attempts: "2" }, null])("rejects invalid runtime budgets %j", (limits) => {
    expect(() => createParallelExecution(level(), route, limits)).toThrow();
  });
  it("does not expose mutable template objects", () => {
    const a = getParallelTemplate("parallel-lanes"); a.level.robots[0].start.x = 3;
    expect(getParallelTemplate("parallel-lanes").level.robots[0].start.x).toBe(0);
  });
  it("preserves the legacy engine and all three legacy reference solutions", () => {
    for (const t of TEMPLATES) expect(executeProgram(t.level, t.reference).status).toBe("passed");
    expect(PARALLEL_LIMITS.robots).toBe(4);
  });
});
