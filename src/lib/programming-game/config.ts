import { z } from "zod";
import { ACTIONS, LIMITS } from "./engine";
import {
  getTemplate,
  validateTemplateAllowed,
  type TemplateId,
} from "./levels";
import { getDefaultKnowledge, KNOWLEDGE_LIMITS } from "./knowledge";

export const programmingPayloadSchema = z
  .object({
    variant: z.literal("programming"),
    templateId: z.enum(["first-route", "parcel-delivery", "repeat-route"]),
    task: z.string().trim().min(1).max(4000),
    allowed: z
      .array(z.enum([...ACTIONS, "repeat"]))
      .min(1)
      .max(7),
    hints: z.array(z.string().max(2000)).max(12),
    knowledge: z
      .array(
        z.object({
          title: z.string().max(KNOWLEDGE_LIMITS.title),
          body: z.string().max(KNOWLEDGE_LIMITS.body),
        }),
      )
      .max(KNOWLEDGE_LIMITS.cards),
  })
  .superRefine((payload, ctx) => {
    try {
      validateTemplateAllowed(payload.templateId, payload.allowed);
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["allowed"],
        message:
          "The preset reference solution must remain executable. Restore the required commands.",
      });
    }
  });
export type ProgrammingPayload = z.infer<typeof programmingPayloadSchema>;

export function createProgrammingPayload(
  id: TemplateId,
  locale: "en" | "zh",
): ProgrammingPayload {
  const template = getTemplate(id);
  return {
    variant: "programming",
    templateId: id,
    task: template.task[locale],
    allowed: [...template.level.allowed],
    hints: [],
    knowledge: getDefaultKnowledge(id, locale),
  };
}

export function programmingLevel(payload: ProgrammingPayload) {
  return validateTemplateAllowed(payload.templateId, payload.allowed);
}

/** Covers rendered teaching content, authoritative preset rules and execution limits.
 * Field order is explicit; allowed command order has no semantic meaning.
 */
export async function programmingVersion(
  input: ProgrammingPayload,
): Promise<string> {
  const p = programmingPayloadSchema.parse(input);
  const level = programmingLevel(p);
  const text = JSON.stringify({
    version: 1,
    level: { ...level, allowed: [...level.allowed].sort() },
    limits: LIMITS,
    task: p.task,
    hints: p.hints,
    knowledge: p.knowledge.map((c) => ({ title: c.title, body: c.body })),
  });
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
