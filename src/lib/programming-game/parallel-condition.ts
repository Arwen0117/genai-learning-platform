import type { ParallelCondition, ParallelDirection } from "./parallel-engine";
export function parallelObservation(condition: ParallelCondition): ParallelDirection | "current" | "self" {
  return condition.kind === "holding" || (condition.kind === "value" && condition.source === "holding") ? "self" : "direction" in condition && condition.direction ? condition.direction : "current";
}
/** Switching between spatial tests preserves the selected observation. Holding
 * is deliberately self-only; it must not display a misleading directional arrow. */
export function changeParallelConditionKind(condition: ParallelCondition, kind: ParallelCondition["kind"]): ParallelCondition {
  const scope = parallelObservation(condition), direction = scope === "current" || scope === "self" ? undefined : scope;
  if (kind === condition.kind) return condition;
  if (kind === "value") return { kind, source: "item", operator: "gte", value: 0, not: condition.not, ...(direction ? { direction } : {}) };
  if (kind === "holding") return { kind, not: condition.not };
  if (kind === "goal" || kind === "item") return { kind, not: condition.not, ...(direction ? { direction } : {}) };
  return { kind, direction: direction ?? "right", not: condition.not };
}
export function changeParallelObservation(condition: ParallelCondition, scope: ParallelDirection | "current"): ParallelCondition {
  if (condition.kind === "holding" || (condition.kind === "value" && condition.source === "holding")) return condition;
  if (condition.kind === "value") { const next = { ...condition }; delete next.direction; return { ...next, ...(scope === "current" ? {} : { direction: scope }) }; }
  if (condition.kind === "goal" || condition.kind === "item") return { kind: condition.kind, not: condition.not, ...(scope === "current" ? {} : { direction: scope }) };
  return scope === "current" ? condition : { ...condition, direction: scope };
}

export function parallelObservationLabel(condition: ParallelCondition, labels: Record<ReturnType<typeof parallelObservation>, string>): string {
  return labels[parallelObservation(condition)];
}

export const PARALLEL_COMPARISON_SYMBOLS = { eq: "=", ne: "≠", lt: "<", lte: "≤", gt: ">", gte: "≥" } as const;
export function parallelConditionLabel(condition: ParallelCondition, labels: Record<ReturnType<typeof parallelObservation>, string>, kinds: Record<ParallelCondition["kind"], string>, valueSources: { item: string; holding: string }): string {
  const scope = parallelObservationLabel(condition, labels);
  if (condition.kind === "value") return `${condition.not ? "NOT (" : ""}${scope} · ${valueSources[condition.source]} ${PARALLEL_COMPARISON_SYMBOLS[condition.operator]} ${condition.value}${condition.not ? ")" : ""}`;
  return `${scope} ${condition.not ? "≠" : "="} ${kinds[condition.kind]}`;
}
