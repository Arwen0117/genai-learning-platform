import { describe, expect, it } from "vitest";
import { PARALLEL_COMMANDS, type ParallelProgram } from "./parallel-engine";
import { countParallelNodes, insertParallelCommand, getParallelEditorList, updateParallelEditorList, parallelLabels } from "./parallel-editor";

const allowed = [...PARALLEL_COMMANDS];
describe("parallel palette insertion", () => {
  it("inserts at the requested root slot, not always at the end", () => {
    const program: ParallelProgram = [{ op: "right" }, { op: "end" }];
    const next = insertParallelCommand(program, allowed, "wait", 1);
    expect(next).toEqual([{ op: "right" }, { op: "wait" }, { op: "end" }]);
    expect(program).toEqual([{ op: "right" }, { op: "end" }]);
  });
  it("creates a fresh editable loop when dragged from the palette", () => {
    const a = insertParallelCommand([], allowed, "repeat", 0)!;
    const b = insertParallelCommand([], allowed, "repeat", 0)!;
    expect(a).toEqual([{ op: "repeat", count: 2, body: [] }]);
    expect(a[0]).not.toBe(b[0]);
  });
  it("inserts inside a loop without changing its count or other nodes", () => {
    const p: ParallelProgram = [{ op: "wait" }, { op: "repeat", count: 4, body: [{ op: "right" }, { op: "end" }] }];
    const before = JSON.stringify(p);
    expect(insertParallelCommand(p, allowed, "down", 1, 1)).toEqual([
      { op: "wait" }, { op: "repeat", count: 4, body: [{ op: "right" }, { op: "down" }, { op: "end" }] },
    ]);
    expect(JSON.stringify(p)).toBe(before);
  });
  it("allows inserting into an empty loop draft", () => {
    expect(insertParallelCommand([{ op: "repeat", count: 0, body: [] }], allowed, "right", 0, 0))
      .toEqual([{ op: "repeat", count: 0, body: [{ op: "right" }] }]);
  });
  it("rejects nested loops even if the palette offers repeat", () => {
    expect(insertParallelCommand([{ op: "repeat", count: 2, body: [] }], allowed, "repeat", 0, 0)).toBeNull();
  });
  it.each(["teleport", "foreach", "pickup", null, {}, "<script>"])("rejects foreign/unsupported drag data %j", (op) => {
    expect(insertParallelCommand([], allowed, op, 0)).toBeNull();
  });
  it("checks allowed commands and the 80-node combined budget", () => {
    expect(insertParallelCommand([], ["right"], "wait", 0)).toBeNull();
    const p: ParallelProgram = [{ op: "repeat", count: 1, body: Array.from({ length: 78 }, () => ({ op: "wait" })) }];
    expect(countParallelNodes(p)).toBe(79);
    const next = insertParallelCommand(p, allowed, "end", 78, 0)!;
    expect(countParallelNodes(next)).toBe(80);
    expect(insertParallelCommand(next, allowed, "right", 1)).toBeNull();
  });
  it.each([-1, 1, 1.5, NaN])("rejects invalid root insertion index %s", (index) => {
    expect(insertParallelCommand([], allowed, "right", index)).toBeNull();
  });
  it.each([-1, 1, 0.5])("rejects invalid loop parent %s", (parent) => {
    expect(insertParallelCommand([{ op: "repeat", count: 1, body: [] }], allowed, "right", 0, parent)).toBeNull();
  });
  it("rejects a stale loop index, an action as parent and an out-of-range body slot", () => {
    expect(insertParallelCommand([{ op: "right" }], allowed, "wait", 0, 0)).toBeNull();
    expect(insertParallelCommand([{ op: "repeat", count: 2, body: [] }], allowed, "wait", 1, 0)).toBeNull();
  });
  it("creates an empty IF draft with independent THEN and ELSE arrays", () => {
    const p = insertParallelCommand([], allowed, "if", 0)!;
    expect(p).toEqual([{ op: "if", condition: { kind: "wall", direction: "right", not: false }, then: [], else: [] }]);
    expect(getParallelEditorList(p, [0, 0])).not.toBe(getParallelEditorList(p, [0, 1]));
  });
  it("allows IF inside repeat and action drops into its branches", () => {
    const p = insertParallelCommand([{ op: "repeat", count: 2, body: [] }], allowed, "if", 0, [0])!;
    const next = insertParallelCommand(p, allowed, "right", 0, [0, 0, 0])!;
    expect(getParallelEditorList(next, [0, 0, 0])).toEqual([{ op: "right" }]);
    expect(getParallelEditorList(p, [0, 0, 0])).toEqual([]);
    expect(countParallelNodes(next)).toBe(3);
  });
  it("accepts nested IF but rejects repeat inside either branch", () => {
    const p = insertParallelCommand([], allowed, "if", 0)!;
    for (const branch of [0, 1]) {
      expect(insertParallelCommand(p, allowed, "if", 0, [0, branch])).not.toBeNull();
      expect(insertParallelCommand(p, allowed, "repeat", 0, [0, branch])).toBeNull();
    }
  });
  it("changes only the addressed branch when reordering/deleting", () => {
    let p = insertParallelCommand([], allowed, "if", 0)!;
    p = insertParallelCommand(p, allowed, "right", 0, [0, 0])!;
    p = insertParallelCommand(p, allowed, "wait", 0, [0, 1])!;
    const next = updateParallelEditorList(p, [0, 0], () => [])!;
    expect(getParallelEditorList(next, [0, 0])).toEqual([]);
    expect(getParallelEditorList(next, [0, 1])).toEqual([{ op: "wait" }]);
    expect(getParallelEditorList(p, [0, 0])).toEqual([{ op: "right" }]);
  });
  it("counts both arms for node limits", () => {
    let p = insertParallelCommand([], allowed, "if", 0)!;
    p = updateParallelEditorList(p, [0, 0], () => Array.from({ length: 40 }, () => ({ op: "wait" })))!;
    p = updateParallelEditorList(p, [0, 1], () => Array.from({ length: 39 }, () => ({ op: "wait" })))!;
    expect(countParallelNodes(p)).toBe(80);
    expect(insertParallelCommand(p, allowed, "right", 0, [0, 0])).toBeNull();
  });
  it.each([{ path: [0] }, { path: [0, 2] }, { path: [0, 0, 0, 0] }, { path: [-1] }])("rejects invalid branch address $path", ({ path }) => {
    const p = insertParallelCommand([], allowed, "if", 0)!;
    expect(getParallelEditorList(p, path)).toBeNull();
    expect(updateParallelEditorList(p, path, () => [])).toBeNull();
  });
  it("assigns unique marker IDs independently of line numbers", () => {
    let p = insertParallelCommand([], allowed, "label", 0)!;
    p = insertParallelCommand(p, allowed, "label", 0)!;
    expect(parallelLabels(p)).toEqual(["B", "A"]);
    p = insertParallelCommand(p, allowed, "jump", 2)!;
    expect(p[2]).toEqual({ op: "jump", target: "B" });
  });
  it("keeps missing-target drafts editable without silently retargeting", () => {
    const p: ParallelProgram = [{ op: "label", id: "A" }, { op: "jump", target: "A" }];
    expect(updateParallelEditorList(p, undefined, (list) => list.slice(1))).toEqual([{ op: "jump", target: "A" }]);
    expect(insertParallelCommand([], allowed, "jump", 0)).toEqual([{ op: "jump", target: "" }]);
    expect(insertParallelCommand([{ op: "jump", target: "A" }], allowed, "label", 0)).toEqual([{ op: "label", id: "B" }, { op: "jump", target: "A" }]);
  });
  it("allows branch jumps but rejects markers inside a loop or branch", () => {
    const p: ParallelProgram = [{ op: "if", condition: { kind: "goal", not: false }, then: [], else: [] }];
    expect(insertParallelCommand(p, allowed, "jump", 0, [0, 0])).not.toBeNull();
    expect(insertParallelCommand(p, allowed, "label", 0, [0, 0])).toBeNull();
    expect(insertParallelCommand([{ op: "repeat", count: 2, body: [] }], allowed, "label", 0, [0])).toBeNull();
  });
});
