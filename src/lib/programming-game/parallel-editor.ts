import {
  ALL_PARALLEL_COMMANDS as PARALLEL_COMMANDS, PARALLEL_LIMITS, PARALLEL_IF_DEPTH, countParallelProgramNodes,
  type ParallelCommand, type ParallelLevel, type ParallelProgram,
} from "./parallel-engine";

export type ParallelInsertOp = ParallelLevel["allowed"][number];
/** [] = root; [i] = repeat body; [i,0/1] = IF arm;
 * [i,j,0/1] = arm of IF j inside repeat i. Numeric B2 parents still work. */
export type ParallelEditorParent = number | number[];
export const countParallelNodes = countParallelProgramNodes;
export function parallelLabels(program: ParallelProgram): string[] {
  const labels: string[] = [];
  function visit(list: ParallelProgram) {
    for (const c of list) {
      if (c.op === "label") labels.push(c.id);
      else if (c.op === "if") { visit(c.then); visit(c.else); }
    }
  }
  visit(program);
  return labels;
}
function nextLabel(program: ParallelProgram): string {
  const used = new Set(parallelLabels(program));
  function reserveTargets(list: ParallelProgram) {
    for (const c of list) {
      if (c.op === "jump") used.add(c.target);
      else if (c.op === "repeat") reserveTargets(c.body);
      else if (c.op === "if") { reserveTargets(c.then); reserveTargets(c.else); }
    }
  }
  // A deleted but referenced marker must not be silently reused elsewhere.
  reserveTargets(program);
  for (let i = 0; i < PARALLEL_LIMITS.nodes; i++) {
    const id = i < 26 ? String.fromCharCode(65 + i) : `M${i + 1}`;
    if (!used.has(id)) return id;
  }
  throw new Error("TOO_MANY_NODES");
}
const pathOf = (parent?: ParallelEditorParent) => parent === undefined ? [] : typeof parent === "number" ? [parent] : parent;

function context(program: ParallelProgram, parent?: ParallelEditorParent) {
  const path = pathOf(parent);
  if (path.length > 1 + 2 * PARALLEL_IF_DEPTH || path.some((n) => !Number.isInteger(n) || n < 0)) return null;
  let list = program;
  let kind: "root" | "repeat" | "branch" = "root";
  let ifDepth = 0, inRepeat = false;
  for (let i = 0; i < path.length; i++) {
    const node = list[path[i]];
    if (!node) return null;
    if (node.op === "repeat") { if (inRepeat) return null; inRepeat = true; list = node.body; kind = "repeat"; }
    else if (node.op === "if") {
      if (++ifDepth > PARALLEL_IF_DEPTH) return null;
      const arm = path[++i];
      if (arm !== 0 && arm !== 1) return null;
      list = arm === 0 ? node.then : node.else; kind = "branch";
    } else return null;
  }
  return { list, kind, ifDepth, inRepeat };
}
export function getParallelEditorList(program: ParallelProgram, parent?: ParallelEditorParent): ParallelProgram | null {
  return context(program, parent)?.list ?? null;
}

/** Changes one existing list, cloning its ancestors. It never moves nodes
 * between scopes; insertion separately enforces C1 structural restrictions. */
export function updateParallelEditorList(
  program: ParallelProgram, parent: ParallelEditorParent | undefined,
  update: (list: ParallelProgram) => ParallelProgram,
): ParallelProgram | null {
  if (!context(program, parent)) return null;
  const path = pathOf(parent);
  function replace(list: ParallelProgram, offset: number): ParallelProgram {
    if (offset === path.length) return update(list);
    return list.map((node, index) => {
      if (index !== path[offset]) return node;
      if (node.op === "repeat") return { ...node, body: replace(node.body, offset + 1) };
      if (node.op === "if") return path[offset + 1] === 0
        ? { ...node, then: replace(node.then, offset + 2) }
        : { ...node, else: replace(node.else, offset + 2) };
      return node;
    });
  }
  return replace(program, 0);
}

/** Click and palette drag share validation. Unfinished counts and empty arms
 * are editable drafts; execution rejects them until completed. */
export function insertParallelCommand(
  program: ParallelProgram, allowed: ParallelLevel["allowed"],
  op: unknown, index: number, parent?: ParallelEditorParent,
): ParallelProgram | null {
  if (!(PARALLEL_COMMANDS as readonly unknown[]).includes(op) ||
      !allowed.includes(op as ParallelInsertOp) || countParallelNodes(program) >= PARALLEL_LIMITS.nodes ||
      !Number.isInteger(index) || index < 0) return null;
  const target = context(program, parent);
  if (!target || index > target.list.length ||
      (op === "label" && target.inRepeat) || (op === "repeat" && target.inRepeat) ||
      (op === "if" && target.ifDepth >= PARALLEL_IF_DEPTH)) return null;
  const command: ParallelCommand = op === "repeat" ? { op: "repeat", count: 2, body: [] }
    : op === "if" ? { op: "if", condition: { kind: "wall", direction: "right", not: false }, then: [], else: [] }
    : op === "label" ? { op: "label", id: nextLabel(program) }
    : op === "jump" ? { op: "jump", target: parallelLabels(program)[0] ?? "" }
    : { op: op as Exclude<ParallelInsertOp, "repeat" | "if" | "label" | "jump"> };
  return updateParallelEditorList(program, parent, (list) => [...list.slice(0, index), command, ...list.slice(index)]);
}

/** Move a complete subtree atomically. Addresses refer to the pre-drag tree. */
export function moveParallelCommand(
  program: ParallelProgram, allowed: ParallelLevel["allowed"], source: number[],
  index: number, parent: ParallelEditorParent = [],
): ParallelProgram | null {
  if (!source.length || source.some((n) => !Number.isInteger(n) || n < 0) || !Number.isInteger(index) || index < 0) return null;
  const sourceParent = source.slice(0, -1), sourceIndex = source[source.length - 1];
  const from = context(program, sourceParent), destination = pathOf(parent);
  const target = context(program, destination), node = from?.list[sourceIndex];
  if (!node || !target || index > target.list.length || countParallelNodes(program) > PARALLEL_LIMITS.nodes) return null;
  const prefix = (a: number[], b: number[]) => a.length <= b.length && a.every((n, i) => n === b[i]);
  if (prefix(source, destination)) return null; // Never put a container inside itself.
  function accepts(c: ParallelCommand, kind: "root" | "repeat" | "branch", depth: number, inRepeat: boolean): boolean {
    if (!allowed.includes(c.op)) return false;
    if (c.op === "label") return !inRepeat;
    if (c.op === "repeat") return !inRepeat && c.body.every((child) => accepts(child, "repeat", depth, true));
    if (c.op === "if") return depth < PARALLEL_IF_DEPTH && [...c.then, ...c.else].every((child) => accepts(child, "branch", depth + 1, inRepeat));
    return true;
  }
  if (!accepts(node, target.kind, target.ifDepth, target.inRepeat)) return null;
  const sameList = sourceParent.length === destination.length && prefix(sourceParent, destination);
  if (sameList && (index === sourceIndex || index === sourceIndex + 1)) return program;
  const rebased = [...destination];
  if (prefix(sourceParent, destination) && destination.length > sourceParent.length && destination[sourceParent.length] > sourceIndex)
    rebased[sourceParent.length]--;
  const removed = updateParallelEditorList(program, sourceParent, (list) => list.filter((_, i) => i !== sourceIndex));
  if (!removed) return null;
  const slot = sameList && index > sourceIndex ? index - 1 : index;
  return updateParallelEditorList(removed, rebased, (list) => [...list.slice(0, slot), node, ...list.slice(slot)]);
}
