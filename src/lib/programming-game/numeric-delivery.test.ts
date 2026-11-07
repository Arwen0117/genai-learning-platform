import { describe, expect, it } from "vitest";
import { createNumericDeliveryPayload } from "./numeric-delivery";
import { createDeliveryPayload } from "./delivery-level";
import { PARALLEL_COMPARISONS, createParallelExecution, executeParallelProgram, observeParallelCondition, parseParallelLevel, parseParallelProgram, resetParallelExecution, stepParallelExecution, type ParallelCondition, type ParallelProgram } from "./parallel-engine";
import { parallelProgrammingPayloadSchema, parallelProgrammingEditingSchema, parallelProgrammingVersion } from "./parallel-config";
import { gradeParallelProgramming } from "./parallel-grade";
import { readParallelHistory } from "./parallel-history";
import { changeParallelConditionKind, changeParallelObservation, parallelObservation, parallelConditionLabel } from "./parallel-condition";
import { createRobotCourseDraft, robotCourseDraftSchema } from "./robot-course";
import { programmingHintsPrompt } from "../llm/prompts/programming-hints";
const payload = () => createNumericDeliveryPayload("en");
const level = () => payload().customLevel!;
const ref = () => payload().referenceProgram!;
const condition = (extra: Partial<Extract<ParallelCondition, { kind: "value" }>> = {}): ParallelCondition => ({ kind: "value", source: "item", operator: "eq", value: 3, not: false, ...extra });
function testProgram(c: ParallelCondition): ParallelProgram { return [{ op: "if", condition: c, then: [{ op: "wait" }], else: [] }]; }
describe("numeric parcels: authoritative comparisons and exact delivery", () => {
 it.each(["en", "zh"] as const)("provides a passing %s sorting course and distinct per-robot branches", (locale) => {
  const p = parallelProgrammingPayloadSchema.parse(createNumericDeliveryPayload(locale)), r = executeParallelProgram(p.customLevel, p.referenceProgram);
  expect(r).toMatchObject({ status: "passed", worldTicks: 5, instructionAttempts: 10, undeliveredItemIds: [] });
  expect(r.robots.map((v) => v.position)).toEqual([{ x: 0, y: 0 }, { x: 4, y: 2 }]);
  expect(r.robots.map((v) => v.decision?.result)).toEqual([true, false]);
 });
 it.each([
  ["eq", 3, true], ["eq", 4, false], ["ne", 3, false], ["ne", 4, true],
  ["lt", 3, false], ["lt", 4, true], ["lte", 3, true], ["lte", 2, false],
  ["gt", 3, false], ["gt", 2, true], ["gte", 3, true], ["gte", 4, false],
 ] as const)("evaluates actual ground value 3 %s %i as %s", (operator, value, expected) => {
  const state = createParallelExecution(level(), testProgram(condition({ operator, value })));
  expect(stepParallelExecution(state).robots[0].decision?.result).toBe(expected);
 });
 it.each(PARALLEL_COMPARISONS)("missing ground and carried values never satisfy %s", (operator) => {
  const l = level(), s = createParallelExecution(l, ref()), c = condition({ operator, direction: "right" });
  expect(observeParallelCondition(l, s.robots, s.robots[0], c, s.items)).toBe(false);
  expect(observeParallelCondition(l, s.robots, s.robots[0], condition({ operator, source: "holding" }), s.items)).toBe(false);
  expect(observeParallelCondition(l, s.robots, s.robots[0], { ...c, not: true }, s.items)).toBe(true);
 });
 it.each(["up", "down", "left", "right"] as const)("observes only adjacent %s parcel", (direction) => {
  const l = level(); l.robots[0].start = { x: 2, y: 1 }; const positions = { up: { x: 2, y: 0 }, down: { x: 2, y: 2 }, left: { x: 1, y: 1 }, right: { x: 3, y: 1 } };
  l.delivery!.items[0].start = positions[direction]; l.delivery!.items[1].start = { x: 4, y: 0 };
  const s = createParallelExecution(l, ref()); expect(observeParallelCondition(l, s.robots, s.robots[0], condition({ direction }), s.items)).toBe(true);
  expect(observeParallelCondition(l, s.robots, s.robots[0], condition(), s.items)).toBe(false);
 });
 it.each([-99, 0, 99])("supports boundary/zero integer %i without truthiness bugs", (n) => {
  const l = level(); l.delivery!.items[0].value = n; l.delivery!.targets[0].value = n;
  const s = createParallelExecution(l, testProgram(condition({ value: n })));
  expect(stepParallelExecution(s).robots[0].decision?.result).toBe(true);
 });
 it.each([undefined, null, "3", 1.5, -100, 100, NaN, Infinity])("rejects malformed item and target numbers %s", (value) => {
  const l = level(); (l.delivery!.items[0] as { value: unknown }).value = value; expect(() => parseParallelLevel(l)).toThrow("INVALID_ITEM_VALUE");
  const other = level(); (other.delivery!.targets[0] as { value: unknown }).value = value; expect(() => parseParallelLevel(other)).toThrow("INVALID_ITEM_VALUE");
 });
 it("requires a versioned numeric capability and sufficient matching target capacity", () => {
  const l = level(); l.delivery!.numbers = { version: 2 } as never; expect(() => parseParallelLevel(l)).toThrow("UNSUPPORTED_NUMBERS_VERSION");
  delete l.delivery!.numbers; expect(() => parseParallelLevel(l)).toThrow("NUMBERS_NOT_ENABLED");
  const other = level(); other.delivery!.targets[0].value = 8; expect(() => parseParallelLevel(other)).toThrow("MISSING_VALUE_TARGET");
  const same = level(); same.delivery!.items[1].value = 3; expect(() => parseParallelLevel(same)).toThrow("MISSING_VALUE_TARGET");
 });
 it.each([
  { operator: "<" }, { source: "robot" }, { source: "holding", direction: "right" }, { direction: "current" }, { value: "3" }, { value: 100 },
 ])("rejects malformed numeric condition %j", (override) => {
  expect(() => parseParallelProgram(testProgram({ ...condition(), ...override } as ParallelCondition), level())).toThrow();
 });
 it("gates numeric tests on authoritative level capability and IF permission", () => {
  expect(() => parseParallelProgram(testProgram(condition()), createDeliveryPayload("en").customLevel!)).toThrow("NUMBERS_NOT_ENABLED");
  const l = level(); l.allowed = l.allowed.filter((op) => op !== "if"); expect(() => parseParallelProgram(testProgram(condition()), l)).toThrow("DISALLOWED_IF");
 });
 it("a parcel on the wrong-value zone is incomplete even after all robots reach goals", () => {
  const l = level(); l.delivery!.targets[0].value = 8; l.delivery!.targets[1].value = 3;
  const r = executeParallelProgram(l, ref()); expect(r.status).toBe("incomplete"); expect(r.unmetRobotIds).toEqual([]); expect(r.undeliveredItemIds).toEqual(["parcel1", "parcel2"]);
 });
 it("allows relocating a wrong delivery later instead of failing at drop", () => {
  const l = level(); l.robots = [l.robots[0]]; l.goals = [{ x: 0, y: 0 }]; l.delivery!.items = [l.delivery!.items[0]]; l.delivery!.targets = [{ x: 3, y: 0, value: 8 }, { x: 0, y: 0, value: 3 }];
  const r = executeParallelProgram(l, [{ op: "pickup" }, { op: "right" }, { op: "drop" }, { op: "pickup" }, { op: "repeat", count: 3, body: [{ op: "left" }] }, { op: "drop" }]); expect(r.status).toBe("passed");
 });
 it("pickup carries immutable value, snapshots remain unchanged, and reset reproduces starts", () => {
  const l = level(), s = createParallelExecution(l, ref()), before = JSON.stringify(s), held = stepParallelExecution(s);
  expect(JSON.stringify(s)).toBe(before); expect(resetParallelExecution(held)).toEqual(s);
  expect(observeParallelCondition(held.level, held.robots, held.robots[0], condition({ source: "holding" }), held.items)).toBe(true);
  expect(observeParallelCondition(held.level, held.robots, held.robots[0], condition(), held.items)).toBe(false);
  expect(l.delivery!.items.map((i) => i.value)).toEqual([3, 8]);
 });
 it("numeric tests compose inside nested IF and repeat without adding numeric runtime fields", () => {
  const p: ParallelProgram = [{ op: "pickup" }, { op: "repeat", count: 1, body: [{ op: "if", condition: condition({ source: "holding", operator: "lt", value: 5 }), then: [testProgram(condition({ source: "holding", operator: "gte", value: 3 }))[0]], else: [] }] }];
  const r = executeParallelProgram(level(), p); expect(r.status).toBe("incomplete"); expect(r.robots[0].decision?.result).toBe(true); expect(r.items?.[0]).not.toHaveProperty("value");
 });
 it("step/full execution agree and input array order does not determine decisions", () => {
  const l = level(); l.robots.reverse(); l.delivery!.items.reverse(); const whole = executeParallelProgram(level(), ref()); let s = createParallelExecution(l, ref());
  while (s.status === "ready" || s.status === "paused") s = stepParallelExecution(s); expect(s).toEqual(whole);
 });
 it("switching to numeric preserves direction, negation and current-cell mode", () => {
  const c = changeParallelConditionKind({ kind: "item", direction: "left", not: true }, "value");
  expect(c).toMatchObject({ kind: "value", source: "item", direction: "left", not: true }); expect(parallelObservation(c)).toBe("left");
  expect(changeParallelObservation(c, "current")).not.toHaveProperty("direction");
  expect(changeParallelObservation({ ...condition({ source: "holding" }) }, "up")).toEqual(condition({ source: "holding" }));
 });
 it("formats source/operator/threshold and NOT consistently for answer and history", () => {
  const labels = { up: "U", down: "D", left: "L", right: "R", current: "Here", self: "Self" }, kinds = { delivery: "Delivery zone", wall: "Wall", boundary: "Edge", robot: "Robot", goal: "Goal", item: "Item", holding: "Holding", value: "Value" };
  expect(parallelConditionLabel(condition({ source: "holding", operator: "gte", value: -2 }), labels, kinds, { item: "Ground", holding: "Carried" })).toBe("Self · Carried ≥ -2");
  expect(parallelConditionLabel(condition({ not: true }), labels, kinds, { item: "Ground", holding: "Carried" })).toBe("NOT (Here · Ground = 3)");
 });
 it("grading ignores fabricated student values and records numeric map/program in history", async () => {
  const p = payload(), grade = gradeParallelProgramming(p, { program: ref(), items: [{ id: "parcel1", value: 99 }], score: 100 });
  expect(grade.score?.raw).toBe(100);
  const feedback = { ...grade.feedback, levelVersion: await parallelProgrammingVersion(p) };
  const record = readParallelHistory({ version: 1, answer: { program: ref() }, feedback });
  expect(record?.level.delivery?.items[0].value).toBe(3); expect(record?.program[1]).toMatchObject({ op: "if", condition: { operator: "lt", value: 5 } });
  const wrong = ref(); if (wrong[1].op === "if") wrong[1].condition = condition({ source: "holding", operator: "gt", value: 5 });
  expect(gradeParallelProgramming(p, { program: wrong, passed: true }).score?.raw).toBe(0);
 });
 it("hash changes for values, destination requirements and numeric comparator", async () => {
  const p = payload(), original = await parallelProgrammingVersion(p), changed = payload(); changed.customLevel!.delivery!.items[0].value = 4; changed.customLevel!.delivery!.targets[0].value = 4;
  expect(await parallelProgrammingVersion(changed)).not.toBe(original);
  const comparator = payload(); if (comparator.referenceProgram![1].op === "if") comparator.referenceProgram![1].condition = condition({ source: "holding", operator: "lte", value: 5 });
  expect(await parallelProgrammingVersion(comparator)).not.toBe(original);
 });
 it("full save schema rejects nonpassing numeric answers while editing supports repair", () => {
  const p = payload(); p.customLevel!.delivery!.targets[0].value = 8; p.customLevel!.delivery!.targets[1].value = 3;
  expect(parallelProgrammingEditingSchema.safeParse(p).success).toBe(true); expect(parallelProgrammingPayloadSchema.safeParse(p).success).toBe(false);
 });
 it("standalone course serialization and hint generation retain numeric rules", () => {
  const d = createRobotCourseDraft("zh"); d.levels = [{ ...d.levels[0], payload: createNumericDeliveryPayload("zh") }];
  const saved = robotCourseDraftSchema.parse(JSON.parse(JSON.stringify(d))); expect(saved.levels[0].payload.customLevel!.delivery!.numbers).toEqual({ version: 1 });
  const prompt = JSON.parse(programmingHintsPrompt(saved.levels[0].payload, "zh")); expect(prompt.level.delivery.items[0].value).toBe(3); expect(prompt.reference[1].condition.operator).toBe("lt");
 });
});
