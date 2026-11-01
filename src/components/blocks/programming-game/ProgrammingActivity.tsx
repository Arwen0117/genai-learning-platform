"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import type { ActivityGrade } from "@/lib/blocks/activity-result";
import {
  programmingLevel,
  programmingVersion,
  type ProgrammingPayload,
} from "@/lib/programming-game/config";
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
  payload: ProgrammingPayload;
  title: string;
  lessonId: string;
  blockId: string;
  preview: boolean;
}) {
  const { locale } = useI18n();
  const m = GAME_MESSAGES[locale];
  const router = useRouter();
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
              const levelVersion = await programmingVersion(payload);
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
