"use server";

import { z } from "zod";
import { activityAccess } from "@/lib/activity-access";
import { persistActivity } from "@/lib/activity-store";
import {
  activitySubmissionSchema,
  gradeActivity,
} from "@/lib/blocks/activity-result";
import { prisma } from "@/lib/prisma";
import { courseProgrammingVersion, isParallelProgramming } from "@/lib/programming-game/course-config";
import { parallelProgrammingLevel } from "@/lib/programming-game/parallel-config";
import { parseParallelProgram } from "@/lib/programming-game/parallel-engine";
import type { ActivityGrade } from "@/lib/blocks/activity-result";

export async function submitActivity(
  lessonId: string,
  blockId: string,
  input: z.input<typeof activitySubmissionSchema>,
  preview = false,
) {
  try {
    const parsed = activitySubmissionSchema.parse(input);
    if (JSON.stringify(parsed).length > 250000)
      throw new Error("Submission is too large.");
    const access = await activityAccess(lessonId, blockId, undefined, preview);
    // A teacher preview is read-only: never create ActivityAttempt or
    // LessonProgress rows while the teacher is looking at the course.
    if (access.preview) return { ok: true as const, id: null };
    // Authorization precedes deduplication. A saved retry returns its original
    // grade even when the teacher has subsequently changed the level.
    const existing = await prisma.activityAttempt.findUnique({
      where: { userId_lessonId_blockId_attemptId: {
        userId: access.userId, lessonId, blockId, attemptId: parsed.attemptId,
      } },
    });
    if (existing) return { ok: true as const, id: existing.id, grade: savedGrade(existing.result) };
    const programming = access.block.type === "game" && access.block.payload.variant === "programming";
    if (access.block.type === "game" && access.block.payload.variant === "programming") {
      const version = await courseProgrammingVersion(access.block.payload);
      if (parsed.answer.levelVersion !== version)
        return { ok: false as const, code: "LEVEL_CHANGED" as const, error: "Level updated. Reload before submitting; keep a copy of your program." };
    }
    const grade = gradeActivity(access.block, parsed.answer);
    if (programming) grade.feedback.levelVersion = parsed.answer.levelVersion;
    const answer = access.block.type === "game" && access.block.payload.variant === "programming" && isParallelProgramming(access.block.payload)
      ? { program: parseParallelProgram(parsed.answer.program, parallelProgrammingLevel(access.block.payload)), levelVersion: parsed.answer.levelVersion }
      : parsed.answer;
    const attempt = await persistActivity({
      ...access,
      courseId: access.courseId!,
      lessonId,
      attemptId: parsed.attemptId,
      answer,
      grade,
    });
    return { ok: true as const, id: attempt.id, grade: savedGrade(attempt.result) };
  } catch (cause) {
    return {
      ok: false as const,
      error:
        cause instanceof Error
          ? cause.message
          : "Could not save submission. Please retry.",
    };
  }
}

/** Cursor pagination; private to the signed-in learner. Teacher analytics can use the same table. */
export async function loadActivityAttempts(
  lessonId: string,
  blockId: string,
  cursor?: string,
  preview = false,
) {
  try {
    const access = await activityAccess(lessonId, blockId, undefined, preview);
    if (access.preview)
      return { ok: true as const, attempts: [], nextCursor: null };
    const rows = await prisma.activityAttempt.findMany({
      where: { userId: access.userId, lessonId, blockId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      ok: true as const,
      attempts: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        result: r.result,
      })),
      nextCursor: rows.length === 20 ? rows[19].id : null,
    };
  } catch (cause) {
    return {
      ok: false as const,
      error: cause instanceof Error ? cause.message : "Cannot load history.",
    };
  }
}

/** Only expose the stored grade; identity and snapshot remain in private history. */
function savedGrade(result: unknown): ActivityGrade {
  const r = result as ActivityGrade;
  return { score: r.score, completed: r.completed, passed: r.passed, verification: r.verification, feedback: r.feedback };
}
