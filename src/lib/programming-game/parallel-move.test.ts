import { describe, expect, it } from "vitest";
import { PARALLEL_COMMANDS, executeParallelProgram, type ParallelProgram } from "./parallel-engine";
import { countParallelNodes, getParallelEditorList, moveParallelCommand } from "./parallel-editor";
import { getParallelTemplate } from "./parallel-levels";
const allowed = [...PARALLEL_COMMANDS];
const conditional = (): ParallelProgram => [{ op: "if", condition: { kind: "wall", direction: "right", not: true }, then: [{ op: "up" }, { op: "jump", target: "A" }], else: [{ op: "wait" }] }];
const move = (p: ParallelProgram, path: number[], i: number, parent: number[] = []) => moveParallelCommand(p, allowed, path, i, parent);
describe("whole block moves", () => {
  it("moves a complete IF into a later repeat, rebasing the destination", () => {
    const p: ParallelProgram = [...conditional(), { op: "repeat", count: 4, body: [{ op: "right" }] }, { op: "label", id: "A" }];
    const before = JSON.stringify(p), next = move(p, [0], 0, [1])!;
    expect(next).toEqual([{ op: "repeat", count: 4, body: [...conditional(), { op: "right" }] }, { op: "label", id: "A" }]);
    expect(JSON.stringify(p)).toBe(before); expect(countParallelNodes(next)).toBe(countParallelNodes(p));
  });
  it("moves IF back out of a repeat without copying its contents", () => {
    const p: ParallelProgram = [{ op: "repeat", count: 3, body: [...conditional(), { op: "right" }] }];
    const next = move(p, [0, 0], 0)!;
    expect(next).toEqual([...conditional(), { op: "repeat", count: 3, body: [{ op: "right" }] }]);
  });
  it("moves an action from THEN to ELSE", () => {
    const p = conditional(), next = move(p, [0, 0, 0], 1, [0, 1])!;
    expect(getParallelEditorList(next, [0, 0])).toEqual([{ op: "jump", target: "A" }]);
    expect(getParallelEditorList(next, [0, 1])).toEqual([{ op: "wait" }, { op: "up" }]);
  });
  it("rebases a later IF nested in a loop after removing its preceding action", () => {
    const p: ParallelProgram = [{ op: "repeat", count: 2, body: [{ op: "right" }, ...conditional()] }];
    const next = move(p, [0, 0], 0, [0, 1, 0])!;
    expect(getParallelEditorList(next, [0, 0, 0])?.map((c) => c.op)).toEqual(["right", "up", "jump"]);
  });
  it("moves between separate loop bodies and preserves empty editable drafts", () => {
    const p: ParallelProgram = [{ op: "repeat", count: 0, body: [{ op: "wait" }] }, { op: "repeat", count: 2, body: [] }];
    expect(move(p, [0, 0], 0, [1])).toEqual([{ op: "repeat", count: 0, body: [] }, { op: "repeat", count: 2, body: [{ op: "wait" }] }]);
  });
  it.each([[0, 3, ["wait", "end", "right"]], [2, 0, ["end", "right", "wait"]]] as const)("reorders same-list index %s", (from, to, expected) => {
    const p: ParallelProgram = [{ op: "right" }, { op: "wait" }, { op: "end" }];
    expect(move(p, [from], to)?.map((c) => c.op)).toEqual(expected);
  });
  it("treats adjacent slots as no-ops without resetting the run", () => {
    const p: ParallelProgram = [{ op: "wait" }, { op: "end" }];
    expect(move(p, [0], 0)).toBe(p); expect(move(p, [0], 1)).toBe(p);
  });
  it("moves at the 80-node cap without creating an extra node", () => {
    const p: ParallelProgram = Array.from({ length: 80 }, () => ({ op: "wait" }));
    expect(move(p, [0], 80)).toHaveLength(80);
  });
  it.each([{ parent: [0] }, { parent: [0, 0, 0] }])("rejects moving a loop into itself or its descendant $parent", ({ parent }) => {
    const p: ParallelProgram = [{ op: "repeat", count: 2, body: conditional() }];
    expect(move(p, [0], 0, parent)).toBeNull();
  });
  it("rejects IF self-nesting and markers or loops inside containers", () => {
    const p: ParallelProgram = [...conditional(), { op: "repeat", count: 2, body: [] }, { op: "label", id: "A" }];
    expect(move(p, [0], 0, [0, 0])).toBeNull(); expect(move(p, [1], 0, [0, 0])).toBeNull(); expect(move(p, [2], 0, [1])).toBeNull();
    expect(move([...conditional(), ...conditional()], [1], 0, [0, 1])).toBeNull();
  });
  it("checks every moved descendant against allowed commands", () => {
    expect(moveParallelCommand([...conditional(), { op: "repeat", count: 2, body: [] }], allowed.filter((op) => op !== "up"), [0], 0, [1])).toBeNull();
  });
  it.each([[], [-1], [0.5], [99], [0, 0]])("rejects invalid or stale source %j", (...path) => {
    expect(move([{ op: "wait" }], path as number[], 0)).toBeNull();
  });
  it.each([-1, 1.5, 9, NaN])("rejects invalid destination slot %s", (i) => {
    expect(move([{ op: "wait" }], [0], i)).toBeNull();
  });
  it("rejects an invalid destination without modifying the source", () => {
    const p = conditional(), before = JSON.stringify(p);
    expect(move(p, [0, 0, 0], 0, [99])).toBeNull(); expect(JSON.stringify(p)).toBe(before);
  });
  it("runs a moved whole IF inside repeat for one and multiple robots", () => {
    for (const count of [1, 2]) {
      const t = getParallelTemplate("parallel-goal-guard"); t.level.robots = t.level.robots.slice(0, count);
      const p: ParallelProgram = [{ op: "if", condition: { kind: "goal", not: true }, then: [{ op: "right" }], else: [{ op: "wait" }] }, { op: "repeat", count: 4, body: [] }];
      const next = move(p, [0], 0, [1])!;
      expect(executeParallelProgram(t.level, next).status).toBe("passed");
    }
  });
});
