"use client";

import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PARALLEL_COMPARISONS, PARALLEL_VALUE_LIMIT, PARALLEL_ACTIONS, PARALLEL_LIMITS, PARALLEL_IF_DEPTH, type ParallelCondition, type ParallelCommand, type ParallelLevel, type ParallelLocation, type ParallelProgram } from "@/lib/programming-game/parallel-engine";
import { countParallelNodes, getParallelEditorList, insertParallelCommand, moveParallelCommand, parallelLabels, updateParallelEditorList, type ParallelInsertOp } from "@/lib/programming-game/parallel-editor";
import { PARALLEL_COMPARISON_SYMBOLS, changeParallelConditionKind, changeParallelObservation, parallelObservation } from "@/lib/programming-game/parallel-condition";
import { GAME_MESSAGES } from "./messages";
import { PARALLEL_MESSAGES } from "./parallel-messages";
import "./compact-editor.css";

const DRAG_TYPE = "application/x-parallel-command";
type EditorDrag = { program: ParallelProgram; payload: string } & ({ kind: "palette"; op: ParallelInsertOp } | { kind: "block"; path: number[] });
const ARROWS = { up: "↑", down: "↓", left: "←", right: "→" };
function category(op: ParallelInsertOp): "move" | "condition" | "loop" | "flow" | "state" {
  return op in ARROWS ? "move" : op === "if" ? "condition" : op === "repeat" ? "loop" : op === "label" || op === "jump" ? "flow" : "state";
}

/** View-only expansion is separate from the executable AST. Empty arms stay
 * small; adding/removing blocks still uses the same bounded editor operations.
 */
export function CompactParallelEditor({ level, program, focus, onEdit, locale }: {
  level: ParallelLevel; program: ParallelProgram; focus: ParallelLocation | null | undefined;
  onEdit: (program: ParallelProgram) => void; locale: "en" | "zh";
}) {
  const m = GAME_MESSAGES[locale]; const p = PARALLEL_MESSAGES[locale];
  const [openElse, setOpenElse] = useState<Set<string>>(() => new Set());
  const [dragging, setDragging] = useState<ParallelProgram | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [targetCue, setTargetCue] = useState<string | null>(null);
  const drag = useRef<EditorDrag | null>(null);
  const editorRoot = useRef<HTMLDivElement | null>(null);
  const nodes = countParallelNodes(program);
  const labels = parallelLabels(program);
  const name = (op: ParallelInsertOp) => op === "repeat" ? m.repeat : op === "if" ? p.if : op === "jump" ? p.jump : op === "label" ? p.label : op === "wait" ? p.wait : op === "end" ? p.end : m.actions[op];
  const symbol = (op: ParallelInsertOp) => op in ARROWS ? ARROWS[op as keyof typeof ARROWS] : op === "repeat" ? "↻" : op === "if" ? "?" : op === "jump" ? "↷" : op === "label" ? "◆" : op === "wait" ? "Ⅱ" : op === "pickup" ? "↥" : op === "drop" ? "↧" : "■";
  function number(path: number[]) {
    const parts: string[] = []; let list = program;
    for (let i = 0; i < path.length; i++) {
      const node = list[path[i]]; parts.push(String(path[i] + 1));
      if (node?.op === "repeat") list = node.body;
      else if (node?.op === "if" && i + 1 < path.length) { const arm = path[++i]; parts.push(arm === 0 ? p.then : p.else); list = arm === 0 ? node.then : node.else; }
    }
    return parts.join(".");
  }
  function endDrag() { drag.current = null; setDragging(null); setDropTarget(null); }
  function edit(next: ParallelProgram) {
    endDrag(); setOpenElse(new Set());
    editorRoot.current?.querySelectorAll<HTMLDetailsElement>(".pg-node-menu[open]").forEach((menu) => { menu.open = false; });
    onEdit(next);
  }
  function changeList(parent: number[], update: (list: ParallelProgram) => ParallelProgram) {
    const next = updateParallelEditorList(program, parent, update); if (next) edit(next);
  }
  function changeNode(path: number[], update: (node: ParallelCommand) => ParallelCommand) {
    changeList(path.slice(0, -1), (list) => list.map((c, i) => i === path[path.length - 1] ? update(c) : c));
  }
  function options(parent: number[]): ParallelInsertOp[] {
    let depth = 0, inRepeat = false, list = program;
    for (let i = 0; i < parent.length; i++) {
      const node = list[parent[i]];
      if (node?.op === "repeat") { inRepeat = true; list = node.body; }
      else if (node?.op === "if") { depth++; list = parent[++i] === 0 ? node.then : node.else; }
    }
    const controls: ParallelInsertOp[] = [
      ...(!inRepeat ? ["repeat" as const] : []),
      ...(depth < PARALLEL_IF_DEPTH ? ["if" as const] : []),
      ...(!inRepeat ? ["label" as const] : []), "jump",
    ];
    return [...PARALLEL_ACTIONS, ...(level.delivery ? ["pickup", "drop"] as const : []), ...controls].filter((op) => level.allowed.includes(op));
  }
  function add(op: ParallelInsertOp, parent: number[] = []) {
    const list = getParallelEditorList(program, parent); if (!list) return;
    const next = insertParallelCommand(program, level.allowed, op, list.length, parent); if (next) edit(next);
  }
  function startDrag(event: DragEvent, op: ParallelInsertOp) {
    if (nodes >= PARALLEL_LIMITS.nodes) { event.preventDefault(); return; }
    drag.current = { kind: "palette", op, program, payload: `palette:${op}` }; setDragging(program); event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData(DRAG_TYPE, drag.current.payload);
  }
  function startMove(event: DragEvent, path: number[]) {
    event.stopPropagation();
    drag.current = { kind: "block", path, program, payload: `block:${path.join(".")}` };
    setDragging(program); event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, drag.current.payload);
  }
  function candidate(active: EditorDrag, index: number, parent: number[]) {
    return active.kind === "palette" ? insertParallelCommand(program, level.allowed, active.op, index, parent)
      : moveParallelCommand(program, level.allowed, active.path, index, parent);
  }
  function dropHandlers(index: number, parent: number[] = []) {
    const target = `${parent.join(".")}:${index}`;
    return {
      onDragOver(event: DragEvent<HTMLDivElement>) {
        event.stopPropagation();
        if (!drag.current || drag.current.program !== program || !Array.from(event.dataTransfer.types).includes(DRAG_TYPE)) return;
        event.preventDefault();
        const valid = candidate(drag.current, index, parent) !== null;
        event.dataTransfer.dropEffect = valid ? (drag.current.kind === "palette" ? "copy" : "move") : "none"; setDropTarget(valid ? target : null);
      },
      onDragLeave() { setDropTarget((current) => current === target ? null : current); },
      onDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault(); event.stopPropagation();
        const active = drag.current;
        if (active?.program === program && event.dataTransfer.getData(DRAG_TYPE) === active.payload) {
          const next = candidate(active, index, parent); if (next && next !== program) edit(next);
        }
        endDrag();
      },
      "data-drop-active": dragging === program && dropTarget === target ? "true" : undefined,
    };
  }
  function adder(parent: number[]) {
    const title = `${p.addHere} ${number(parent)}`;
    return <select className="pg-compact-add" aria-label={title} title={title} value="" disabled={nodes >= PARALLEL_LIMITS.nodes}
      onChange={(event) => add(event.target.value as ParallelInsertOp, parent)}>
      <option value="">+</option>
      {options(parent).map((op) => <option value={op} key={op}>{symbol(op)} {name(op)}</option>)}
    </select>;
  }
  function arm(list: ParallelProgram, parent: number[], caption: string) {
    return <div {...dropHandlers(list.length, parent)} className={`pg-compact-arm ${list.length ? "" : "pg-compact-arm-empty"}`} aria-label={caption}>
      {list.length > 0 && <span className="pg-arm-caption">{caption}</span>}
      {rows(list, parent)}
      <div {...dropHandlers(list.length, parent)} className="pg-compact-arm-tail" aria-label={`${p.dropBranch} ${number(parent)}`}>{adder(parent)}<span className="pg-drag-caption">{p.drop}</span></div>
    </div>;
  }
  function nodeMenu(c: ParallelCommand, index: number, list: ParallelProgram, parent: number[]) {
    const path = [...parent, index]; const num = number(path); const key = path.join(".");
    return <details className="pg-node-menu">
      <summary aria-label={`${p.more} ${num}`} title={p.more}>⋯</summary>
      <div className="pg-node-menu-content">
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`${m.moveUp} ${num}`} disabled={index === 0}
          onClick={() => changeList(parent, (old) => { const next = [...old]; [next[index], next[index - 1]] = [next[index - 1], next[index]]; return next; })}>↑</Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`${m.moveDown} ${num}`} disabled={index === list.length - 1}
          onClick={() => changeList(parent, (old) => { const next = [...old]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })}>↓</Button>
        <Button type="button" size="sm" variant="ghost" aria-label={`${m.remove} ${num}`} onClick={() => changeList(parent, (old) => old.filter((_, i) => i !== index))}>×</Button>
        {c.op === "if" && !c.else.length && <button type="button" className="pg-menu-else" onClick={() => setOpenElse((old) => {
          const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next;
        })}>{openElse.has(key) ? p.hideElse : p.addElse} {num}</button>}
      </div>
    </details>;
  }
  function rows(list: ParallelProgram, parent: number[] = []) {
    return <ol className="pg-compact-list">
      {list.map((c, index) => {
        const path = [...parent, index]; const num = number(path); const kind = category(c.op);
        const highlighted = focus?.path.join(".") === path.join(".");
        return <li key={index} className={`pg-block pg-kind-${kind}`} aria-current={highlighted ? "step" : undefined} data-op={c.op} data-targeted={c.op === "label" && c.id === targetCue ? "true" : undefined}>
          <div {...dropHandlers(index, parent)} className="pg-drop-slot" aria-label={`${p.insert} ${num}`}><span>+</span></div>
          <div className="pg-block-header">
            <button type="button" className="pg-block-drag" draggable aria-label={`${p.moveBlock} ${num}`} title={p.moveHint} onDragStart={(event) => startMove(event, path)} onDragEnd={endDrag}>⠿</button>
            {!parent.length && <span className="pg-block-number">{num}</span>}
            <span className="pg-block-name"><span aria-hidden="true">{symbol(c.op)}</span> {name(c.op)}</span>
            {c.op === "repeat" && <Input className="pg-repeat-count" type="number" min={1} max={20} step={1} value={c.count || ""} aria-label={`${m.times} ${num}`}
              onChange={(e) => changeNode(path, (node) => node.op === "repeat" ? { ...node, count: Number(e.target.value) } : node)} />}
            {c.op === "label" && <span className="pg-target-id">{c.id}</span>}
            {c.op === "jump" && <select className="pg-block-select" value={c.target} aria-label={`${p.destination} ${num}`}
              onFocus={() => setTargetCue(c.target)} onBlur={() => setTargetCue(null)}
              onChange={(e) => { setTargetCue(e.target.value); changeNode(path, (node) => node.op === "jump" ? { ...node, target: e.target.value } : node); }}>
              <option value="">{p.chooseTarget}</option>
              {c.target && !labels.includes(c.target) && <option value={c.target}>⚠ {c.target} · {p.missingTarget}</option>}
              {labels.map((id) => <option key={id} value={id}>◆ {id}</option>)}
            </select>}
            {c.op === "if" && <>
              {parallelObservation(c.condition) !== "self" ? <span className="pg-direction-widget">
                {parallelObservation(c.condition) === "current" ? <span aria-hidden="true" className="pg-current-cell">◎</span> : <svg aria-hidden="true" className="pg-direction-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: `rotate(${{ right: 0, down: 90, left: 180, up: -90 }[parallelObservation(c.condition) as keyof typeof ARROWS]}deg)` }}><path d="M4 12h15m-6-6 6 6-6 6" /></svg>}
                <select className="pg-block-select pg-direction-select" value={parallelObservation(c.condition)} aria-label={`${p.direction} ${num}`} title={p.direction}
                  onChange={(e) => changeNode(path, (node) => node.op === "if" ? { ...node, condition: changeParallelObservation(node.condition, e.target.value as keyof typeof ARROWS | "current") } : node)}>
                  {(c.condition.kind === "goal" || c.condition.kind === "delivery" || c.condition.kind === "item" || c.condition.kind === "value") && <option value="current">◎ {p.currentCell}</option>}
                  {Object.entries(ARROWS).map(([dir, arrow]) => <option value={dir} key={dir}>{arrow} {m.actions[dir as keyof typeof ARROWS]}</option>)}
                </select>
              </span> : <span className="pg-current-cell" title={p.self} aria-label={p.self}>●</span>}
              {c.condition.kind === "value" ? <>
                <select className="pg-block-select" aria-label={`${p.valueSource} ${num}`} value={c.condition.source} onChange={(e) => changeNode(path, (node) => {
                  if (node.op !== "if" || node.condition.kind !== "value") return node;
                  const next = { ...node.condition, source: e.target.value as "item" | "holding" }; if (next.source === "holding") delete next.direction;
                  return { ...node, condition: next };
                })}><option value="item">{p.itemValue}</option><option value="holding">{p.holdingValue}</option></select>
                <select className="pg-block-select pg-comparison-select" aria-label={`${p.comparison} ${num}`} value={c.condition.operator} onChange={(e) => changeNode(path, (node) => node.op === "if" && node.condition.kind === "value" ? { ...node, condition: { ...node.condition, operator: e.target.value as typeof PARALLEL_COMPARISONS[number] } } : node)}>{PARALLEL_COMPARISONS.map((op) => <option key={op} value={op}>{PARALLEL_COMPARISON_SYMBOLS[op]}</option>)}</select>
                <Input className="pg-value-input" type="number" min={-PARALLEL_VALUE_LIMIT} max={PARALLEL_VALUE_LIMIT} step={1} aria-label={`${p.numberValue} ${num}`} value={Number.isFinite(c.condition.value) ? c.condition.value : ""} onChange={(e) => changeNode(path, (node) => node.op === "if" && node.condition.kind === "value" ? { ...node, condition: { ...node.condition, value: e.target.valueAsNumber } } : node)} />
                {c.condition.not && <button type="button" title={p.negate} aria-label={`${p.negate} ${num}`} onClick={() => changeNode(path, (node) => node.op === "if" ? { ...node, condition: { ...node.condition, not: false } } : node)}>NOT</button>}
              </> : <select className="pg-block-select pg-comparison-select" value={c.condition.not ? "not" : "is"} aria-label={`${p.comparison} ${num}`} title={p.comparison}
                onChange={(e) => changeNode(path, (node) => node.op === "if" ? { ...node, condition: { ...node.condition, not: e.target.value === "not" } } : node)}>
                <option value="is">=</option><option value="not">≠</option>
              </select>}
              <select className="pg-block-select pg-condition-select" value={c.condition.kind} aria-label={`${p.condition} ${num}`} title={p.conditions[c.condition.kind]}
                onChange={(e) => changeNode(path, (node) => node.op === "if" ? { ...node, condition: changeParallelConditionKind(node.condition, e.target.value as ParallelCondition["kind"]) } : node)}>
                {(["wall", "boundary", "robot", "goal", ...(level.delivery ? ["delivery", "item", "holding"] as const : []), ...(level.delivery?.numbers ? ["value"] as const : [])] as const).map((kind) => <option value={kind} key={kind}>{p.shortConditions[kind]}</option>)}
              </select>
            </>}
            {nodeMenu(c, index, list, parent)}
          </div>
          {c.op === "repeat" && arm(c.body, path, `${m.body} ${num}`)}
          {c.op === "if" && <>
            {arm(c.then, [...path, 0], `${p.then} ${num}`)}
            {(c.else.length > 0 || openElse.has(path.join("."))) && arm(c.else, [...path, 1], `${p.else} ${num}`)}
          </>}
        </li>;
      })}
    </ol>;
  }
  return <div ref={editorRoot} className="pg-compact-editor" data-dragging={dragging === program ? "true" : undefined}>
    <div className="pg-editor-heading"><h3>{m.program}</h3><span>{nodes}/{PARALLEL_LIMITS.nodes}</span></div>
    <div className="pg-compact-palette" role="group" aria-label={p.palette}>
      {options([]).map((op) => <button key={op} type="button" className={`pg-tool pg-kind-${category(op)}`} draggable={nodes < PARALLEL_LIMITS.nodes}
        disabled={nodes >= PARALLEL_LIMITS.nodes} aria-label={`${m.add} ${name(op)}`} title={`${name(op)} · ${p.dragHint}`}
        onClick={() => add(op)} onDragStart={(event) => startDrag(event, op)} onDragEnd={endDrag}>
        <span aria-hidden="true">{symbol(op)}</span> {name(op)}
      </button>)}
    </div>
    <div className="pg-color-legend" aria-label={p.legendTitle}>
      {(["move", "condition", "loop", "flow", "state"] as const).map((kind) => <span key={kind} className={`pg-kind-${kind}`}><i aria-hidden="true" />{p.kinds[kind]}</span>)}
    </div>
    <div {...dropHandlers(program.length)} className="pg-program-drop" role="group" aria-label={m.program}>
      {program.length ? rows(program) : <p className="pg-empty-program">{m.empty}</p>}
      <div {...dropHandlers(program.length)} className="pg-drop-tail" aria-label={p.drop}>+ {p.drop}</div>
    </div>
  </div>;
}
