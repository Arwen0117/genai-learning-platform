"use client";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { postJson } from "@/lib/post-json";
import { parallelProgrammingTeaching, parallelProgrammingLevel, parallelProgrammingReference, parallelProgrammingVersion, type ParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
import { ParallelProgrammingGame } from "./ParallelProgrammingGame";
import type { ProgrammingSubmitResult } from "./ProgrammingActivity";
import { GAME_MESSAGES } from "./messages";

export function ParallelProgrammingActivity({ payload, title, lessonId, blockId, preview, onPassed }: {
  payload: ParallelProgrammingPayload; title: string; lessonId: string; blockId: string; preview: boolean; onPassed?: () => void;
}) {
  const { locale } = useI18n(), router = useRouter(), m = GAME_MESSAGES[locale];
  return <ParallelProgrammingGame course teaching={parallelProgrammingTeaching(payload, locale)} level={parallelProgrammingLevel(payload)} title={title} task={payload.task}
    hints={payload.hints} knowledge={payload.knowledge} reference={parallelProgrammingReference(payload)} locale={locale} onLocalPassed={preview ? onPassed : undefined}
    onSubmit={preview ? undefined : async ({ attemptId, program }) => {
      const levelVersion = await parallelProgrammingVersion(payload);
      const result = await postJson<ProgrammingSubmitResult>("/api/activities", { lessonId, blockId, submission: { attemptId, answer: { program, levelVersion } } },
        { timeoutMs: 30000, timeoutMessage: m.submitTimeout, failureMessage: m.submitFailed });
      if (result.ok) { if (result.grade.completed) onPassed?.(); router.refresh(); }
      return result;
    }} />;
}
