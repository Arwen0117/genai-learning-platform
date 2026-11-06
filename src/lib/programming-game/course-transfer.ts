import { z } from "zod";
import { robotCourseEditingSchema, type RobotCourseDraft } from "./robot-course";
import { parallelProgrammingLevel, parallelProgrammingReference } from "./parallel-config";

export const ROBOT_COURSE_FILE_LIMIT = 2 * 1024 * 1024;
const transferSchema = z.object({
  format: z.literal("genai-robot-course"), version: z.literal(1),
  course: z.object({
    title: z.string().trim().min(2).max(90), description: z.string().trim().min(1).max(600),
    language: z.enum(["en", "zh"]),
    levels: z.array(robotCourseEditingSchema.shape.levels.element.omit({ lessonId: true, blockId: true })).min(1).max(20),
  }).strict(),
}).strict();

/** Content only: never transfer ownership, database identities, publication or learner records. */
export function exportRobotCourse(input: RobotCourseDraft): string {
  const draft = robotCourseEditingSchema.parse(input);
  const file = transferSchema.parse({ format: "genai-robot-course", version: 1, course: {
    title: draft.title, description: draft.description, language: draft.language,
    // Freeze preset geometry/answers so another installation does not substitute its own preset.
    levels: draft.levels.map((level) => ({ title: level.title, payload: { ...level.payload,
      customLevel: parallelProgrammingLevel(level.payload), referenceProgram: parallelProgrammingReference(level.payload),
    } })),
  } });
  const json = JSON.stringify(file, null, 2);
  if (new TextEncoder().encode(json).length > ROBOT_COURSE_FILE_LIMIT) throw new Error("Course file exceeds 2 MiB.");
  return json;
}

/** Structural parsing only. Import never simulates a program or writes to the database. */
export function importRobotCourse(json: string, makeId: () => string = () => crypto.randomUUID()): RobotCourseDraft {
  if (new TextEncoder().encode(json).length > ROBOT_COURSE_FILE_LIMIT) throw new Error("Course file exceeds 2 MiB.");
  const file = transferSchema.parse(JSON.parse(json));
  return robotCourseEditingSchema.parse({ ...file.course, draftId: makeId(), status: "DRAFT",
    levels: file.course.levels.map((level) => ({ ...level, lessonId: makeId(), blockId: makeId() })),
  });
}
