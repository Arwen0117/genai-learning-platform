"use client";

import { z } from "zod";
import { useI18n } from "@/i18n/client";
import { parseProgram, type Program } from "@/lib/programming-game/engine";
import { parseLevel } from "@/lib/programming-game/engine";
import { GAME_MESSAGES } from "./messages";

const summarySchema = z.object({
  answer: z.object({ program: z.unknown() }),
  feedback: z.object({
    variant: z.literal("programming"),
    status: z.enum(["passed", "incomplete", "error"]),
    steps: z.number().int().nonnegative(),
    nodeCount: z.number().int().nonnegative(),
    loopIterations: z.number().int().nonnegative(),
    levelVersion: z.string(),
    levelSnapshot: z.unknown(),
    error: z
      .object({
        code: z.string(),
        at: z.object({
          path: z.array(z.number()),
          iteration: z.number().nullable(),
        }),
      })
      .nullable(),
    finalState: z.object({
      robot: z.object({ x: z.number(), y: z.number() }),
      holding: z.boolean(),
    }),
  }),
});

export function ProgrammingAttemptSummary({ result }: { result: unknown }) {
  const { locale } = useI18n();
  const m = GAME_MESSAGES[locale];
  const parsed = summarySchema.safeParse(result);
  if (!parsed.success)
    return (
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  const { answer, feedback: f } = parsed.data;
  let program: Program;
  try {
    program = parseProgram(answer.program, parseLevel(f.levelSnapshot));
  } catch {
    return (
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  }
  const lines = program.flatMap((c, index) =>
    c.op === "repeat"
      ? [
          `${index + 1}. ${m.repeat} × ${c.count}`,
          ...c.body.map((a) => `    ${m.actions[a.op]}`),
        ]
      : [`${index + 1}. ${m.actions[c.op]}`],
  );
  return (
    <div className="space-y-2 pt-3 text-sm">
      <p>
        {m[f.status]} · {m.steps}: {f.steps} · {m.nodes}: {f.nodeCount} ·{" "}
        {m.iteration}: {f.loopIterations}
      </p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3">
        {lines.join("\n")}
      </pre>
      {f.error ? (
        <p>
          {m.error}:{" "}
          {m.errors[f.error.code as keyof typeof m.errors] ?? f.error.code} ·{" "}
          {m.at}: {f.error.at.path.map((i) => i + 1).join(".")}
          {f.error.at.iteration !== null
            ? ` · ${m.iteration}: ${f.error.at.iteration}`
            : ""}
        </p>
      ) : (
        <p>{m.noError}</p>
      )}
      <p>
        {m.finalState}: {m.position} ({f.finalState.robot.x},{" "}
        {f.finalState.robot.y}) · {m.carrying}:{" "}
        {f.finalState.holding ? m.yes : m.no}
      </p>
      <p className="break-all text-xs text-muted-foreground">
        SHA-256: {f.levelVersion}
      </p>
      <details>
        <summary>{m.rawRecord}</summary>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}
