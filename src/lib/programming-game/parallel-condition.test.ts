import { describe, expect, it } from "vitest";
import { createDeliveryPayload } from "./delivery-level";
import { changeParallelConditionKind, changeParallelObservation, parallelObservation, parallelObservationLabel } from "./parallel-condition";
import { createParallelExecution, executeParallelProgram, observeParallelCondition, parseParallelProgram, stepParallelExecution, type ParallelCondition, type ParallelDirection, type ParallelProgram } from "./parallel-engine";
import { gradeParallelProgramming } from "./parallel-grade";
import { parallelProgrammingPayloadSchema, parallelProgrammingVersion } from "./parallel-config";
import { readParallelHistory } from "./parallel-history";
const dirs = ["up", "down", "left", "right"] as const;
const offsets = { up: { x: 1, y: 0 }, down: { x: 1, y: 2 }, left: { x: 0, y: 1 }, right: { x: 2, y: 1 } };
function fixture() {
 const p = createDeliveryPayload("en", 1), l = p.customLevel!; l.width = 3; l.height = 3; l.robots[0].start = { x: 1, y: 1 }; l.goals = [{ x: 1, y: 1 }]; l.delivery!.items[0].start = { x: 1, y: 1 }; l.delivery!.targets = [{ x: 1, y: 1 }]; return l;
}
describe("IF observation scope", () => {
 it.each(dirs)("preserves %s when switching wall, goal and item", (direction) => {
  const source: ParallelCondition = { kind: "wall", direction, not: true };
  const goal = changeParallelConditionKind(source, "goal"), item = changeParallelConditionKind(goal, "item");
  expect(parallelObservation(goal)).toBe(direction); expect(parallelObservation(item)).toBe(direction);
  expect(changeParallelConditionKind(item, "wall")).toEqual(source);
 });
 it.each(["goal", "item"] as const)("offers explicit current-cell mode for %s", (kind) => {
  const current = changeParallelObservation({ kind, direction: "left", not: false }, "current");
  expect(current).toEqual({ kind, not: false }); expect(parallelObservation(current)).toBe("current");
  expect(changeParallelConditionKind(current, kind === "goal" ? "item" : "goal")).not.toHaveProperty("direction");
 });
 it("holding has an explicit self scope without a false directional arrow", () => {
  const holding = changeParallelConditionKind({ kind: "goal", direction: "left", not: false }, "holding");
  expect(holding).toEqual({ kind: "holding", not: false }); expect(parallelObservation(holding)).toBe("self");
  expect(changeParallelObservation(holding, "right")).toBe(holding);
  expect(changeParallelConditionKind(holding, "wall")).toEqual({ kind: "wall", direction: "right", not: false });
 });
 it("never creates current-cell wall/boundary/robot tests", () => {
  const wall: ParallelCondition = { kind: "wall", direction: "up", not: true };
  expect(changeParallelObservation(wall, "current")).toBe(wall);
 });
 for (const kind of ["goal", "item"] as const) it.each(dirs)(`${kind} actually observes the adjacent %s cell`, (direction) => {
  const l = fixture(), position = offsets[direction];
  if (kind === "goal") l.goals = [position]; else l.delivery!.items[0].start = position;
  const state = createParallelExecution(l, [{ op: "wait" }]);
  expect(observeParallelCondition(l, state.robots, state.robots[0], { kind, direction, not: false }, state.items)).toBe(true);
  expect(observeParallelCondition(l, state.robots, state.robots[0], { kind, not: false }, state.items)).toBe(false);
  expect(observeParallelCondition(l, state.robots, state.robots[0], { kind, direction, not: true }, state.items)).toBe(false);
 });
 it.each(["goal", "item"] as const)("keeps old directionless %s behavior on the current cell", (kind) => {
  const l = fixture(), state = createParallelExecution(l, [{ op: "wait" }]);
  expect(observeParallelCondition(l, state.robots, state.robots[0], { kind, not: false }, state.items)).toBe(true);
  expect(parseParallelProgram([{ op: "if", condition: { kind, not: false }, then: [{ op: "wait" }], else: [] }], l)[0]).toMatchObject({ condition: { kind, not: false } });
 });
 it.each(["goal", "item"] as const)("off-map %s is false and NOT reverses it", (kind) => {
  const l = fixture(); l.robots[0].start = { x: 0, y: 0 }; const state = createParallelExecution(l, [{ op: "wait" }]);
  expect(observeParallelCondition(l, state.robots, state.robots[0], { kind, direction: "left", not: false }, state.items)).toBe(false);
  expect(observeParallelCondition(l, state.robots, state.robots[0], { kind, direction: "left", not: true }, state.items)).toBe(true);
 });
 it.each([null, "current", "diagonal", 1])("rejects invalid serialized directions %j rather than dropping them", (direction) => {
  for (const kind of ["goal", "item", "holding"]) expect(() => parseParallelProgram([{ op: "if", condition: { kind, not: false, direction }, then: [{ op: "wait" }], else: [] }], fixture())).toThrow("INVALID_CONDITION");
 });
 it("serializes a chosen item direction without losing it", () => {
  const p: ParallelProgram = [{ op: "if", condition: { kind: "item", direction: "down", not: false }, then: [{ op: "wait" }], else: [] }];
  expect(parseParallelProgram(JSON.parse(JSON.stringify(p)), fixture())).toEqual(p);
 });
 it("reads directional item tests from the tick-start snapshot", () => {
  const l = fixture(); l.robots[0].start = { x: 0, y: 1 };
  const program: ParallelProgram = [{ op: "if", condition: { kind: "item", direction: "right", not: false }, then: [{ op: "right" }, { op: "pickup" }], else: [{ op: "end" }] }];
  const initial = createParallelExecution(l, program), first = stepParallelExecution(initial);
  expect(first.robots[0].decision?.result).toBe(true); expect(first.items).toEqual(initial.items); expect(first.robots[0].position).toEqual({ x: 0, y: 1 });
  const final = executeParallelProgram(l, program); expect(final.robots[0].holding).toBe("parcel1");
 });
 it("uses consistent direction/current/self labels for answer and history rendering", () => {
  const labels = { up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT", current: "HERE", self: "SELF" };
  expect(parallelObservationLabel({ kind: "goal", direction: "left", not: false }, labels)).toBe("LEFT");
  expect(parallelObservationLabel({ kind: "item", not: false }, labels)).toBe("HERE");
  expect(parallelObservationLabel({ kind: "holding", not: false }, labels)).toBe("SELF");
 });
 it("round-trips a directional goal reference through validation, grading, hash and history", async () => {
  const payload = createDeliveryPayload("en", 1);
  const program: ParallelProgram = [{ op: "pickup" }, { op: "repeat", count: 4, body: [{ op: "if", condition: { kind: "goal", direction: "right", not: false }, then: [{ op: "right" }, { op: "drop" }], else: [{ op: "right" }] }] }];
  payload.referenceProgram = program; const saved = parallelProgrammingPayloadSchema.parse(JSON.parse(JSON.stringify(payload)));
  expect(saved.referenceProgram).toEqual(program); const grade = gradeParallelProgramming(saved, { program }); expect(grade.completed).toBe(true);
  const result = { version: 1, answer: { program }, feedback: { ...grade.feedback as object, levelVersion: await parallelProgrammingVersion(saved) } };
  expect(readParallelHistory(result)?.program).toEqual(program);
  const changed = structuredClone(payload); const node = changed.referenceProgram![1]; if (node.op === "repeat" && node.body[0].op === "if") node.body[0].condition = { kind: "goal", not: false };
  expect(await parallelProgrammingVersion(changed)).not.toBe(await parallelProgrammingVersion(payload));
 });
 it("does not allow item detection without delivery mode", () => {
  const l = fixture(); delete l.delivery; l.allowed = ["if", "wait"];
  expect(() => parseParallelProgram([{ op: "if", condition: { kind: "item", direction: "right" as ParallelDirection, not: false }, then: [{ op: "wait" }], else: [] }], l)).toThrow("DELIVERY_NOT_ENABLED");
 });
});
