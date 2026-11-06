import { z } from "zod";
import { ALL_PARALLEL_COMMANDS as PARALLEL_COMMANDS, PARALLEL_LIMITS, executeParallelProgram, parseParallelLevel, parseParallelProgram, type ParallelLevel, type ParallelProgram } from "./parallel-engine";
import { configureParallelTemplate, type ParallelTemplateId } from "./parallel-levels";
import { KNOWLEDGE_LIMITS } from "./knowledge";

/** Versioned v2 course configuration, selected by the shared course adapter.
 * Keep variant=programming; only explicit rulesVersion=2 selects this schema.
 */
export const parallelProgrammingEditingSchema = z.object({
  variant: z.literal("programming"),
  rulesVersion: z.literal(2),
  templateRevision: z.literal(1),
  templateId: z.enum(["parallel-lanes", "parallel-queue", "parallel-conditional-route", "parallel-goal-guard", "parallel-jump-route", "parallel-turn-corner", "parallel-boundary-check"]),
  robotCount: z.number().int().min(1).max(PARALLEL_LIMITS.robots),
  task: z.string().trim().min(1).max(4000),
  allowed: z.array(z.enum(PARALLEL_COMMANDS)).min(1).max(PARALLEL_COMMANDS.length),
  hints: z.array(z.string().max(2000)).max(12),
  customLevel: z.custom<ParallelLevel>((v) => { try { parseParallelLevel(v); return true; } catch { return false; } }, "Invalid custom map").optional(),
  referenceProgram: z.custom<ParallelProgram>(Array.isArray, "Invalid reference program").optional(),
  knowledge: z.array(z.object({ title: z.string().max(KNOWLEDGE_LIMITS.title), body: z.string().max(KNOWLEDGE_LIMITS.body) })).max(KNOWLEDGE_LIMITS.cards),
}).strict().superRefine((p, ctx) => {
  // Range refinements may already have reported issues; do not throw from safeParse.
  if (!Number.isInteger(p.robotCount) || p.robotCount < 1 || p.robotCount > PARALLEL_LIMITS.robots) return;
  if (new Set(p.allowed).size !== p.allowed.length) {
    ctx.addIssue({ code: "custom", path: ["allowed"], message: "Duplicate commands are not allowed." }); return;
  }
  if (p.customLevel !== undefined || p.referenceProgram !== undefined) {
    try {
      if (!p.customLevel || !p.referenceProgram) throw new Error("Provide both a map and reference answer.");
      const level = parseParallelLevel(p.customLevel);
      if (level.robots.length !== p.robotCount || level.allowed.length !== p.allowed.length || !p.allowed.every((op) => level.allowed.includes(op))) throw new Error("Map robots/commands do not match the configuration.");
      parseParallelProgram(p.referenceProgram, level);
    } catch (e) { ctx.addIssue({ code: "custom", path: ["referenceProgram"], message: e instanceof Error ? e.message : "Invalid custom map or reference answer." }); }
    return;
  }
  const t = configureParallelTemplate(p.templateId, p.robotCount);
  if (p.allowed.some((op) => !t.level.allowed.includes(op))) {
    ctx.addIssue({ code: "custom", path: ["allowed"], message: "This template does not support that command." }); return;
  }
  try {
    parseParallelProgram(t.reference, { ...t.level, allowed: p.allowed });
  } catch { ctx.addIssue({ code: "custom", path: ["allowed"], message: "Keep the commands required by the preset reference answer." }); }

}).transform((p) => p.customLevel ? { ...p, customLevel: parseParallelLevel(p.customLevel), referenceProgram: parseParallelProgram(p.referenceProgram, p.customLevel) } : p);
/** Authoritative save/publish validation still executes the reference on the server. */
export const parallelProgrammingPayloadSchema = parallelProgrammingEditingSchema.superRefine((p, ctx) => {
  const t = configureParallelTemplate(p.templateId, p.robotCount);
  const level = p.customLevel ?? { ...t.level, allowed: p.allowed };
  try {
    if (executeParallelProgram(level, p.customLevel ? p.referenceProgram : t.reference).status !== "passed")
      ctx.addIssue({ code: "custom", path: ["referenceProgram"], message: "The reference answer must pass the map." });
  } catch { ctx.addIssue({ code: "custom", path: ["referenceProgram"], message: "The reference answer must pass the map." }); }
});
export type ParallelProgrammingPayload = z.infer<typeof parallelProgrammingPayloadSchema>;
export function createParallelProgrammingPayload(templateId: ParallelTemplateId, locale: "en" | "zh", robotCount = 2): ParallelProgrammingPayload {
  const t = configureParallelTemplate(templateId, robotCount);
  return parallelProgrammingEditingSchema.parse({ variant: "programming", rulesVersion: 2, templateRevision: 1, templateId, robotCount,
    task: t.task[locale], allowed: t.level.allowed, hints: t.hints[locale], knowledge: t.knowledge?.[locale] ?? [] });
}
export function parallelProgrammingLevel(input: ParallelProgrammingPayload): ParallelLevel {
  const p = parallelProgrammingEditingSchema.parse(input);
  return p.customLevel ? parseParallelLevel(p.customLevel) : { ...configureParallelTemplate(p.templateId, p.robotCount).level, allowed: [...p.allowed] };
}
/** Separate hash domain and explicit semantics. The existing v1 serializer is untouched. */
export async function parallelProgrammingVersion(input: ParallelProgrammingPayload): Promise<string> {
  const p = parallelProgrammingEditingSchema.parse(input), level = parallelProgrammingLevel(p);
  const snapshot = { domain: "programming-v2", rulesVersion: p.rulesVersion, templateRevision: p.templateRevision,
    semantics: { ...(level.delivery?.numbers ? { numbers: "integer-item-snapshot-exact-zone-v1" } : {}), ...(level.delivery ? { delivery: "current-cell-one-item-snapshot-v1" } : {}), collision: "exclusive-snapshot-retry-v1", condition: "snapshot-one-tick-v1", jump: "root-marker-one-tick-v1", controls: "root-repeat-if-actions-v1" },
    level: { ...level, allowed: [...level.allowed].sort() }, limits: PARALLEL_LIMITS,
    ...(p.customLevel ? { referenceProgram: parseParallelProgram(p.referenceProgram, level) } : {}),
    task: p.task, hints: p.hints, knowledge: p.knowledge.map((c) => ({ title: c.title, body: c.body })) };
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(snapshot)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function parallelProgrammingReference(input: ParallelProgrammingPayload): ParallelProgram {
  const p = parallelProgrammingEditingSchema.parse(input);
  return p.customLevel ? parseParallelProgram(p.referenceProgram, p.customLevel) : configureParallelTemplate(p.templateId, p.robotCount).reference;
}
