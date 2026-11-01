import { z } from "zod";

import { gameBlockSchema, type GameBlock } from "@/lib/blocks/schema";
import type { ContentLanguage } from "@/lib/llm/language";

export const gameChallengeSchema = gameBlockSchema.superRefine((block, ctx) => {
  if (block.payload.feedback === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["payload", "feedback"],
      message: "Every Challenge needs correct and incorrect feedback.",
    });
  }
});

/**
 * First-class activity boundary. The legacy array schema remains exported
 * while callers migrate, but new surfaces can validate an activity without
 * losing its identity, title, or Challenge ordering.
 */
export const gameActivityContainerSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    challenges: z.array(gameChallengeSchema).length(5),
  })
  .superRefine((activity, ctx) => {
    const ids = activity.challenges.map((challenge) => challenge.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["challenges"],
        message: "Game Activity Challenges must have unique ids.",
      });
    }
  });

export const gameActivitySchema = z.array(gameChallengeSchema).length(5);
export type GameActivity = z.infer<typeof gameActivitySchema>;
export type GameActivityContainer = z.infer<typeof gameActivityContainerSchema>;

type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

function hasChinese(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
}

function hasLatin(value: string): boolean {
  return /[A-Za-z]/u.test(value);
}

const technicalTerms =
  /\b(?:AI|API|Bash|CSS|Docker|Git|GitHub|GraphQL|HTML|HTTP|Java|JavaScript|JSON|Kubernetes|Markdown|Next\.js|Node\.js|npm|Python|React|SQL|TypeScript|URL)\b/giu;
const technicalIdentifier = /\b[A-Za-z]+(?:[A-Z][A-Za-z]+|[_-][A-Za-z0-9]+|\d)[A-Za-z0-9_-]*\b/gu;

function localeText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gu, " ")
    .replace(/`[^`]*`/gu, " ")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/gu, " ")
    .replace(technicalTerms, " ")
    .replace(technicalIdentifier, " ");
}

function stringsFor(block: GameBlock): string[] {
  const payload = block.payload;
  const mediaText =
    payload.supportingMedia?.decorative === true
      ? []
      : [payload.supportingMedia?.altText ?? ""];
  if (payload.variant === "sort")
    return [block.title, ...payload.items.map((item) => item.text), ...mediaText];
  if (payload.variant === "match")
    return [
      block.title,
      ...payload.pairs.flatMap((pair) => [pair.left, pair.right]),
      ...mediaText,
    ];
  return [
    block.title,
    payload.prompt,
    ...payload.options.map((option) => option.text),
    ...mediaText,
  ];
}

export function validateGameActivity(
  input: unknown,
  language: ContentLanguage,
): ValidationResult {
  const isContainer =
    typeof input === "object" && input !== null && !Array.isArray(input);
  const parsed = isContainer
    ? gameActivityContainerSchema.safeParse(input)
    : gameActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  }

  const challenges: GameActivity =
    isContainer
      ? (parsed.data as GameActivityContainer).challenges
      : (parsed.data as GameActivity);
  const errors: string[] = [];
  const variants = new Set(challenges.map((block) => block.payload.variant));
  for (const variant of ["sort", "match", "choose"] as const) {
    if (!variants.has(variant))
      errors.push(`The activity needs at least one ${variant} Challenge.`);
  }
  for (const [index, block] of challenges.entries()) {
    const payload = block.payload;
    if (payload.variant === "choose" && payload.options.filter((option) => !option.correct).length < 2)
      errors.push(`Challenge ${index + 1} needs at least two plausible distractors.`);
    if (payload.variant === "match") {
      const left = payload.pairs.map((pair) => pair.left);
      const right = payload.pairs.map((pair) => pair.right);
      if (new Set(left).size !== left.length || new Set(right).size !== right.length)
        errors.push(`Challenge ${index + 1} has ambiguous matching keys.`);
    }

      const text = localeText([
        ...stringsFor(block),
        block.payload.feedback?.correct ?? "",
        block.payload.feedback?.incorrect ?? "",
        block.payload.hint ?? "",
      ].join(" "));
      if ((language === "en" && hasChinese(text)) || (language === "zh" && hasLatin(text)))
        errors.push(`Challenge ${index + 1} does not match the lesson locale.`);
      if (/(?:click|color|colour|audio-only|sound-only)/iu.test(text))
        errors.push(`Challenge ${index + 1} contains an inaccessible interaction cue.`);
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
