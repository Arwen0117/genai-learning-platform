"use server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRobotCourse, ROBOT_COURSE_TOPIC, robotCourseDraftSchema, type RobotCourseDraft } from "@/lib/programming-game/robot-course";
import { courseProgrammingPayloadSchema, isParallelProgramming } from "@/lib/programming-game/course-config";

export async function saveRobotCourse(courseId: string | null, input: unknown) {
  try {
    const user = (await auth())?.user;
    if (!user || (user.role !== "INSTRUCTOR" && user.role !== "ADMIN")) throw new Error("Teacher access required.");
    const p = robotCourseDraftSchema.parse(input);
    const saved = await prisma.$transaction(async (tx) => {
      if (!courseId) {
        const prior = await tx.course.findUnique({ where: { id: p.draftId } });
        if (prior) {
          if (prior.createdById !== user.id || !isRobotCourse(prior)) throw new Error("Game course not owned by you.");
          return { courseId: prior.id, updatedAt: prior.updatedAt.toISOString() };
        }
        const course = await tx.course.create({ data: {
          id: p.draftId, slug: `robot-game-${randomUUID()}`, topic: ROBOT_COURSE_TOPIC, title: p.title, description: p.description, language: p.language,
          audience: "All learners", difficulty: "beginner", coverEmoji: "🤖", source: "INSTRUCTOR", status: p.status, createdById: user.id,
          modules: { create: { title: p.title, order: 0, lessons: { create: p.levels.map((l, i) => ({ id: l.lessonId, title: l.title, order: i, estimatedMinutes: 10,
            blocks: JSON.parse(JSON.stringify([{ id: l.blockId, type: "game", title: l.title, payload: l.payload }])) as Prisma.InputJsonValue })) } } },
        } }); return { courseId: course.id, updatedAt: course.updatedAt.toISOString() };
      }
      if (p.draftId !== courseId) throw new Error("Course identity changed.");
      const existing = await tx.course.findUnique({ where: { id: courseId }, include: { modules: { include: { lessons: true } } } });
      if (!existing || existing.createdById !== user.id || !isRobotCourse(existing) || existing.modules.length !== 1) throw new Error("Game course not found or not owned by you.");
      if (!p.updatedAt || existing.updatedAt.toISOString() !== p.updatedAt) throw new Error("Course changed. Reload before saving.");
      const courseModule = existing.modules[0], submitted = new Map(p.levels.map((l) => [l.lessonId, l]));
      // No silent deletion or identity replacement of levels that may have history.
      for (const old of courseModule.lessons) {
        const next = submitted.get(old.id), blocks = old.blocks as { id: string }[];
        if (!next || !Array.isArray(blocks) || blocks.length !== 1 || blocks[0].id !== next.blockId) throw new Error("Keep existing level and block IDs.");
      }
      const updated = await tx.course.updateMany({ where: { id: courseId, createdById: user.id, updatedAt: new Date(p.updatedAt) }, data: { title: p.title, description: p.description, language: p.language, status: p.status } });
      if (updated.count !== 1) throw new Error("Course changed. Reload before saving.");
      const oldIds = new Set(courseModule.lessons.map((l) => l.id));
      for (const [i, l] of p.levels.entries()) {
        const data = { title: l.title, order: i, blocks: JSON.parse(JSON.stringify([{ id: l.blockId, type: "game", title: l.title, payload: l.payload }])) as Prisma.InputJsonValue };
        if (oldIds.has(l.lessonId)) await tx.lesson.update({ where: { id: l.lessonId }, data });
        else await tx.lesson.create({ data: { id: l.lessonId, moduleId: courseModule.id, estimatedMinutes: 10, ...data } });
      }
      const stamp = await tx.course.findUniqueOrThrow({ where: { id: courseId }, select: { updatedAt: true } });
      return { courseId, updatedAt: stamp.updatedAt.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { ok: true as const, ...saved };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "Could not save course." }; }
}

export async function loadRobotCourseDraft(courseId: string): Promise<{ courseId: string; draft: RobotCourseDraft } | null> {
  const user = (await auth())?.user;
  if (!user || (user.role !== "INSTRUCTOR" && user.role !== "ADMIN")) return null;
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } } } });
  if (!course || course.createdById !== user.id || !isRobotCourse(course)) return null;
  const levels = course.modules.flatMap((m) => m.lessons.map((l) => {
    const blocks = l.blocks as { id: string; payload: unknown }[];
    if (!Array.isArray(blocks) || blocks.length !== 1) throw new Error("Invalid game course level.");
    const payload = courseProgrammingPayloadSchema.parse(blocks[0].payload);
    if (!isParallelProgramming(payload)) throw new Error("Unsupported game course rules.");
    return { lessonId: l.id, blockId: blocks[0].id, title: l.title, payload };
  }));
  return { courseId, draft: robotCourseDraftSchema.parse({ draftId: course.id, title: course.title, description: course.description, language: course.language, status: course.status, updatedAt: course.updatedAt.toISOString(), levels }) };
}
