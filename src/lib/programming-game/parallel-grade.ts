import type { ActivityGrade } from "@/lib/blocks/activity-result";
import { executeParallelProgram, PARALLEL_LIMITS } from "./parallel-engine";
import { parallelProgrammingLevel, parallelProgrammingPayloadSchema, type ParallelProgrammingPayload } from "./parallel-config";
export const PARALLEL_FEEDBACK_BYTES = 240000;
/** Only authoritative course data chooses rules and budgets. No client world state is read. */
export function gradeParallelProgramming(payload: ParallelProgrammingPayload, answer: Record<string, unknown>): ActivityGrade {
  const config = parallelProgrammingPayloadSchema.parse(payload);
  const run = executeParallelProgram(parallelProgrammingLevel(config), answer.program);
  const passed = run.status === "passed";
  const feedback = {
    variant: "programming", feedbackVersion: 2, rulesVersion: 2, templateRevision: config.templateRevision,
    configSnapshot: config, levelSnapshot: run.level, limitsSnapshot: { ...PARALLEL_LIMITS, ...run.limits },
    status: run.status, worldTicks: run.worldTicks, instructionAttempts: run.instructionAttempts,
    successfulMoves: run.successfulMoves, nodeCount: run.nodeCount, robots: run.robots,
    failure: run.failure, errors: run.errors, unmetRobotIds: run.unmetRobotIds,
    ...(run.level.delivery ? { items: run.items, undeliveredItemIds: run.undeliveredItemIds } : {}),
  };
  // Reserve 10KB below the 250KB event budget for its envelope; include the server-added hash.
  if (new TextEncoder().encode(JSON.stringify({ ...feedback, levelVersion: "0".repeat(64) })).length > PARALLEL_FEEDBACK_BYTES)
    throw new Error("Programming feedback is too large. Shorten the teaching content.");
  return { score: { raw: passed ? 100 : 0, min: 0, max: 100, normalized: passed ? 1 : 0 }, completed: passed, passed, verification: "server", feedback };
}
