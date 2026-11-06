import { z } from "zod";
import { PARALLEL_IF_DEPTH, parseParallelLevel, parseParallelProgram } from "./parallel-engine";
const count = z.number().int().nonnegative();
const position = z.object({ x: count.max(11), y: count.max(11) });
const location = z.object({ path: z.array(count).min(1).max(2 + 2 * PARALLEL_IF_DEPTH), iteration: count.nullable() });
const history = z.object({
  version: z.literal(1).optional(),
  answer: z.object({ program: z.unknown() }),
  feedback: z.object({
    variant: z.literal("programming"), feedbackVersion: z.literal(2), rulesVersion: z.literal(2),
    status: z.enum(["passed", "incomplete", "error"]), levelVersion: z.string().regex(/^[a-f0-9]{64}$/),
    levelSnapshot: z.unknown(), limitsSnapshot: z.object({ ticks: count.min(1).max(1000), attempts: count.min(1).max(4000) }),
    worldTicks: count.max(1000), instructionAttempts: count.max(4000), successfulMoves: count.max(4000), nodeCount: count.max(80),
    robots: z.array(z.object({ id: z.string().min(1).max(32), position, status: z.enum(["ready", "blocked", "ended", "error"]), attempts: count.max(4000), holding: z.string().min(1).max(32).nullable().optional(),
      blocked: z.object({ reason: z.enum(["CONTENDED", "OCCUPIED", "CYCLE"]), robotIds: z.array(z.string().max(32)).max(4) }).nullable() })).min(1).max(4),
    failure: z.object({ code: z.enum(["RUNTIME_ERROR", "DEADLOCK", "TICK_LIMIT", "ATTEMPT_LIMIT"]), tick: count.max(1001) }).nullable(),
    errors: z.array(z.object({ robotId: z.string().max(32), code: z.enum(["WALL", "OUT_OF_BOUNDS", "EMPTY_CELL", "HANDS_FULL", "EMPTY_HANDS", "ITEM_OCCUPIED"]), tick: count.max(1000), at: location })).max(4),
    items: z.array(z.object({ id: z.string().min(1).max(32), position: position.nullable() })).max(12).optional(),
    undeliveredItemIds: z.array(z.string().max(32)).max(12).optional(),
    unmetRobotIds: z.array(z.string().max(32)).max(4),
  }),
});
/** Read the recorded snapshot only. Never look up current templates or rerun a historical program. */
export function readParallelHistory(result: unknown) {
  const parsed = history.safeParse(result);
  if (!parsed.success) return null;
  try {
    const f = parsed.data.feedback, level = parseParallelLevel(f.levelSnapshot), program = parseParallelProgram(parsed.data.answer.program, level);
    const ids = new Set(level.robots.map((r) => r.id));
    if (f.robots.length !== ids.size || new Set(f.robots.map((r) => r.id)).size !== ids.size || f.robots.some((r) => !ids.has(r.id) || r.position.x >= level.width || r.position.y >= level.height)) return null;
    if (level.delivery) {
      const itemIds = new Set(level.delivery.items.map((i) => i.id));
      if (!f.items || f.items.length !== itemIds.size || new Set(f.items.map((i) => i.id)).size !== itemIds.size || f.items.some((i) => !itemIds.has(i.id) || (i.position && (i.position.x >= level.width || i.position.y >= level.height)))) return null;
      if (!f.undeliveredItemIds || new Set(f.undeliveredItemIds).size !== f.undeliveredItemIds.length || f.undeliveredItemIds.some((id) => !itemIds.has(id))) return null;
      const held = f.robots.flatMap((r) => r.holding ? [r.holding] : []);
      if (new Set(held).size !== held.length || held.some((id) => !itemIds.has(id)) || f.items.some((i) => (i.position === null) !== held.includes(i.id))) return null;
      if (new Set(f.items.filter((i) => i.position).map((i) => `${i.position!.x},${i.position!.y}`)).size !== f.items.filter((i) => i.position).length) return null;
    }
    return { feedback: f, level, program };
  } catch { return null; }
}
