import { GameInputError, type Point } from "./engine";

/** Rules v2, batch B1. Pure, bounded simulation; never accepts a client runtime
 * as grading evidence. v1 engine/player and their counters remain unchanged.
 * IF, items and messages are intentionally not accepted in this batch.
 */
export const PARALLEL_LIMITS = Object.freeze({
  size: 12, robots: 4, nodes: 80, repeat: 20, ticks: 1000, attempts: 4000,
});
export const PARALLEL_ACTIONS = ["up", "down", "left", "right", "wait", "end"] as const;
export const PARALLEL_COMMANDS = [...PARALLEL_ACTIONS, "repeat"] as const;
export type ParallelAction = (typeof PARALLEL_ACTIONS)[number];
export type ParallelCommand = { op: ParallelAction } | {
  op: "repeat"; count: number; body: { op: ParallelAction }[];
};
export type ParallelProgram = ParallelCommand[];
export type ParallelLevel = {
  id: string;
  rulesVersion: 2;
  width: number;
  height: number;
  walls: Point[];
  robots: { id: string; start: Point }[];
  /** Goal zone, not per-ID assigned destinations. All robots must end inside. */
  goals: Point[];
  allowed: (typeof PARALLEL_COMMANDS)[number][];
};
export type ParallelLocation = { path: number[]; iteration: number | null };
export type ParallelInstruction = ParallelLocation & { op: ParallelAction };
export type ParallelBlocked = {
  reason: "CONTENDED" | "OCCUPIED" | "CYCLE";
  robotIds: string[];
};
export type ParallelRuntimeError = {
  robotId: string; code: "WALL" | "OUT_OF_BOUNDS";
  tick: number; op: ParallelAction; at: ParallelLocation;
};
export type ParallelRobot = {
  id: string;
  position: Point;
  cursor: number;
  status: "ready" | "blocked" | "ended" | "error";
  last: ParallelLocation | null;
  blocked: ParallelBlocked | null;
  error: ParallelRuntimeError | null;
  attempts: number;
  successfulMoves: number;
  loopIterations: number;
};
export type ParallelBudgets = { ticks: number; attempts: number };
export type ParallelExecution = {
  level: ParallelLevel;
  program: ParallelProgram;
  instructions: ParallelInstruction[];
  robots: ParallelRobot[];
  limits: ParallelBudgets;
  worldTicks: number;
  instructionAttempts: number;
  successfulMoves: number;
  nodeCount: number;
  status: "ready" | "paused" | "passed" | "incomplete" | "error";
  failure: {
    code: "RUNTIME_ERROR" | "DEADLOCK" | "TICK_LIMIT" | "ATTEMPT_LIMIT";
    /** Budget failure names the next rejected tick; it was not processed. */
    tick: number;
  } | null;
  errors: ParallelRuntimeError[];
  unmetRobotIds: string[];
};

function reject(code: string): never { throw new GameInputError(code); }
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) reject("INVALID_OBJECT");
  return value as Record<string, unknown>;
}
function integer(value: unknown, min: number, max: number, code: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) reject(code);
  return value;
}
function key(p: Point): string { return `${p.x},${p.y}`; }
function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Bounded schema validation, cloning supported fields only. IDs provide stable
 * diagnostics/order, never movement priority. No random, timers, React or IO.
 */
export function parseParallelLevel(input: unknown): ParallelLevel {
  const p = object(input);
  if (typeof p.id !== "string" || !p.id.trim() || p.id.length > 80) reject("INVALID_LEVEL_ID");
  if (p.rulesVersion !== 2) reject("UNSUPPORTED_RULES_VERSION");
  const width = integer(p.width, 1, PARALLEL_LIMITS.size, "INVALID_WIDTH");
  const height = integer(p.height, 1, PARALLEL_LIMITS.size, "INVALID_HEIGHT");
  function point(input: unknown): Point {
    const v = object(input);
    return { x: integer(v.x, 0, width - 1, "INVALID_X"), y: integer(v.y, 0, height - 1, "INVALID_Y") };
  }
  function points(input: unknown, min: number, code: string): Point[] {
    if (!Array.isArray(input) || input.length < min || input.length > width * height) reject(code);
    const result = input.map(point);
    if (new Set(result.map(key)).size !== result.length) reject(code);
    return result;
  }
  const walls = points(p.walls, 0, "INVALID_WALLS");
  if (!Array.isArray(p.robots) || p.robots.length < 2 || p.robots.length > PARALLEL_LIMITS.robots) reject("INVALID_ROBOTS");
  const robots = p.robots.map((value) => {
    const r = object(value);
    if (typeof r.id !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(r.id)) reject("INVALID_ROBOT_ID");
    return { id: r.id, start: point(r.start) };
  }).sort(byId);
  if (new Set(robots.map((r) => r.id)).size !== robots.length) reject("DUPLICATE_ROBOT_ID");
  if (new Set(robots.map((r) => key(r.start))).size !== robots.length) reject("DUPLICATE_ROBOT_POSITION");
  const goals = points(p.goals, robots.length, "INVALID_GOALS");
  const wallSet = new Set(walls.map(key));
  if ([...robots.map((r) => r.start), ...goals].some((v) => wallSet.has(key(v)))) reject("BLOCKED_INITIAL_STATE");
  if (!Array.isArray(p.allowed) || !p.allowed.length || p.allowed.length > PARALLEL_COMMANDS.length ||
      p.allowed.some((v) => !(PARALLEL_COMMANDS as readonly unknown[]).includes(v))) reject("INVALID_ALLOWED");
  if (new Set(p.allowed).size !== p.allowed.length) reject("DUPLICATE_ALLOWED");
  return { id: p.id, rulesVersion: 2, width, height, walls, robots, goals, allowed: [...p.allowed] as ParallelLevel["allowed"] };
}

export function parseParallelProgram(input: unknown, level: ParallelLevel): ParallelProgram {
  if (!Array.isArray(input) || !input.length || input.length > PARALLEL_LIMITS.nodes) reject("INVALID_PROGRAM_SIZE");
  let nodes = 0;
  function action(input: unknown): { op: ParallelAction } {
    const p = object(input);
    if (!(PARALLEL_ACTIONS as readonly unknown[]).includes(p.op)) reject("INVALID_ACTION");
    if (!level.allowed.includes(p.op as ParallelAction)) reject("DISALLOWED_ACTION");
    return { op: p.op as ParallelAction };
  }
  return input.map((value) => {
    if (++nodes > PARALLEL_LIMITS.nodes) reject("TOO_MANY_NODES");
    const p = object(value);
    if (p.op !== "repeat") return action(p);
    if (!level.allowed.includes("repeat")) reject("DISALLOWED_REPEAT");
    const count = integer(p.count, 1, PARALLEL_LIMITS.repeat, "INVALID_REPEAT_COUNT");
    if (!Array.isArray(p.body) || !p.body.length || p.body.length > PARALLEL_LIMITS.nodes) reject("INVALID_LOOP_BODY");
    nodes += p.body.length;
    if (nodes > PARALLEL_LIMITS.nodes) reject("TOO_MANY_NODES");
    // No recursion: nested, cyclic and future instruction types are rejected.
    return { op: "repeat", count, body: p.body.map(action) };
  });
}

function compile(program: ParallelProgram): ParallelInstruction[] {
  const result: ParallelInstruction[] = [];
  program.forEach((c, index) => {
    if (c.op !== "repeat") result.push({ op: c.op, path: [index], iteration: null });
    else for (let iteration = 1; iteration <= c.count; iteration++)
      c.body.forEach((a, child) => result.push({ op: a.op, path: [index, child], iteration }));
  });
  // <= (80 - 1) * 20 = 1580 shared instructions, not per-robot copies.
  return result;
}
function budgets(input: unknown): ParallelBudgets {
  const p = object(input);
  return {
    ticks: integer(p.ticks === undefined ? PARALLEL_LIMITS.ticks : p.ticks, 1, PARALLEL_LIMITS.ticks, "INVALID_TICK_BUDGET"),
    attempts: integer(p.attempts === undefined ? PARALLEL_LIMITS.attempts : p.attempts, 1, PARALLEL_LIMITS.attempts, "INVALID_ATTEMPT_BUDGET"),
  };
}

/** Limits are authority-selected, may only lower hard caps, and are retained
 * for reset/reproduction. A future transport must not accept student budgets.
 */
export function createParallelExecution(levelInput: unknown, programInput: unknown, limitInput: unknown = {}): ParallelExecution {
  const level = parseParallelLevel(levelInput);
  const program = parseParallelProgram(programInput, level);
  return {
    level, program, instructions: compile(program), limits: budgets(limitInput),
    robots: level.robots.map((r) => ({
      id: r.id, position: { ...r.start }, cursor: 0, status: "ready", last: null,
      blocked: null, error: null, attempts: 0, successfulMoves: 0, loopIterations: 0,
    })),
    worldTicks: 0, instructionAttempts: 0, successfulMoves: 0,
    nodeCount: program.reduce((n, c) => n + 1 + (c.op === "repeat" ? c.body.length : 0), 0),
    status: "ready", failure: null, errors: [], unmetRobotIds: [],
  };
}

type Move = { target: Point };
type Resolution = { moves: true } | { moves: false; blocked: ParallelBlocked };

/** Resolves a functional dependency graph of at most four movers. Contenders
 * all wait; a chain can move iff it ends in an empty cell. Cycles never move.
 * Reads snapshot occupancy, not positions changed while visiting another ID.
 */
function resolveMoves(robots: ParallelRobot[], moves: Map<string, Move>): Map<string, Resolution> {
  const occupancy = new Map(robots.map((r) => [key(r.position), r.id]));
  const claims = new Map<string, string[]>();
  for (const [id, move] of moves) {
    const k = key(move.target); claims.set(k, [...(claims.get(k) ?? []), id]);
  }
  const results = new Map<string, Resolution>();
  for (const ids of claims.values()) if (ids.length > 1) {
    const robotIds = [...ids].sort();
    for (const id of ids) results.set(id, { moves: false, blocked: { reason: "CONTENDED", robotIds } });
  }
  function visit(id: string, path: string[]): Resolution {
    const known = results.get(id);
    if (known) return known;
    const cycleAt = path.indexOf(id);
    if (cycleAt >= 0) {
      const robotIds = path.slice(cycleAt).sort();
      const cycle: Resolution = { moves: false, blocked: { reason: "CYCLE", robotIds } };
      for (const member of robotIds) results.set(member, cycle);
      return cycle;
    }
    const occupant = occupancy.get(key(moves.get(id)!.target));
    let resolution: Resolution = { moves: true };
    if (occupant && (!moves.has(occupant) || !visit(occupant, [...path, id]).moves)) {
      resolution = results.get(id) ?? { moves: false, blocked: { reason: "OCCUPIED", robotIds: [occupant] } };
    }
    results.set(id, resolution);
    return resolution;
  }
  for (const id of moves.keys()) visit(id, []);
  return results;
}

const DELTAS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
} as const;

/** One WORLD tick. This consumes only a trusted, created runtime; authoritative
 * execution accepts level/program and always reconstructs initial state.
 * Earlier snapshots are never mutated. Terminal states are idempotent.
 */
export function stepParallelExecution(current: ParallelExecution): ParallelExecution {
  if (current.status !== "ready" && current.status !== "paused") return current;
  const tick = current.worldTicks + 1;
  const ordered = [...current.robots].sort(byId);
  const active = ordered.filter((r) => r.status !== "ended");
  const failBudget = (code: "TICK_LIMIT" | "ATTEMPT_LIMIT"): ParallelExecution => ({
    ...current, status: "error", failure: { code, tick },
  });
  if (current.worldTicks >= current.limits.ticks) return failBudget("TICK_LIMIT");
  // Reserve the whole simultaneous batch; never grant priority by budget order.
  if (current.instructionAttempts + active.length > current.limits.attempts) return failBudget("ATTEMPT_LIMIT");
  const walls = new Set(current.level.walls.map(key));
  const moves = new Map<string, Move>();
  const errors: ParallelRuntimeError[] = [];
  for (const robot of active) {
    const instruction = current.instructions[robot.cursor];
    if (instruction.op === "wait" || instruction.op === "end") continue;
    const delta = DELTAS[instruction.op];
    const target = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };
    const code = target.x < 0 || target.y < 0 || target.x >= current.level.width || target.y >= current.level.height
      ? "OUT_OF_BOUNDS" : walls.has(key(target)) ? "WALL" : null;
    if (code) errors.push({ robotId: robot.id, code, tick, op: instruction.op, at: { path: [...instruction.path], iteration: instruction.iteration } });
    else moves.set(robot.id, { target });
  }
  const resolved = resolveMoves(ordered, moves);
  const robots = ordered.map((robot): ParallelRobot => {
    if (robot.status === "ended") return robot;
    const instruction = current.instructions[robot.cursor];
    const error = errors.find((e) => e.robotId === robot.id) ?? null;
    const resolution = resolved.get(robot.id);
    const moved = resolution?.moves === true;
    const blocked = resolution && !resolution.moves ? resolution.blocked : null;
    const cursor = robot.cursor + (blocked || error ? 0 : 1);
    return {
      ...robot, cursor, position: moved ? { ...moves.get(robot.id)!.target } : { ...robot.position },
      status: error ? "error" : blocked ? "blocked" : instruction.op === "end" || cursor === current.instructions.length ? "ended" : "ready",
      last: { path: [...instruction.path], iteration: instruction.iteration }, blocked, error,
      attempts: robot.attempts + 1, successfulMoves: robot.successfulMoves + Number(moved),
      loopIterations: robot.loopIterations + Number(instruction.iteration !== null && instruction.path[1] === 0 && robot.status !== "blocked"),
    };
  });
  const next: ParallelExecution = {
    ...current, robots, worldTicks: tick,
    instructionAttempts: current.instructionAttempts + active.length,
    successfulMoves: robots.reduce((n, r) => n + r.successfulMoves, 0),
    status: "paused", errors,
  };
  // Valid actions on an error tick are committed above; no subsequent tick runs.
  if (errors.length) return { ...next, status: "error", failure: { code: "RUNTIME_ERROR", tick } };
  if (robots.every((r) => r.status === "ended")) {
    const goals = new Set(current.level.goals.map(key));
    const unmetRobotIds = robots.filter((r) => !goals.has(key(r.position))).map((r) => r.id);
    return { ...next, status: unmetRobotIds.length ? "incomplete" : "passed", unmetRobotIds };
  }
  // No messages, timers or external actors exist in B1. If every active robot
  // is blocked and nobody advanced, the exact world will repeat forever.
  if (robots.filter((r) => r.status !== "ended").every((r) => r.status === "blocked") &&
      active.every((r) => robots.find((n) => n.id === r.id)!.cursor === r.cursor)) {
    return { ...next, status: "error", failure: { code: "DEADLOCK", tick } };
  }
  return next;
}

export function executeParallelProgram(level: unknown, program: unknown, limits: unknown = {}): ParallelExecution {
  let state = createParallelExecution(level, program, limits);
  while (state.status === "ready" || state.status === "paused") state = stepParallelExecution(state);
  return state;
}
export function resetParallelExecution(state: ParallelExecution): ParallelExecution {
  return createParallelExecution(state.level, state.program, state.limits);
}
