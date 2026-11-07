import { describe, expect, it } from "vitest";
import { createDeliveryPayload } from "./delivery-level";
import { createParallelExecution, observeParallelCondition, parseParallelProgram, type ParallelCondition, type ParallelDirection, type ParallelProgram } from "./parallel-engine";
import { changeParallelConditionKind, changeParallelObservation } from "./parallel-condition";
import { gradeParallelProgramming } from "./parallel-grade";
import { parallelProgrammingPayloadSchema } from "./parallel-config";
import { buildProgrammingTeaching } from "./teaching";
const offsets = { up: { x: 1, y: 0 }, down: { x: 1, y: 2 }, left: { x: 0, y: 1 }, right: { x: 2, y: 1 } };
function fixture() {
 const p = createDeliveryPayload("zh", 1), l = p.customLevel!;
 l.width = 3; l.height = 3; l.robots[0].start = { x: 1, y: 1 }; l.goals = [{ x: 0, y: 0 }]; l.delivery!.items[0].start = { x: 0, y: 0 }; l.delivery!.targets = [{ x: 1, y: 1 }]; return l;
}
function condition(direction?: ParallelDirection, not = false): ParallelCondition { return { kind: "delivery", not, ...(direction ? { direction } : {}) }; }
const program = (c: ParallelCondition): ParallelProgram => [{ op: "if", condition: c, then: [{ op: "wait" }], else: [] }];
describe("delivery zone IF observations", () => {
 it.each(Object.keys(offsets) as ParallelDirection[])("observes adjacent %s independently of goals and parcels", direction => {
  const l = fixture(); l.delivery!.targets = [offsets[direction]];
  const s = createParallelExecution(l, program(condition(direction)));
  expect(observeParallelCondition(l, s.robots, s.robots[0], condition(direction), s.items)).toBe(true);
  expect(observeParallelCondition(l, s.robots, s.robots[0], condition(), s.items)).toBe(false);
  expect(observeParallelCondition(l, s.robots, s.robots[0], condition(direction, true), s.items)).toBe(false);
 });
 it("observes the current cell, with NOT and without parcel or goal requirements", () => {
  const l=fixture(),s=createParallelExecution(l, program(condition()));
  expect(observeParallelCondition(l,s.robots,s.robots[0],condition(),s.items)).toBe(true);
  expect(observeParallelCondition(l,s.robots,s.robots[0],condition(undefined,true),s.items)).toBe(false);
  expect(observeParallelCondition(l,s.robots,s.robots[0],{kind:"goal",not:false},s.items)).toBe(false);
 });
 it("returns false for an observed cell outside the map", () => {
  const l=fixture();l.robots[0].start={x:0,y:0};const s=createParallelExecution(l,program(condition("up")));
  expect(observeParallelCondition(l,s.robots,s.robots[0],condition("up"),s.items)).toBe(false);
  expect(observeParallelCondition(l,s.robots,s.robots[0],condition("up",true),s.items)).toBe(true);
 });
 it("preserves direction and NOT when switching condition types and supports current cell", () => {
  const c=changeParallelConditionKind({kind:"wall",direction:"down",not:true},"delivery");
  expect(c).toEqual(condition("down",true));
  const current=changeParallelObservation(c,"current");expect(current).toEqual(condition(undefined,true));
  expect(changeParallelConditionKind(current,"goal")).toEqual({kind:"goal",not:true});
 });
 it("rejects forged delivery checks on non-delivery levels and invalid directions", () => {
  const l=fixture();delete l.delivery;l.allowed=l.allowed.filter(op=>op!=="pickup"&&op!=="drop");
  expect(()=>parseParallelProgram(program(condition()),l)).toThrow("DELIVERY_NOT_ENABLED");
  expect(()=>parseParallelProgram([{op:"if",condition:{kind:"delivery",direction:"diagonal",not:false},then:[{op:"wait"}],else:[]}],fixture())).toThrow("INVALID_CONDITION");
 });
 it("round-trips a reference program and grades the conditional drop on the server", () => {
  const payload=createDeliveryPayload("zh",1);payload.referenceProgram=[{op:"pickup"},{op:"repeat",count:4,body:[{op:"right"}]},{op:"if",condition:condition(),then:[{op:"drop"}],else:[{op:"wait"}]}];
  const restored=parallelProgrammingPayloadSchema.parse(JSON.parse(JSON.stringify(payload)));
  expect(gradeParallelProgramming(restored,{program:restored.referenceProgram})).toMatchObject({passed:true,completed:true});
  expect(buildProgrammingTeaching(restored.customLevel!,restored.referenceProgram!,"zh").pseudocode).toContain("当前格是物品配送区");
 });
});
