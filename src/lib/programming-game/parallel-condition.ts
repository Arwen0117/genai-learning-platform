import type { ParallelCondition, ParallelDirection } from "./parallel-engine";
export function parallelObservation(condition: ParallelCondition): ParallelDirection | "current" | "self" {
  return condition.kind === "holding" ? "self" : "direction" in condition && condition.direction ? condition.direction : "current";
}
/** Switching between spatial tests preserves the selected observation. Holding
 * is deliberately self-only; it must not display a misleading directional arrow. */
export function changeParallelConditionKind(condition: ParallelCondition, kind: ParallelCondition["kind"]): ParallelCondition {
  const scope = parallelObservation(condition), direction = scope === "current" || scope === "self" ? undefined : scope;
  if (kind === "holding") return { kind, not: condition.not };
  if (kind === "goal" || kind === "item") return { kind, not: condition.not, ...(direction ? { direction } : {}) };
  return { kind, direction: direction ?? "right", not: condition.not };
}
export function changeParallelObservation(condition: ParallelCondition, scope: ParallelDirection | "current"): ParallelCondition {
  if (condition.kind === "holding") return condition;
  if (condition.kind === "goal" || condition.kind === "item") return { kind: condition.kind, not: condition.not, ...(scope === "current" ? {} : { direction: scope }) };
  return scope === "current" ? condition : { ...condition, direction: scope };
}

export function parallelObservationLabel(condition: ParallelCondition, labels: Record<ReturnType<typeof parallelObservation>, string>): string {
  return labels[parallelObservation(condition)];
}
