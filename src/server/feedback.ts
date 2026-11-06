"use server";

import { z } from "zod";

import { getI18n } from "@/i18n/server";
import { trackEvent } from "@/lib/analytics";
import { auth } from "@/lib/auth";
import { FEEDBACK_REASONS, MAX_FEEDBACK_NOTE_CHARS } from "@/lib/feedback";
import { prisma } from "@/lib/prisma";

/**
 * Lesson-level feedback: closes the loop between learners and teachers.
 *
 * One row per learner per lesson: submitting again replaces the previous
 * verdict, so a learner can correct themselves without stacking rows. Access
 * follows the same rules as `activityAccess` in `lib/activity-access.ts`:
 * signed in, LEARNER role, enrolled, published course. Teachers are refused on
 * purpose — their preview must never look like learner feedback.
 */

export type SubmitLessonFeedbackResult =
  | { ok: true }
  | { ok: false; error: string };

const submitSchema = z.object({
  lessonId: z.string().min(1),
  reason: z.enum(FEEDBACK_REASONS),
  note: z.string().trim().max(MAX_FEEDBACK_NOTE_CHARS).optional(),
});

export type SubmitLessonFeedbackInput = z.input<typeof submitSchema>;

/** Blank notes are stored as null so "no comment" is one value, not two. */
function normaliseNote(note: string | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

export async function submitLessonFeedback(
  input: SubmitLessonFeedbackInput,
): Promise<SubmitLessonFeedbackResult> {
  const { t } = await getI18n();

  const parsedInput = submitSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: t("server.feedback.invalid") };
  }

  const session = await auth();
  const user = session?.user;
  if (user?.id === undefined) {
    return { ok: false, error: t("server.feedback.signIn") };
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: parsedInput.data.lessonId },
    select: {
      id: true,
      module: { select: { course: { select: { id: true, status: true } } } },
    },
  });
  if (lesson === null) {
    return { ok: false, error: t("server.feedback.notFound") };
  }

  const course = lesson.module.course;

  if (user.role !== "LEARNER") {
    return { ok: false, error: t("server.feedback.learnerOnly") };
  }
  if (course.status !== "PUBLISHED") {
    return { ok: false, error: t("server.feedback.unavailable") };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { id: true },
  });
  if (enrollment === null) {
    return { ok: false, error: t("server.feedback.notEnrolled") };
  }

  const note = normaliseNote(parsedInput.data.note);

  try {
    await prisma.lessonFeedback.upsert({
      where: { lessonId_userId: { lessonId: lesson.id, userId: user.id } },
      update: {
        courseId: course.id,
        reason: parsedInput.data.reason,
        note,
      },
      create: {
        lessonId: lesson.id,
        courseId: course.id,
        userId: user.id,
        reason: parsedInput.data.reason,
        note,
      },
    });

    // Analytics must never block the learner: trackEvent swallows its errors.
    await trackEvent("LESSON_FEEDBACK", {
      userId: user.id,
      courseId: course.id,
      payload: {
        lessonId: lesson.id,
        reason: parsedInput.data.reason,
        hasNote: note !== null,
      },
    });

    return { ok: true };
  } catch (error: unknown) {
    console.error("[feedback] failed to save lesson feedback", error);
    return { ok: false, error: t("server.feedback.failed") };
  }
}
