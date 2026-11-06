import { describe, expect, it } from "vitest";
import { blockSchema, type Block } from "@/lib/blocks/schema";
import { gameActivityContainerSchema, normalizeLessonGameActivity } from "@/lib/game-activity";
import { mockGameActivity } from "@/lib/llm/prompts/game-activity";
import { createGameActivity } from "@/components/teach/editor/block-templates";
import { gradeActivity } from "@/lib/blocks/activity-result";
import { blockDigest } from "@/lib/blocks/digest";
import { createProgrammingPayload } from "./config";
import { createNumericDeliveryPayload } from "./numeric-delivery";
import { createParallelProgrammingPayload } from "./parallel-config";
const robot = (payload: unknown) => blockSchema.parse({ id: "robot", type: "game", title: "Robot workshop", payload });
const activity = () => gameActivityContainerSchema.parse(mockGameActivity("en"));
describe("robot courses alongside upstream Game Activities", () => {
 it.each([createProgrammingPayload("first-route", "en"), createParallelProgrammingPayload("parallel-lanes", "en"), createNumericDeliveryPayload("en")])("accepts legacy and current robot blocks without Challenge metadata", (payload) => {
  expect(robot(payload).payload).toEqual(payload);
  const a = activity(); a.challenges[0] = robot(payload) as never; expect(gameActivityContainerSchema.safeParse(a).success).toBe(false);
 });
 it("keeps robot blocks when an existing Game Activity container owns its Challenges", () => {
  const a = activity(), r = robot(createNumericDeliveryPayload("en"));
  const n = normalizeLessonGameActivity({ lessonId: "l", lessonTitle: "Lesson", blocks: [r, ...a.challenges], gameActivity: a });
  expect(n.blocks).toEqual([r]); expect(n.gameActivity).toEqual(a);
 });
 it("migrates five legacy Challenges without swallowing an adjacent robot block", () => {
  const a = activity(), r = robot(createParallelProgrammingPayload("parallel-lanes", "en"));
  const n = normalizeLessonGameActivity({ lessonId: "l", lessonTitle: "Lesson", blocks: [r, ...a.challenges] });
  expect(n.blocks).toEqual([r]); expect(n.gameActivity?.challenges).toEqual(a.challenges);
 });
 it("does not mistake five robot levels for a five-Challenge Game Activity", () => {
  const blocks = Array.from({ length: 5 }, (_, i) => ({ ...robot(createParallelProgrammingPayload("parallel-lanes", "en")), id: `robot${i}` }));
  const n = normalizeLessonGameActivity({ lessonId: "l", lessonTitle: "Robots", blocks }); expect(n.blocks).toEqual(blocks); expect(n.gameActivity).toBeUndefined();
 });
 it("rejects robot seeds in Game Activity creation instead of converting or discarding them", () => {
  expect(() => createGameActivity("en", { seedChallenges: [robot(createNumericDeliveryPayload("en")) as Extract<Block, { type: "game" }>] })).toThrow();
 });
 it("preserves upstream Choose grading and a numeric robot's authoritative 100/0 grade", () => {
  const a = activity(), choose = a.challenges.find((c) => c.payload.variant === "choose")!;
  if (choose.payload.variant !== "choose") throw new Error("Missing Choose fixture");
  expect(gradeActivity(choose, { option: choose.payload.options.findIndex((v) => v.correct) }).passed).toBe(true);
  const p = createNumericDeliveryPayload("en"), r = robot(p); expect(gradeActivity(r, { program: p.referenceProgram }).score?.raw).toBe(100);
  expect(gradeActivity(r, { program: [{ op: "wait" }] }).score?.raw).toBe(0);
 });
 it("digests both Choose and robot content without exposing the robot reference AST", () => {
  const r = robot(createNumericDeliveryPayload("en")), choose = activity().challenges.find((c) => c.payload.variant === "choose")!;
  expect(blockDigest(r)).toContain("Use one shared program"); expect(blockDigest(r)).not.toContain('"operator"'); expect(blockDigest(choose)).toContain(choose.title);
 });
});
