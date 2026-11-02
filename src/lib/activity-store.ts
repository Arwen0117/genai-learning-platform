import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Block } from "@/lib/blocks/schema";
import type { ActivityGrade } from "@/lib/blocks/activity-result";
import { gameActivityContainerSchema } from "@/lib/game-activity";

export function contentVersionForBlock(block: Block): string {
  return createHash("sha256")
    .update(JSON.stringify(block))
    .digest("hex")
    .slice(0, 16);
}

function isSubstantiveAttempt(row: { result: unknown }): boolean {
  const previous = row.result as {
    answer?: { kind?: unknown };
    attempted?: unknown;
  };
  if (typeof previous.attempted === "boolean") return previous.attempted;
  return previous.answer?.kind !== "hint" && previous.answer?.kind !== "replay";
}

type PlaythroughClient = {
  findFirst: (args: unknown) => Promise<{
    id: string;
    publishedVersionId?: string | null;
  } | null>;
  create: (args: unknown) => Promise<{
    id: string;
    publishedVersionId?: string | null;
  }>;
  update: (args: unknown) => Promise<unknown>;
};

type VersionClient = {
  findFirst: (args: unknown) => Promise<{
    id: string;
    contentHash: string;
    snapshot: unknown;
  } | null>;
  findUnique: (args: unknown) => Promise<{
    id: string;
    contentHash: string;
    snapshot: unknown;
  } | null>;
};

export async function persistActivity(input: {
  userId: string;
  courseId: string;
  lessonId: string;
  block: Block;
  blocks: Block[];
  activityBlocks?: Block[];
  activityId?: string;
  attemptId: string;
  answer: Record<string, unknown>;
  grade: ActivityGrade;
}) {
  const {
    userId,
    courseId,
    lessonId,
    block,
    blocks,
    activityBlocks,
    activityId,
    attemptId,
    answer,
    grade,
  } = input;
  const contentVersion = contentVersionForBlock(block);
  // Serializable + bounded retry prevents parallel blocks overwriting completedBlocks.
  for (let retry = 0; ; retry++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const key = { userId, lessonId, blockId: block.id, attemptId };
          const existing = await tx.activityAttempt.findUnique({
            where: { userId_lessonId_blockId_attemptId: key },
          });
          if (existing) return existing;
          const clientPlaythroughId =
            typeof answer.playthroughId === "string" &&
            answer.playthroughId.length > 0
              ? answer.playthroughId
              : null;
          const playthroughClient = (tx as { playthrough?: PlaythroughClient })
            .playthrough;
          const versionClient = (
            tx as { gameActivityVersion?: VersionClient }
          ).gameActivityVersion;
          const latestPublishedVersion =
            activityId === undefined || versionClient === undefined
              ? null
              : await versionClient.findFirst({
                  where: { lessonId, activityId },
                  orderBy: [{ version: "desc" }, { id: "desc" }],
                  select: { id: true, contentHash: true, snapshot: true },
                });
          const isReplay = answer.kind === "replay";
          const playthroughData = {
            userId,
            lessonId,
            activityId,
            clientCorrelationId: clientPlaythroughId,
            publishedVersionId: latestPublishedVersion?.id ?? null,
            contentHash: latestPublishedVersion?.contentHash ?? null,
          };
          const playthrough =
            activityId === undefined || playthroughClient === undefined
              ? null
              : isReplay
                ? await playthroughClient.create({
                    data: playthroughData,
                  })
                : ((await playthroughClient.findFirst({
                    where: {
                      userId,
                      lessonId,
                      activityId,
                      status: "IN_PROGRESS",
                      ...(latestPublishedVersion?.contentHash
                        ? { contentHash: latestPublishedVersion.contentHash }
                        : {}),
                    },
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    select: { id: true, publishedVersionId: true },
                  })) ??
                  (await playthroughClient.create({
                    data: playthroughData,
                  })));
          const boundVersion =
            playthrough === null || versionClient === undefined
              ? latestPublishedVersion
              : playthrough.publishedVersionId
                ? ((await versionClient.findUnique({
                    where: { id: playthrough.publishedVersionId },
                    select: { id: true, contentHash: true, snapshot: true },
                  })) ?? latestPublishedVersion)
                : latestPublishedVersion;
          const versionSnapshot = gameActivityContainerSchema.safeParse(
            boundVersion?.snapshot,
          );
          const versionChallengeBlocks = versionSnapshot.success
            ? versionSnapshot.data.challenges
            : activityBlocks;
          const previousAttempts = await tx.activityAttempt.findMany({
            where: { userId, lessonId, blockId: block.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          });
          const playthroughId = playthrough?.id ?? clientPlaythroughId;
          const priorPlaythroughAttempts = previousAttempts.filter((row) => {
            const previous = row.result as {
              playthroughId?: unknown;
              contentVersion?: unknown;
            };
            return (
              previous.contentVersion === contentVersion &&
              previous.playthroughId === playthroughId
            );
          });
          const isSignal =
            answer.kind === "hint" ||
            answer.kind === "replay" ||
            grade.feedback.kind === "hint";
          const attempted = !isSignal;
          const result = {
            version: 1,
            attemptId,
            activityType: block.type,
            blockId: block.id,
            lessonId,
            courseId,
            activityId: activityId ?? null,
            contentVersion,
            playthroughId,
            attemptNumber: priorPlaythroughAttempts.length + 1,
            attempted,
            firstPass: !isSignal && !priorPlaythroughAttempts.some(isSubstantiveAttempt),
            answer,
            ...grade,
            activitySnapshot: block,
          };
          const attempt = await tx.activityAttempt.create({
            data: {
              ...key,
              blockType: block.type,
              ...(playthrough === null
                ? {}
                : { playthroughId: playthrough.id }),
              result: JSON.parse(
                JSON.stringify(result),
              ) as Prisma.InputJsonValue,
            },
          });
          const progress = await tx.lessonProgress.findUnique({
            where: { userId_lessonId: { userId, lessonId } },
          });
          const completedBlocks = new Set(
            Array.isArray(progress?.completedBlocks)
              ? progress.completedBlocks.filter(
                  (v): v is string => typeof v === "string",
                )
              : [],
          );
          const wasCompleted = completedBlocks.has(block.id);
          if (grade.completed) completedBlocks.add(block.id);
          const playthroughChallenges = versionChallengeBlocks ?? activityBlocks;
          const playthroughCompletedBlocks = new Set(
            (playthroughChallenges === undefined
              ? previousAttempts
              : await tx.activityAttempt.findMany({
                  where: {
                    userId,
                    lessonId,
                    blockId: {
                      in: playthroughChallenges.map((item) => item.id),
                    },
                  },
                })
            )
              .filter((row) => {
                const result = row.result as {
                  playthroughId?: unknown;
                  completed?: unknown;
                  contentVersion?: unknown;
                };
                return (
                  result.playthroughId === playthrough?.id &&
                  result.completed === true &&
                  playthroughChallenges?.some(
                    (item) =>
                      item.id === row.blockId &&
                      result.contentVersion === contentVersionForBlock(item),
                  )
                );
              })
              .map((row) => row.blockId),
          );
          if (grade.completed) playthroughCompletedBlocks.add(block.id);
          const activityDone =
            playthroughChallenges?.every((b) =>
              playthroughCompletedBlocks.has(b.id),
            ) ?? false;
          const allDone = blocks.every((b) => completedBlocks.has(b.id));
          const attempts = await tx.activityAttempt.findMany({
            where: { userId, lessonId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          });
          const scores = new Map<string, number>();
          for (const row of attempts) {
            const r = row.result as { score?: { normalized?: number } | null };
            if (
              !scores.has(row.blockId) &&
              typeof r.score?.normalized === "number" &&
              blocks.some((b) => b.id === row.blockId)
            )
              scores.set(row.blockId, r.score.normalized);
          }
          const score = scores.size
            ? [...scores.values()].reduce((a, b) => a + b, 0) / scores.size
            : (progress?.score ?? null);
          const data = {
            completedBlocks: [...completedBlocks],
            score,
            status: allDone ? ("COMPLETED" as const) : ("IN_PROGRESS" as const),
          };
          await tx.lessonProgress.upsert({
            where: { userId_lessonId: { userId, lessonId } },
            create: { userId, lessonId, ...data },
            update: data,
          });
          const eventType = {
            quiz: "QUIZ_ATTEMPT",
            game: grade.completed ? "GAME_FINISH" : "GAME_ATTEMPT",
            simulation: "SIM_END",
            coding:
              answer.kind === "review" ? "CODING_REVIEW" : "CODING_SUBMIT",
            roleplay: "ROLEPLAY_END",
            reflection: "REFLECTION_SUBMIT",
            reading: "ACTIVITY_SUBMIT",
            flashcards: "ACTIVITY_SUBMIT",
            slides: "ACTIVITY_SUBMIT",
          }[block.type];
          const payload = {
            version: 1,
            attemptId,
            lessonId,
            blockId: block.id,
            activityType: block.type,
            activityId: activityId ?? null,
            score: grade.score?.normalized ?? null,
            completed: grade.completed,
            passed: grade.passed,
            contentVersion,
            playthroughId,
            attemptNumber: priorPlaythroughAttempts.length + 1,
            attempted,
            firstPass: !isSignal && !priorPlaythroughAttempts.some(isSubstantiveAttempt),
            ...grade.feedback,
          } as Prisma.InputJsonValue;
          await tx.engagementEvent.create({
            data: { userId, courseId, type: eventType, payload },
          });
          if (block.type === "quiz")
            await tx.engagementEvent.create({
              data: { userId, courseId, type: "QUIZ_SUBMIT", payload },
            });
          if (grade.completed && !wasCompleted)
            await tx.engagementEvent.create({
              data: { userId, courseId, type: "BLOCK_COMPLETE", payload },
            });
          if (playthrough !== null && activityDone)
            await playthroughClient?.update({
              where: { id: playthrough.id },
              data: { status: "COMPLETED", completedAt: new Date() },
            });
          if (allDone) {
            const incomplete = await tx.lesson.count({
              where: {
                module: { courseId },
                progress: { none: { userId, status: "COMPLETED" } },
              },
            });
            if (!incomplete)
              await tx.enrollment.updateMany({
                where: { userId, courseId, completedAt: null },
                data: { completedAt: new Date() },
              });
          }
          return attempt;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        retry < 3 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code)
      )
        continue;
      throw error;
    }
  }
}
