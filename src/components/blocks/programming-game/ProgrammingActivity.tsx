"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import type { ActivityGrade } from "@/lib/blocks/activity-result";
import { programmingLevel } from "@/lib/programming-game/config";
import { courseProgrammingVersion, isParallelProgramming, type CourseProgrammingPayload } from "@/lib/programming-game/course-config";
import { ParallelProgrammingActivity } from "./ParallelProgrammingActivity";
import { postJson } from "@/lib/post-json";
import { ProgrammingGame } from "./ProgrammingGame";
import { GAME_MESSAGES } from "./messages";

export type ProgrammingSubmitResult =
  | { ok: true; id: string; grade: ActivityGrade }
  | { ok: false; error: string; code?: string };

export function ProgrammingActivity({
  payload,
  title,
  lessonId,
  blockId,
  preview,
}: {
  payload: CourseProgrammingPayload;
  title: string;
  lessonId: string;
  blockId: string;
  preview: boolean;
}) {
  const { locale } = useI18n();
  const m = GAME_MESSAGES[locale];
  const router = useRouter();
  if (isParallelProgramming(payload)) return <ParallelProgrammingActivity payload={payload} title={title} lessonId={lessonId} blockId={blockId} preview={preview} />;
  return (
    <ProgrammingGame
      level={programmingLevel(payload)}
      title={title}
      task={payload.task}
      hints={payload.hints}
      knowledge={payload.knowledge}
      locale={locale}
      onSubmit={
        preview
          ? undefined
          : async ({ attemptId, program }) => {
              const levelVersion = await courseProgrammingVersion(payload);
              const result = await postJson<ProgrammingSubmitResult>(
                "/api/activities",
                {
                  lessonId,
                  blockId,
                  submission: { attemptId, answer: { program, levelVersion } },
                },
                {
                  timeoutMs: 30_000,
                  timeoutMessage: m.submitTimeout,
                  failureMessage: m.submitFailed,
                },
              );
              if (result.ok) router.refresh();
              return result;
            }
      }
    />
  );
}
