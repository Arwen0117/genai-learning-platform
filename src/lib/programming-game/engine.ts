/** Deterministic, dependency-free rules shared by the browser and server.
 * Never use a client-created Execution as grading evidence: executeProgram
 * must receive the server's authoritative level and the submitted program.
 */
export const LIMITS = Object.freeze({
  nodes: 50,
  repeat: 20,
  steps: 500,
  size: 12,
});
export const ACTIONS = [
  "up",
  "down",
  "left",
  "right",
  "pickup",
  "drop",
] as const;
export type Action = (typeof ACTIONS)[number];
export type Point = { x: number; y: number };
export type Command =
  { op: Action } | { op: "repeat"; count: number; body: { op: Action }[] };
export type Program = Command[];
export type Level = {
  id: string;
  rulesVersion: 1;
  width: number;
  height: number;
  start: Point;
  walls: Point[];
  item: Point | null;
  goal: { kind: "reach" | "deliver"; at: Point; requireLoop: boolean };
  allowed: (Action | "repeat")[];
};
export type Location = { path: number[]; iteration: number | null };
export type RuntimeError = {
  code:
    | "OUT_OF_BOUNDS"
    | "WALL"
    | "NO_ITEM"
    | "HANDS_FULL"
    | "HANDS_EMPTY"
    | "OCCUPIED"
    | "STEP_LIMIT";
  at: Location;
  op: Action;
};
export type Status = "ready" | "paused" | "passed" | "incomplete" | "error";
type Instruction = Location & { op: Action };
export type Execution = {
  level: Level;
  program: Program;
  instructions: Instruction[];
  cursor: number;
  robot: Point;
  item: Point | null;
  holding: boolean;
  steps: number;
  nodeCount: number;
  loopIterations: number;
  usedLoop: boolean;
  status: Status;
  last: Location | null;
  error: RuntimeError | null;
  unmet: ("POSITION" | "DELIVERY" | "LOOP_REQUIRED")[];
};

export class GameInputError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "GameInputError";
  }
}
function reject(code: string): never {
  throw new GameInputError(code);
}
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    reject("INVALID_OBJECT");
  return value as Record<string, unknown>;
}
function integer(
  value: unknown,
  min: number,
  max: number,
  code: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    reject(code);
  return value;
}
export function samePoint(a: Point | null, b: Point | null): boolean {
  return a !== null && b !== null && a.x === b.x && a.y === b.y;
}

/** Clones only supported fields. No map, program, or execution input is mutated. */
export function parseLevel(input: unknown): Level {
  const p = object(input);
  if (typeof p.id !== "string" || !p.id.trim() || p.id.length > 80)
    reject("INVALID_LEVEL_ID");
  if (p.rulesVersion !== 1) reject("UNSUPPORTED_RULES_VERSION");
  const width = integer(p.width, 1, LIMITS.size, "INVALID_WIDTH");
  const height = integer(p.height, 1, LIMITS.size, "INVALID_HEIGHT");
  function point(input: unknown): Point {
    const v = object(input);
    return {
      x: integer(v.x, 0, width - 1, "INVALID_X"),
      y: integer(v.y, 0, height - 1, "INVALID_Y"),
    };
  }
  if (!Array.isArray(p.walls) || p.walls.length > width * height)
    reject("INVALID_WALLS");
  const walls = p.walls.map(point);
  if (new Set(walls.map((v) => `${v.x},${v.y}`)).size !== walls.length)
    reject("DUPLICATE_WALL");
  const start = point(p.start);
  const item = p.item === null ? null : point(p.item);
  const g = object(p.goal);
  if (g.kind !== "reach" && g.kind !== "deliver") reject("INVALID_GOAL");
  if (typeof g.requireLoop !== "boolean") reject("INVALID_LOOP_REQUIREMENT");
  const goal: Level["goal"] = {
    kind: g.kind,
    at: point(g.at),
    requireLoop: g.requireLoop,
  };
  if (goal.kind === "deliver" && item === null) reject("DELIVERY_NEEDS_ITEM");
  if (
    [start, item, goal.at].some((pos) => walls.some((w) => samePoint(w, pos)))
  )
    reject("BLOCKED_INITIAL_STATE");
  const valid: readonly string[] = [...ACTIONS, "repeat"];
  if (
    !Array.isArray(p.allowed) ||
    !p.allowed.length ||
    p.allowed.length > valid.length ||
    p.allowed.some((a) => typeof a !== "string" || !valid.includes(a))
  )
    reject("INVALID_ALLOWED");
  if (new Set(p.allowed).size !== p.allowed.length) reject("DUPLICATE_ALLOWED");
  return {
    id: p.id,
    rulesVersion: 1,
    width,
    height,
    start,
    walls,
    item,
    goal,
    allowed: [...p.allowed] as Level["allowed"],
  };
}

export function parseProgram(input: unknown, level: Level): Program {
  if (!Array.isArray(input) || !input.length || input.length > LIMITS.nodes)
    reject("INVALID_PROGRAM_SIZE");
  let nodes = 0;
  function action(input: unknown): { op: Action } {
    const p = object(input);
    if (!ACTIONS.includes(p.op as Action)) reject("INVALID_ACTION");
    if (!level.allowed.includes(p.op as Action)) reject("DISALLOWED_ACTION");
    return { op: p.op as Action };
  }
  return input.map((value) => {
    nodes++;
    if (nodes > LIMITS.nodes) reject("TOO_MANY_NODES");
    const p = object(value);
    if (p.op !== "repeat") return action(p);
    if (!level.allowed.includes("repeat")) reject("DISALLOWED_REPEAT");
    const count = integer(p.count, 1, LIMITS.repeat, "INVALID_REPEAT_COUNT");
    if (
      !Array.isArray(p.body) ||
      !p.body.length ||
      p.body.length > LIMITS.nodes
    )
      reject("INVALID_LOOP_BODY");
    nodes += p.body.length;
    if (nodes > LIMITS.nodes) reject("TOO_MANY_NODES");
    // No recursion: a repeat inside the body is rejected as INVALID_ACTION.
    return { op: "repeat", count, body: p.body.map(action) };
  });
}

function compile(program: Program): Instruction[] {
  const instructions: Instruction[] = [];
  program.forEach((cmd, index) => {
    if (cmd.op === "repeat") {
      for (let iteration = 1; iteration <= cmd.count; iteration++)
        cmd.body.forEach((v, child) =>
          instructions.push({ op: v.op, path: [index, child], iteration }),
        );
    } else instructions.push({ op: cmd.op, path: [index], iteration: null });
  });
  // Bounded by 50 nodes and 20 repeats (under 1000 instructions).
  return instructions;
}

export function createExecution(
  levelInput: unknown,
  programInput: unknown,
): Execution {
  const level = parseLevel(levelInput);
  const program = parseProgram(programInput, level);
  return {
    level,
    program,
    instructions: compile(program),
    cursor: 0,
    robot: { ...level.start },
    item: level.item ? { ...level.item } : null,
    holding: false,
    steps: 0,
    nodeCount: program.reduce(
      (sum, c) => sum + 1 + (c.op === "repeat" ? c.body.length : 0),
      0,
    ),
    loopIterations: 0,
    usedLoop: false,
    status: "ready",
    last: null,
    error: null,
    unmet: [],
  };
}

function finish(state: Execution): Execution {
  const { goal } = state.level;
  const unmet: Execution["unmet"] = [];
  if (goal.kind === "reach" && !samePoint(state.robot, goal.at))
    unmet.push("POSITION");
  if (
    goal.kind === "deliver" &&
    (state.holding || !samePoint(state.item, goal.at))
  )
    unmet.push("DELIVERY");
  if (goal.requireLoop && !state.usedLoop) unmet.push("LOOP_REQUIRED");
  return { ...state, status: unmet.length ? "incomplete" : "passed", unmet };
}

/** One atomic instruction; terminal executions are unchanged. No timers or IO. */
export function stepExecution(current: Execution): Execution {
  if (current.status !== "ready" && current.status !== "paused") return current;
  const instruction = current.instructions[current.cursor];
  if (!instruction) return finish(current);
  const at = { path: [...instruction.path], iteration: instruction.iteration };
  if (current.steps >= LIMITS.steps)
    return {
      ...current,
      status: "error",
      error: { code: "STEP_LIMIT", at, op: instruction.op },
    };
  const next: Execution = {
    ...current,
    robot: { ...current.robot },
    item: current.item ? { ...current.item } : null,
    cursor: current.cursor + 1,
    steps: current.steps + 1,
    status: "paused",
    last: at,
    usedLoop: current.usedLoop || instruction.iteration !== null,
    loopIterations:
      current.loopIterations +
      (instruction.iteration !== null && instruction.path[1] === 0 ? 1 : 0),
  };
  function error(code: RuntimeError["code"]): Execution {
    return {
      ...next,
      status: "error",
      error: { code, at, op: instruction.op },
    };
  }
  const { op } = instruction;
  if (op === "pickup") {
    if (next.holding) return error("HANDS_FULL");
    if (!samePoint(next.robot, next.item)) return error("NO_ITEM");
    next.holding = true;
    next.item = null;
  } else if (op === "drop") {
    if (!next.holding) return error("HANDS_EMPTY");
    if (samePoint(next.robot, next.item)) return error("OCCUPIED");
    next.item = { ...next.robot };
    next.holding = false;
  } else {
    const delta: Record<Exclude<Action, "pickup" | "drop">, Point> = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const target = {
      x: next.robot.x + delta[op].x,
      y: next.robot.y + delta[op].y,
    };
    if (
      target.x < 0 ||
      target.y < 0 ||
      target.x >= next.level.width ||
      target.y >= next.level.height
    )
      return error("OUT_OF_BOUNDS");
    if (next.level.walls.some((w) => samePoint(w, target)))
      return error("WALL");
    next.robot = target;
  }
  return next.cursor === next.instructions.length ? finish(next) : next;
}

/** Authoritative grading entry: starts from the validated initial state. */
export function executeProgram(level: unknown, program: unknown): Execution {
  let state = createExecution(level, program);
  while (state.status === "ready" || state.status === "paused")
    state = stepExecution(state);
  return state;
}

export function resetExecution(state: Execution): Execution {
  return createExecution(state.level, state.program);
}
