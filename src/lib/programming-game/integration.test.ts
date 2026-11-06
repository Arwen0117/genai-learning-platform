import { describe, expect, it } from "vitest";
import { blockSchema, type Block } from "@/lib/blocks/schema";
import { gradeActivity } from "@/lib/blocks/activity-result";
import { blockDigest } from "@/lib/blocks/digest";
import { generatedLessonSchema as teacherLesson } from "@/lib/llm/prompts/lesson";
import { generatedLessonSchema as learnerLesson, mockLearnerCourse, learnerCourseSchema } from "@/lib/llm/prompts/course";
import {
  createProgrammingPayload,
  programmingPayloadSchema,
  programmingVersion,
} from "./config";
import { getTemplate, TEMPLATES } from "./levels";

function block(id = "first-route" as (typeof TEMPLATES)[number]["id"]): Block {
  return {
    id: "game",
    title: "Programming",
    type: "game",
    payload: createProgrammingPayload(id, "en"),
  };
}
describe("programming activity contract", () => {
  it.each(TEMPLATES.map((t) => t.id))(
    "roundtrips %s through the shared schema and server grader",
    (id) => {
      const b = blockSchema.parse(block(id));
      const grade = gradeActivity(b, {
        program: getTemplate(id).reference,
        completed: false,
        score: -999,
      });
      expect(grade).toMatchObject({
        completed: true,
        passed: true,
        verification: "server",
        score: { raw: 100, normalized: 1 },
        feedback: { variant: "programming", status: "passed" },
      });
      expect(grade.feedback.levelSnapshot).toEqual(getTemplate(id).level);
    },
  );
  it("stores failed and incomplete runs as 0 without trusting client flags", () => {
    for (const program of [[{ op: "left" }], [{ op: "right" }]]) {
      const grade = gradeActivity(block(), {
        program,
        completed: true,
        passed: true,
        score: 100,
      });
      expect(grade).toMatchObject({
        completed: false,
        passed: false,
        score: { raw: 0, normalized: 0 },
      });
    }
  });
  it("rejects arbitrary code, malformed loops and empty programs", () => {
    for (const program of [
      "alert(1)",
      [],
      [{ op: "repeat", count: 999, body: [{ op: "right" }] }],
    ])
      expect(() => gradeActivity(block(), { program })).toThrow();
  });
  it("validates reference solvability and duplicate allowed commands at save time", () => {
    const p = createProgrammingPayload("parcel-delivery", "en");
    expect(
      programmingPayloadSchema.safeParse({
        ...p,
        allowed: p.allowed.filter((a) => a !== "pickup"),
      }).success,
    ).toBe(false);
    expect(
      programmingPayloadSchema.safeParse({
        ...p,
        allowed: [...p.allowed, "right"],
      }).success,
    ).toBe(false);
  });
  it("rejects oversized teaching content", () => {
    const p = createProgrammingPayload("first-route", "en");
    expect(programmingPayloadSchema.safeParse({ ...p, task: "" }).success).toBe(
      false,
    );
    expect(
      programmingPayloadSchema.safeParse({
        ...p,
        hints: Array(13).fill("hint"),
      }).success,
    ).toBe(false);
    expect(
      programmingPayloadSchema.safeParse({
        ...p,
        knowledge: [{ title: "x", body: "x".repeat(4001) }],
      }).success,
    ).toBe(false);
  });
  it("hashes deterministically independent of command checkbox order", async () => {
    const p = createProgrammingPayload("first-route", "en");
    const hash = await programmingVersion(p);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await programmingVersion({ ...p, allowed: [...p.allowed].reverse() }),
    ).toBe(hash);
  });
  it("changes the hash for task, hints, knowledge, rules or allowed changes", async () => {
    const p = createProgrammingPayload("first-route", "en");
    const hash = await programmingVersion(p);
    for (const next of [
      { ...p, task: "Changed task" },
      { ...p, hints: ["A hint"] },
      { ...p, knowledge: [] },
      { ...p, allowed: [...p.allowed, "pickup" as const] },
      createProgrammingPayload("repeat-route", "en"),
    ])
      expect(await programmingVersion(next)).not.toBe(hash);
  });
  it("includes visible teaching text in the block digest without reference answers", () => {
    const digest = blockDigest(block(), 1000);
    expect(digest).toContain("Program the robot");
    expect(digest).toContain("Sequential execution");
    expect(digest).not.toContain('"op"');
  });
  it("keeps AI generation limited to existing game variants", () => {
    const lesson = {
      title: "Lesson title",
      estimatedMinutes: 5,
      blocks: [
        {
          id: "reading",
          title: "Read",
          type: "reading",
          payload: { markdown: "Learn." },
        },
        block(),
        {
          id: "quiz",
          title: "Quiz",
          type: "quiz",
          payload: {
            passScore: 1,
            questions: [
              {
                id: "q",
                prompt: "True?",
                kind: "truefalse",
                answer: [0],
                explanation: "Yes.",
              },
            ],
          },
        },
      ],
    };
    expect(teacherLesson.safeParse(lesson).success).toBe(false);
    expect(learnerLesson.safeParse(lesson).success).toBe(false);
    lesson.blocks[1] = {
      id: "g",
      title: "Sort",
      type: "game",
      payload: {
        variant: "sort",
        items: [
          { text: "a", order: 0 },
          { text: "b", order: 1 },
        ],
      },
    };
    expect(teacherLesson.safeParse(lesson).success).toBe(true);
    // Upstream learner generation now requires reading/quiz plus a five-Challenge container.
    expect(learnerLesson.safeParse(lesson).success).toBe(false);
    const generated = learnerCourseSchema.parse(mockLearnerCourse()).lessons[0];
    expect(learnerLesson.safeParse(generated).success).toBe(true);
    expect(learnerLesson.safeParse({ ...generated, blocks: [generated.blocks[0], block()] }).success).toBe(false);
    expect(learnerLesson.safeParse({ ...generated, gameActivity: { ...generated.gameActivity, challenges: [block(), ...generated.gameActivity.challenges.slice(1)] } }).success).toBe(false);
  });
});
