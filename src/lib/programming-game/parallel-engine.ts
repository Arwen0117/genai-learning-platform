import { GameInputError, type Point } from "./engine";

/** Rules v2, including opt-in local IF observations. Pure, bounded simulation;
 * never accepts a client runtime
 * as grading evidence. v1 engine/player and their counters remain unchanged.
 * Item delivery is explicitly enabled by delivery.version=1; variables and messages remain unsupported. Existing B1 actions keep
 * their meaning; IF must be explicitly allowed by the authoritative level.
 */
export const PARALLEL_LIMITS = Object.freeze({
  size: 12, robots: 4, nodes: 80, repeat: 20, ticks: 1000, attempts: 4000,
});
/** Additive IF grammar bound; kept outside legacy limits/hash snapshots. */
export const PARALLEL_IF_DEPTH = 4;
export const PARALLEL_ACTIONS = ["up", "down", "left", "right", "wait", "end"] as const;
export const PARALLEL_COMMANDS = [...PARALLEL_ACTIONS, "repeat", "if", "label", "jump"] as const;
export const ALL_PARALLEL_COMMANDS = [...PARALLEL_COMMANDS, "pickup", "drop"] as const;
export type ParallelAction = (typeof PARALLEL_ACTIONS)[number] | "pickup" | "drop";
export type ParallelDirection = "up" | "down" | "left" | "right";
export type ParallelCondition =
  | { kind: "goal" | "item"; not: boolean; direction?: ParallelDirection }
  | { kind: "holding"; not: boolean }
  | { kind: "wall" | "boundary" | "robot"; direction: ParallelDirection; not: boolean };
export type ParallelCommand = { op: ParallelAction } | {
  op: "label"; id: string;
} | {
  op: "jump"; target: string;
} | {
  op: "repeat"; count: number; body: ParallelProgram;
} | {
  op: "if"; condition: ParallelCondition; then: ParallelProgram; else: ParallelProgram;
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
  allowed: (typeof ALL_PARALLEL_COMMANDS)[number][];
  delivery?: { version: 1; items: { id: string; start: Point }[]; targets: Point[] };
};
export type ParallelLocation = { path: number[]; iteration: number | null };
export type ParallelInstruction = ParallelLocation & { loopStart?: boolean; next?: number } & (
  { op: ParallelAction } |
  { op: "label"; id: string } |
  { op: "jump"; target: string; jumpTo: number } |
  { op: "if"; condition: ParallelCondition; trueNext: number; falseNext: number }
);
export type ParallelBlocked = {
  reason: "CONTENDED" | "OCCUPIED" | "CYCLE";
  robotIds: string[];
};
export type ParallelRuntimeError = {
  robotId: string; code: "WALL" | "OUT_OF_BOUNDS" | "EMPTY_CELL" | "HANDS_FULL" | "EMPTY_HANDS" | "ITEM_OCCUPIED";
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
  holding?: string | null;
  decision?: { tick: number; result: boolean; condition: ParallelCondition; at: ParallelLocation };
};
export type ParallelItem = { id: string; position: Point | null };
function undeliveredItems(level: ParallelLevel, items: ParallelItem[]): string[] {
  const targets = new Set(level.delivery?.targets.map(key));
  return items.filter((i) => !i.position || !targets.has(key(i.position))).map((i) => i.id);
}

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
  items?: ParallelItem[];
  undeliveredItemIds?: string[];
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
  if (!Array.isArray(p.robots) || p.robots.length < 1 || p.robots.length > PARALLEL_LIMITS.robots) reject("INVALID_ROBOTS");
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
  if (!Array.isArray(p.allowed) || !p.allowed.length || p.allowed.length > ALL_PARALLEL_COMMANDS.length ||
      p.allowed.some((v) => !(ALL_PARALLEL_COMMANDS as readonly unknown[]).includes(v))) reject("INVALID_ALLOWED");
  if (new Set(p.allowed).size !== p.allowed.length) reject("DUPLICATE_ALLOWED");
  let delivery: ParallelLevel["delivery"];
  if (p.delivery !== undefined) {
    const d = object(p.delivery);
    if (d.version !== 1) reject("UNSUPPORTED_DELIVERY_VERSION");
    if (!Array.isArray(d.items) || !d.items.length || d.items.length > 12) reject("INVALID_ITEMS");
    const items = d.items.map((value) => {
      const item = object(value);
      if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,32}$/.test(item.id)) reject("INVALID_ITEM_ID");
      return { id: item.id, start: point(item.start) };
    }).sort(byId);
    if (new Set(items.map((i) => i.id)).size !== items.length || new Set(items.map((i) => key(i.start))).size !== items.length) reject("DUPLICATE_ITEM");
    const targets = points(d.targets, items.length, "INVALID_DELIVERY_TARGETS");
    if ([...items.map((i) => i.start), ...targets].some((v) => wallSet.has(key(v)))) reject("BLOCKED_ITEM_STATE");
    delivery = { version: 1, items, targets };
  } else if (p.allowed.includes("pickup") || p.allowed.includes("drop")) reject("DELIVERY_NOT_ENABLED");
  return { id: p.id, rulesVersion: 2, width, height, walls, robots, goals, allowed: [...p.allowed] as ParallelLevel["allowed"], ...(delivery ? { delivery } : {}) };
}

export function parseParallelProgram(input: unknown, level: ParallelLevel): ParallelProgram {
  if (!Array.isArray(input) || !input.length || input.length > PARALLEL_LIMITS.nodes) reject("INVALID_PROGRAM_SIZE");
  let nodes = 0;
  const labels = new Set<string>();
  const targets: string[] = [];
  function action(input: unknown): ParallelCommand {
    if (++nodes > PARALLEL_LIMITS.nodes) reject("TOO_MANY_NODES");
    const p = object(input);
    if (p.op === "jump") {
      if (!level.allowed.includes("jump")) reject("DISALLOWED_JUMP");
      if (!validLabel(p.target)) reject("INVALID_JUMP_TARGET");
      targets.push(p.target); return { op: "jump", target: p.target };
    }
    if (p.op === "pickup" || p.op === "drop") { if (!level.delivery) reject("DELIVERY_NOT_ENABLED"); }
    else if (!(PARALLEL_ACTIONS as readonly unknown[]).includes(p.op)) reject("INVALID_ACTION");
    if (!level.allowed.includes(p.op as ParallelAction)) reject("DISALLOWED_ACTION");
    return { op: p.op as ParallelAction };
  }
  function branch(input: unknown, nonempty: boolean, depth: number): ParallelProgram {
    if (!Array.isArray(input) || (nonempty && !input.length) || input.length > PARALLEL_LIMITS.nodes)
      reject(nonempty ? "INVALID_THEN_BODY" : "INVALID_ELSE_BODY");
    // Bound depth before recursively inspecting any untrusted child.
    return input.map((value) => { const child = object(value); return child.op === "if" ? conditional(child, depth + 1) : action(child); });
  }
  function conditional(p: Record<string, unknown>, depth = 1): ParallelCommand {
    if (depth > PARALLEL_IF_DEPTH) reject("IF_DEPTH_LIMIT");
    if (++nodes > PARALLEL_LIMITS.nodes) reject("TOO_MANY_NODES");
    if (!level.allowed.includes("if")) reject("DISALLOWED_IF");
    const c = objectCondition(p.condition);
    if ((c.kind === "item" || c.kind === "holding") && !level.delivery) reject("DELIVERY_NOT_ENABLED");
    return { op: "if", condition: c, then: branch(p.then, true, depth), else: branch(p.else, false, depth) };
  }
  const program: ParallelProgram = input.map((value) => {
    const p = object(value);
    if (p.op === "label") {
      if (++nodes > PARALLEL_LIMITS.nodes) reject("TOO_MANY_NODES");
      if (!level.allowed.includes("label")) reject("DISALLOWED_LABEL");
      if (!validLabel(p.id)) reject("INVALID_LABEL");
      if (labels.has(p.id)) reject("DUPLICATE_LABEL");
      labels.add(p.id); return { op: "label", id: p.id };
    }
    if (p.op === "if") return conditional(p);
    if (p.op !== "repeat") return action(p);
    if (++nodes > PARALLEL_LIMITS.nodes) reject("TOO_MANY_NODES");
    if (!level.allowed.includes("repeat")) reject("DISALLOWED_REPEAT");
    const count = integer(p.count, 1, PARALLEL_LIMITS.repeat, "INVALID_REPEAT_COUNT");
    if (!Array.isArray(p.body) || !p.body.length || p.body.length > PARALLEL_LIMITS.nodes) reject("INVALID_LOOP_BODY");
    return { op: "repeat", count, body: p.body.map((value) => {
      const child = object(value);
      return child.op === "if" ? conditional(child) : action(child);
    }) };
  });
  for (const target of targets) if (!labels.has(target)) reject("MISSING_JUMP_TARGET");
  return program;
}

function validLabel(input: unknown): input is string {
  return typeof input === "string" && /^[A-Z][A-Z0-9_]{0,15}$/.test(input);
}

function objectCondition(input: unknown): ParallelCondition {
  if (input === null || typeof input !== "object" || Array.isArray(input)) reject("INVALID_CONDITION");
  const p = input as Record<string, unknown>;
  if (typeof p.not !== "boolean") reject("INVALID_CONDITION");
  if (p.kind === "holding") {
    if (p.direction !== undefined) reject("INVALID_CONDITION");
    return { kind: p.kind, not: p.not };
  }
  if (p.kind === "goal" || p.kind === "item") {
    if (p.direction !== undefined && !["up", "down", "left", "right"].includes(p.direction as string)) reject("INVALID_CONDITION");
    return { kind: p.kind, not: p.not, ...(p.direction !== undefined ? { direction: p.direction as ParallelDirection } : {}) };
  }
  if (!["wall", "boundary", "robot"].includes(p.kind as string) ||
      !["up", "down", "left", "right"].includes(p.direction as string)) reject("INVALID_CONDITION");
  return { kind: p.kind as "wall" | "boundary" | "robot", direction: p.direction as ParallelDirection, not: p.not };
}

/** Counts a trusted, bounded editor/parsed tree, including both IF arms. */
export function countParallelProgramNodes(program: ParallelProgram): number {
  return program.reduce((n, c) => n + 1 + (c.op === "repeat" ? countParallelProgramNodes(c.body)
    : c.op === "if" ? countParallelProgramNodes(c.then) + countParallelProgramNodes(c.else) : 0), 0);
}

function compile(program: ParallelProgram): ParallelInstruction[] {
  const result: ParallelInstruction[] = [];
  const labels = new Map<string, number>();
  function emit(list: ParallelProgram, prefix: number[], iteration: number | null) {
    list.forEach((c, index) => {
      const path = [...prefix, index];
      if (c.op === "repeat") {
        for (let i = 1; i <= c.count; i++) {
          const start = result.length; emit(c.body, path, i); result[start].loopStart = true;
        }
      } else if (c.op === "if") {
        const judge: ParallelInstruction = { op: "if", condition: c.condition, path, iteration, trueNext: result.length + 1, falseNext: 0 };
        result.push(judge); emit(c.then, [...path, 0], iteration);
        const thenStart = judge.trueNext, thenEnd = result.length;
        judge.falseNext = result.length; emit(c.else, [...path, 1], iteration);
        // Redirect every fall-through exit, including nested IF false/empty arms.
        // Jumps retain their explicit destination, and END still terminates.
        for (let i = thenStart; i < thenEnd; i++) {
          const instruction = result[i];
          if (instruction.op === "if") {
            if (instruction.trueNext === thenEnd) instruction.trueNext = result.length;
            if (instruction.falseNext === thenEnd) instruction.falseNext = result.length;
          } else if (instruction.op !== "jump" && (instruction.next ?? i + 1) === thenEnd) instruction.next = result.length;
        }
      } else if (c.op === "label") {
        labels.set(c.id, result.length); result.push({ op: "label", id: c.id, path, iteration });
      } else if (c.op === "jump") result.push({ op: "jump", target: c.target, jumpTo: -1, path, iteration });
      else result.push({ op: c.op, path, iteration });
    });
  }
  emit(program, [], null);
  for (const instruction of result) if (instruction.op === "jump") instruction.jumpTo = labels.get(instruction.target)!;
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
      blocked: null, error: null, attempts: 0, successfulMoves: 0, loopIterations: 0, ...(level.delivery ? { holding: null } : {}),
    })),
    worldTicks: 0, instructionAttempts: 0, successfulMoves: 0,
    nodeCount: countParallelProgramNodes(program),
    status: "ready", failure: null, errors: [], unmetRobotIds: [],
    ...(level.delivery ? { items: level.delivery.items.map((i) => ({ id: i.id, position: { ...i.start } })), undeliveredItemIds: undeliveredItems(level, level.delivery.items.map((i) => ({ id: i.id, position: i.start }))) } : {}),
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

/** Read only the supplied tick-start snapshot. No global IDs, coordinates,
 * memory, boolean expression trees or lookahead are exposed to programs.
 */
export function observeParallelCondition(level: ParallelLevel, robots: ParallelRobot[], robot: ParallelRobot, condition: ParallelCondition, items: ParallelItem[] = []): boolean {
  let value: boolean;
  const delta = "direction" in condition && condition.direction ? DELTAS[condition.direction] : { x: 0, y: 0 };
  const target = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };
  if (condition.kind === "goal") value = level.goals.some((g) => key(g) === key(target));
  else if (condition.kind === "holding") value = !!robot.holding;
  else if (condition.kind === "item") value = items.some((i) => i.position && key(i.position) === key(target));
  else if ("direction" in condition) {
    value = condition.kind === "boundary" ? target.x < 0 || target.x >= level.width || target.y < 0 || target.y >= level.height
      : condition.kind === "wall" ? level.walls.some((w) => key(w) === key(target))
      : robots.some((r) => r.id !== robot.id && key(r.position) === key(target));
  }
  else value = false;
  return condition.not ? !value : value;
}

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
    if (instruction.op === "wait" || instruction.op === "end" || instruction.op === "if" || instruction.op === "label" || instruction.op === "jump") continue;
    if (instruction.op === "pickup" || instruction.op === "drop") {
      const item = current.items?.find((i) => i.position && key(i.position) === key(robot.position));
      const code = instruction.op === "pickup" ? robot.holding ? "HANDS_FULL" : !item ? "EMPTY_CELL" : null
        : !robot.holding ? "EMPTY_HANDS" : item ? "ITEM_OCCUPIED" : null;
      if (code) errors.push({ robotId: robot.id, code, tick, op: instruction.op, at: { path: [...instruction.path], iteration: instruction.iteration } });
      continue;
    }
    const delta = DELTAS[instruction.op];
    const target = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };
    const code = target.x < 0 || target.y < 0 || target.x >= current.level.width || target.y >= current.level.height
      ? "OUT_OF_BOUNDS" : walls.has(key(target)) ? "WALL" : null;
    if (code) errors.push({ robotId: robot.id, code, tick, op: instruction.op, at: { path: [...instruction.path], iteration: instruction.iteration } });
    else moves.set(robot.id, { target });
  }
  const resolved = resolveMoves(ordered, moves);
  const items = current.items?.map((i) => ({ ...i, position: i.position ? { ...i.position } : null }));
  const robots = ordered.map((robot): ParallelRobot => {
    if (robot.status === "ended") return robot;
    const instruction = current.instructions[robot.cursor];
    const error = errors.find((e) => e.robotId === robot.id) ?? null;
    const resolution = resolved.get(robot.id);
    const moved = resolution?.moves === true;
    const blocked = resolution && !resolution.moves ? resolution.blocked : null;
    const result = instruction.op === "if" ? observeParallelCondition(current.level, ordered, robot, instruction.condition, current.items) : null;
    const cursor = blocked || error ? robot.cursor : instruction.op === "if" ? (result ? instruction.trueNext : instruction.falseNext)
      : instruction.op === "jump" ? instruction.jumpTo
      : instruction.next ?? robot.cursor + 1;
    let holding = robot.holding;
    if (!error && instruction.op === "pickup") {
      const item = items!.find((i) => i.position && key(i.position) === key(robot.position))!;
      holding = item.id; item.position = null;
    } else if (!error && instruction.op === "drop") {
      items!.find((i) => i.id === holding)!.position = { ...robot.position }; holding = null;
    }
    return {
      ...robot, ...(current.level.delivery ? { holding } : {}), cursor, position: moved ? { ...moves.get(robot.id)!.target } : { ...robot.position },
      status: error ? "error" : blocked ? "blocked" : instruction.op === "end" || cursor === current.instructions.length ? "ended" : "ready",
      last: { path: [...instruction.path], iteration: instruction.iteration }, blocked, error,
      attempts: robot.attempts + 1, successfulMoves: robot.successfulMoves + Number(moved),
      loopIterations: robot.loopIterations + Number(instruction.loopStart === true && robot.status !== "blocked"),
      ...(instruction.op === "if" ? { decision: { tick, result: result!, condition: { ...instruction.condition }, at: { path: [...instruction.path], iteration: instruction.iteration } } } : {}),
    };
  });
  const next: ParallelExecution = {
    ...current, robots, ...(items ? { items, undeliveredItemIds: undeliveredItems(current.level, items) } : {}), worldTicks: tick,
    instructionAttempts: current.instructionAttempts + active.length,
    successfulMoves: robots.reduce((n, r) => n + r.successfulMoves, 0),
    status: "paused", errors,
  };
  // Valid actions on an error tick are committed above; no subsequent tick runs.
  if (errors.length) return { ...next, status: "error", failure: { code: "RUNTIME_ERROR", tick } };
  if (robots.every((r) => r.status === "ended")) {
    const goals = new Set(current.level.goals.map(key));
    const unmetRobotIds = robots.filter((r) => !goals.has(key(r.position))).map((r) => r.id);
    const undeliveredItemIds = next.undeliveredItemIds;
    return { ...next, status: unmetRobotIds.length || undeliveredItemIds?.length ? "incomplete" : "passed", unmetRobotIds,
      ...(undeliveredItemIds ? { undeliveredItemIds } : {}) };
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
