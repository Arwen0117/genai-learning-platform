import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { courseProgrammingPayloadSchema, isParallelProgramming } from "./course-config";
import { isRobotCourse } from "./robot-course";
/** Dedicated player repeats authorization; a URL/preview flag cannot grant access. */
export async function loadRobotGame(courseId: string, preview: boolean) {
  const user = (await auth())?.user;
  if (!user) return null;
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } } } });
  if (!course || !isRobotCourse(course)) return null;
  if (preview) {
    if ((user.role !== "INSTRUCTOR" && user.role !== "ADMIN") || (course.status !== "PUBLISHED" && course.createdById !== user.id && user.role !== "ADMIN")) return null;
  } else {
    if (user.role !== "LEARNER" || course.status !== "PUBLISHED") return null;
    const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
    if (!enrollment) return null;
  }
  const lessons = course.modules.flatMap((m) => m.lessons);
  const progress = preview ? [] : await prisma.lessonProgress.findMany({ where: { userId: user.id, lessonId: { in: lessons.map((l) => l.id) } }, select: { lessonId: true, completedBlocks: true } });
  const levels = lessons.map((l) => {
    const blocks = l.blocks as { id: string; payload: unknown }[];
    if (!Array.isArray(blocks) || blocks.length !== 1) throw new Error("Invalid game course level.");
    const payload = courseProgrammingPayloadSchema.parse(blocks[0].payload);
    if (!isParallelProgramming(payload)) throw new Error("Unsupported game course rules.");
    const completed = progress.some((p) => p.lessonId === l.id && Array.isArray(p.completedBlocks) && p.completedBlocks.includes(blocks[0].id));
    return { lessonId: l.id, blockId: blocks[0].id, title: l.title, payload, completed };
  });
  if (!levels.length) return null;
  return { title: course.title, levels };
}
