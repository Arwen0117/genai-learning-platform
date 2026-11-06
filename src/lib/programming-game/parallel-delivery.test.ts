import { describe, expect, it } from "vitest";
import { createDeliveryPayload } from "./delivery-level";
import { createParallelExecution, executeParallelProgram, parseParallelLevel, parseParallelProgram, resetParallelExecution, stepParallelExecution, type ParallelCommand, type ParallelProgram } from "./parallel-engine";
import { createParallelProgrammingPayload, parallelProgrammingEditingSchema, parallelProgrammingPayloadSchema, parallelProgrammingVersion } from "./parallel-config";
import { gradeParallelProgramming } from "./parallel-grade";
import { readParallelHistory } from "./parallel-history";
import { createRobotCourseDraft, robotCourseDraftSchema } from "./robot-course";
import { insertParallelCommand, moveParallelCommand } from "./parallel-editor";
const p = () => createDeliveryPayload("en");
const level = () => p().customLevel!;
const ref = () => p().referenceProgram!;
function cond(kind: "item" | "holding", then: ParallelProgram, otherwise: ParallelProgram = []): ParallelCommand { return { op: "if", condition: { kind, not: false }, then, else: otherwise }; }
describe("opt-in parallel parcel delivery", () => {
  it.each([1, 2, 3, 4])("delivers with a shared program for %i robots", (n) => {
    const payload = parallelProgrammingPayloadSchema.parse(createDeliveryPayload("zh", n));
    const result = executeParallelProgram(payload.customLevel, payload.referenceProgram);
    expect(result).toMatchObject({ status: "passed", worldTicks: 6, instructionAttempts: n * 6, successfulMoves: n * 4, undeliveredItemIds: [] });
    expect(result.items).toHaveLength(n); expect(result.robots.every((r) => r.holding === null)).toBe(true);
  });
  it("pickup/drop operate on immutable snapshots and consume one world tick each", () => {
    const start = createParallelExecution(level(), ref()), original = JSON.stringify(start);
    const held = stepParallelExecution(start);
    expect(JSON.stringify(start)).toBe(original); expect(held.worldTicks).toBe(1);
    expect(held.items?.every((i) => i.position === null)).toBe(true);
    expect(held.robots.map((r) => r.holding)).toEqual(["parcel1", "parcel2"]);
    const reset = resetParallelExecution(held); expect(reset).toEqual(start);
  });
  it("conserves each item with exactly one floor position or holder at every tick", () => {
    let state = createParallelExecution(level(), ref());
    while (true) {
      for (const item of state.items!) {
        const holders = state.robots.filter((r) => r.holding === item.id);
        expect(Number(!!item.position) + holders.length).toBe(1);
      }
      if (state.status !== "ready" && state.status !== "paused") break;
      state = stepParallelExecution(state);
    }
    expect(state.status).toBe("passed");
  });
  it("arriving with a parcel is incomplete rather than delivered", () => {
    const result = executeParallelProgram(level(), ref().slice(0, 2));
    expect(result).toMatchObject({ status: "incomplete", unmetRobotIds: [], undeliveredItemIds: ["parcel1", "parcel2"] });
  });
  it("putting parcels outside delivery zones is incomplete", () => {
    const result = executeParallelProgram(level(), [{ op: "pickup" }, { op: "drop" }, { op: "repeat", count: 4, body: [{ op: "right" }] }]);
    expect(result.status).toBe("incomplete"); expect(result.unmetRobotIds).toEqual([]); expect(result.undeliveredItemIds).toHaveLength(2);
  });
  it("checks all parcels, including an extra untouched parcel", () => {
    const l = level(); l.delivery!.items.push({ id: "extra", start: { x: 2, y: 1 } }); l.delivery!.targets.push({ x: 3, y: 1 });
    const result = executeParallelProgram(l, ref()); expect(result.status).toBe("incomplete"); expect(result.undeliveredItemIds).toEqual(["extra"]);
  });
  it.each([
    { program: [{ op: "right" }, { op: "pickup" }], code: "EMPTY_CELL" },
    { program: [{ op: "pickup" }, { op: "pickup" }], code: "HANDS_FULL" },
    { program: [{ op: "drop" }], code: "EMPTY_HANDS" },
  ])("reports $code with robot, tick and path", ({ program, code }) => {
    const result = executeParallelProgram(level(), program);
    expect(result.status).toBe("error"); expect(result.errors[0]).toMatchObject({ robotId: "a", code, tick: program.length, at: { path: [program.length - 1] } });
  });
  it("rejects dropping onto another parcel without losing the carried item", () => {
    const l = createDeliveryPayload("en", 1).customLevel!; l.delivery!.items.push({ id: "other", start: { x: 1, y: 0 } }); l.delivery!.targets.push({ x: 3, y: 0 });
    const result = executeParallelProgram(l, [{ op: "pickup" }, { op: "right" }, { op: "drop" }]);
    expect(result.errors[0].code).toBe("ITEM_OCCUPIED"); expect(result.robots[0].holding).toBe("parcel1"); expect(result.items?.find((i) => i.id === "other")?.position).toEqual({ x: 1, y: 0 });
  });
  it("commits a valid pickup on the same tick another robot reports empty-cell failure", () => {
    const l = level(); l.delivery!.items = l.delivery!.items.slice(0, 1);
    const result = executeParallelProgram(l, [{ op: "pickup" }]);
    expect(result.status).toBe("error"); expect(result.robots[0].holding).toBe("parcel1"); expect(result.errors).toHaveLength(1); expect(result.errors[0].robotId).toBe("b");
  });
  it("conditionals observe parcel and carrying states in nested loops", () => {
    const program: ParallelProgram = [cond("item", [{ op: "pickup" }]), { op: "repeat", count: 4, body: [cond("holding", [{ op: "right" }])] }, cond("holding", [{ op: "drop" }])];
    expect(executeParallelProgram(level(), program)).toMatchObject({ status: "passed", worldTicks: 12 });
  });
  it("does not read another robot's newly updated pickup state in the same tick", () => {
    const l = level(), program: ParallelProgram = [cond("item", [{ op: "pickup" }], [{ op: "wait" }]), cond("holding", [{ op: "right" }])];
    const start = createParallelExecution(l, program), first = stepParallelExecution(start);
    expect(first.robots.every((r) => r.decision?.result)).toBe(true); expect(first.items).toEqual(start.items);
  });
  it("is invariant to robot/item input ordering and single-step agrees with full execution", () => {
    const l = level(); l.robots.reverse(); l.delivery!.items.reverse();
    const full = executeParallelProgram(level(), ref()); let state = createParallelExecution(l, ref());
    while (state.status === "ready" || state.status === "paused") state = stepParallelExecution(state);
    expect(state).toEqual(full);
  });
  it("retains carried items when a movement budget expires", () => {
    const result = executeParallelProgram(level(), ref(), { ticks: 1 });
    expect(result.failure?.code).toBe("TICK_LIMIT"); expect(result.items?.every((i) => i.position === null)).toBe(true);
  });
  it.each([
    { version: 2 }, { items: [] }, { targets: [] },
    { items: [{ id: "bad space", start: { x: 0, y: 0 } }] },
    { items: [{ id: "x", start: { x: 99, y: 0 } }] },
    { items: [{ id: "x", start: { x: 0, y: 0 } }, { id: "x", start: { x: 0, y: 2 } }] },
    { items: [{ id: "x", start: { x: 0, y: 0 } }, { id: "y", start: { x: 0, y: 0 } }] },
    { items: Array.from({ length: 13 }, (_, i) => ({ id: `p${i}`, start: { x: 0, y: 0 } })) },
  ])("rejects malformed or unknown delivery settings %j", (change) => {
    const l = level(); expect(() => parseParallelLevel({ ...l, delivery: { ...l.delivery, ...change } })).toThrow();
  });
  it("rejects parcel and delivery targets on walls", () => {
    const l = level(); expect(() => parseParallelLevel({ ...l, walls: [{ x: 0, y: 0 }] })).toThrow();
    expect(() => parseParallelLevel({ ...l, goals: [{ x: 3, y: 0 }, { x: 3, y: 2 }], walls: [{ x: 4, y: 0 }] })).toThrow("BLOCKED_ITEM_STATE");
  });
  it("keeps delivery actions and predicates unavailable to ordinary movement levels", () => {
    const l = level(); delete l.delivery; l.allowed = ["right", "if"];
    expect(() => parseParallelProgram([{ op: "pickup" }], l)).toThrow("DELIVERY_NOT_ENABLED");
    expect(() => parseParallelProgram([cond("item", [{ op: "right" }])], l)).toThrow("DELIVERY_NOT_ENABLED");
  });
  it("respects the teacher's allowed command list", () => {
    const l = level(); l.allowed = l.allowed.filter((op) => op !== "pickup");
    expect(() => parseParallelProgram(ref(), l)).toThrow("DISALLOWED_ACTION");
  });
  it("round-trips map/reference in a course and binds delivery targets to the content hash", async () => {
    const payload = parallelProgrammingPayloadSchema.parse(p()), draft = createRobotCourseDraft("en"); draft.levels[0].payload = payload;
    expect(robotCourseDraftSchema.parse(JSON.parse(JSON.stringify(draft))).levels[0].payload).toEqual(payload);
    const changed = structuredClone(payload); changed.customLevel!.delivery!.targets.push({ x: 3, y: 1 });
    expect(await parallelProgrammingVersion(changed)).not.toBe(await parallelProgrammingVersion(payload));
    const bad = { ...payload, referenceProgram: ref().slice(0, 2) };
    expect(parallelProgrammingEditingSchema.safeParse(bad).success).toBe(true); expect(parallelProgrammingPayloadSchema.safeParse(bad).success).toBe(false);
  });
  it("authoritatively grades parcels rather than client-supplied success/cargo", () => {
    expect(gradeParallelProgramming(p(), { program: ref(), passed: false }).score?.raw).toBe(100);
    expect(gradeParallelProgramming(p(), { program: ref().slice(0, 2), passed: true, items: [], robots: [] }).score?.raw).toBe(0);
  });
  it("reads recorded carried items and delivery errors without recomputing the run", async () => {
    const payload = p(), program: ParallelProgram = [{ op: "pickup" }, { op: "pickup" }];
    const grade = gradeParallelProgramming(payload, { program });
    const result = { version: 1, answer: { program }, feedback: { ...grade.feedback as object, levelVersion: await parallelProgrammingVersion(payload) } };
    const history = readParallelHistory(result); expect(history?.feedback.errors[0].code).toBe("HANDS_FULL"); expect(history?.feedback.robots[0].holding).toBe("parcel1");
    const corrupted = structuredClone(result) as typeof result & { feedback: { items: { position: object | null }[] } }; corrupted.feedback.items[0].position = { x: 0, y: 0 };
    expect(readParallelHistory(corrupted)).toBeNull();
  });
  it("supports cargo blocks in branch insertion and whole-block moves", () => {
    const l = level(); let program = insertParallelCommand([], l.allowed, "if", 0)!;
    program = insertParallelCommand(program, l.allowed, "pickup", 0, [0, 0])!;
    program = insertParallelCommand(program, l.allowed, "drop", 1)!;
    const moved = moveParallelCommand(program, l.allowed, [1], 1, [0, 0]); expect(moved?.[0]).toMatchObject({ then: [{ op: "pickup" }, { op: "drop" }] });
  });
  it("preserves the published old movement hash", async () => {
    expect(await parallelProgrammingVersion(createParallelProgrammingPayload("parallel-lanes", "en"))).toBe("8d17656497bec3dab47abbe31dfc23deb1f9e5f6791926b6299ddc4d854649c7");
  });
});
