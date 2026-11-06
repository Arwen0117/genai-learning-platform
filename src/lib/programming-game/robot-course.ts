import { z } from "zod";
import { parallelProgrammingPayloadSchema, parallelProgrammingEditingSchema, createParallelProgrammingPayload } from "./parallel-config";
import { PARALLEL_TEMPLATES } from "./parallel-levels";
export const ROBOT_COURSE_TOPIC = "Robot programming";
export function isRobotCourse(course: { slug: string; topic: string }) {
  return course.slug.startsWith("robot-game-") && course.topic === ROBOT_COURSE_TOPIC;
}
const robotCourseFields = z.object({
  draftId: z.string().uuid(),
  title: z.string().trim().min(2).max(90), description: z.string().trim().min(1).max(600),
  language: z.enum(["en", "zh"]), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  updatedAt: z.string().datetime().optional(),
  levels: z.array(z.object({ lessonId: z.string().uuid(), blockId: z.string().uuid(), title: z.string().trim().min(1).max(120), payload: parallelProgrammingPayloadSchema }).strict()).min(1).max(20),
}).strict().superRefine((p, ctx) => {
  if (new Set(p.levels.map((l) => l.lessonId)).size !== p.levels.length || new Set(p.levels.map((l) => l.blockId)).size !== p.levels.length)
    ctx.addIssue({ code: "custom", path: ["levels"], message: "Duplicate level IDs." });
});
export const robotCourseDraftSchema = robotCourseFields;
/** Client edits check fields/structure only; simulation is an explicit action. */
export const robotCourseEditingSchema = robotCourseFields.safeExtend({ levels: z.array(z.object({ lessonId: z.string().uuid(), blockId: z.string().uuid(), title: z.string().trim().min(1).max(120), payload: parallelProgrammingEditingSchema }).strict()).min(1).max(20) });
export type RobotCourseDraft = z.infer<typeof robotCourseDraftSchema>;
export function createRobotCourseDraft(language: "en" | "zh", makeId: () => string = () => crypto.randomUUID()): RobotCourseDraft {
  return { draftId: makeId(), title: language === "zh" ? "机器人编程挑战" : "Robot programming challenge", description: language === "zh" ? "编排共享程序，完成机器人关卡。" : "Build shared programs and solve robot puzzles.", language, status: "DRAFT",
    levels: PARALLEL_TEMPLATES.map((t) => ({ lessonId: makeId(), blockId: makeId(), title: t.title[language], payload: createParallelProgrammingPayload(t.id, language) })) };
}
