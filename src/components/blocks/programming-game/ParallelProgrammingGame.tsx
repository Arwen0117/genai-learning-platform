"use client";

import { useEffect, useId, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  parseParallelProgram, type ParallelCondition, type ParallelLevel, type ParallelLocation, type ParallelProgram, type ParallelRobot,
} from "@/lib/programming-game/parallel-engine";
import { initialParallelPlayer, isParallelTerminal, parallelPlayerReducer } from "@/lib/programming-game/parallel-player";
import { parallelConditionLabel } from "@/lib/programming-game/parallel-condition";
import { GAME_MESSAGES } from "./messages";
import { PARALLEL_MESSAGES } from "./parallel-messages";
import { ParallelWarehouseBoard } from "./ParallelWarehouseBoard";
import { CompactParallelEditor } from "./CompactParallelEditor";
import type { ProgrammingSubmitResult } from "./ProgrammingActivity";
import type { KnowledgeCard } from "@/lib/programming-game/knowledge";
import { buildProgrammingTeaching, type ProgrammingTeaching } from "@/lib/programming-game/teaching";
import { ProgrammingConcepts, ProgrammingPseudocode } from "./ProgrammingTeachingPanels";
import { WORKSHOP_MESSAGES } from "./workshop-messages";
import type { ParallelInsertOp } from "@/lib/programming-game/parallel-editor";

type Props = { tutorial?: boolean; teaching?: ProgrammingTeaching; level: ParallelLevel; title: string; task: string; locale: "en" | "zh"; hints?: string[]; reference?: ParallelProgram; onNext?: () => void; course?: boolean; initialProgram?: ParallelProgram; onProgramChange?: (program: ParallelProgram) => void; onValidationResult?: (passed: boolean) => void; onLocalPassed?: () => void; knowledge?: KnowledgeCard[]; onSubmit?: (run: { attemptId: string; program: ParallelProgram }) => Promise<ProgrammingSubmitResult> };
const SELECT = "h-9 max-w-full rounded-lg border border-input bg-background px-2 text-sm";

/** Shared workshop/course player; only the course wrapper supplies submission. */
export function ParallelProgrammingGame(props: Props) {
  let teaching = props.teaching;
  if (!teaching && props.reference) {
    try { teaching = buildProgrammingTeaching(props.level, props.reference, props.locale); } catch { /* Incomplete teacher drafts remain editable. */ }
  }
  return <ParallelSession key={JSON.stringify(props.level)} {...props} teaching={teaching} />;
}

function ParallelSession({ tutorial = false, teaching, level, title, task, locale, hints = [], reference, onNext, course = false, knowledge = [], onSubmit, onLocalPassed, initialProgram = [], onProgramChange, onValidationResult }: Props) {
  const w = WORKSHOP_MESSAGES[locale];
  const m = GAME_MESSAGES[locale]; const p = PARALLEL_MESSAGES[locale];
  const [state, dispatch] = useReducer(parallelPlayerReducer, level, (value) => ({ ...initialParallelPlayer(value), program: initialProgram }));
  const [delay, setDelay] = useState(500);
  const inputId = useId();
  const attemptId = useRef<string | null>(null), runSubmit = useRef(onSubmit), submitting = useRef(false), mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [submission, setSubmission] = useState<ProgrammingSubmitResult | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function invalidate() { attemptId.current = null; setSubmission(null); }
  function begin(type: "run" | "step") {
    if (submitting.current) return;
    if (type === "run" || !state.execution) {
      attemptId.current = crypto.randomUUID(); runSubmit.current = onSubmit; setSubmission(null);
    }
    dispatch({ type, level });
  }
  async function submit() {
    const handler = runSubmit.current;
    if (!handler || !terminal || !attemptId.current || submitting.current || submission?.ok) return;
    submitting.current = true; setBusy(true);
    try {
      const result = await handler({ attemptId: attemptId.current, program });
      if (mounted.current) setSubmission(result);
    } catch { if (mounted.current) setSubmission({ ok: false, error: m.submitFailed }); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }
  const program = state.program;
  const execution = state.execution;
  const terminal = isParallelTerminal(execution);
  useEffect(() => { if (execution && isParallelTerminal(execution)) onValidationResult?.(execution.status === "passed"); }, [execution, onValidationResult]);
  useEffect(() => { if (execution?.status === "passed" && !onSubmit) onLocalPassed?.(); }, [execution?.status, onSubmit, onLocalPassed]);
  // Initial positions/selection have no dependency on the draft program.
  const [initial] = useState<ParallelRobot[]>(() => level.robots.map((r) => ({
    id: r.id, position: { ...r.start }, cursor: 0, status: "ready", last: null,
    blocked: null, error: null, attempts: 0, successfulMoves: 0, loopIterations: 0,
  })));
  const robots = execution?.robots ?? initial;
  const items = execution?.items ?? level.delivery?.items.map((i) => ({ id: i.id, position: i.start })) ?? [];
  const selected = robots.find((r) => r.id === state.selectedId) ?? robots[0];
  const next = selected.status === "ended" || selected.status === "error" ? null : execution?.instructions[selected.cursor] ?? null;
  const focus = next ?? selected.last;
  const select = (id: string) => dispatch({ type: "select", id, level });
  const edit = (updated: ParallelProgram) => { if (submitting.current) return; invalidate(); dispatch({ type: "edit", program: updated }); onProgramChange?.(updated); };
  const actionName = (op: ParallelInsertOp) => op === "if" ? p.if : op === "jump" ? p.jump : op === "label" ? p.label : op === "repeat" ? m.repeat : op === "wait" ? p.wait : op === "end" ? p.end : m.actions[op];
  function formatPath(path: number[]) {
    const parts: string[] = []; let list = program;
    for (let i = 0; i < path.length; i++) {
      const index = path[i]; parts.push(String(index + 1)); const node = list[index];
      if (node?.op === "if" && i + 1 < path.length) {
        const arm = path[++i]; parts.push(arm === 0 ? p.then : p.else); list = arm === 0 ? node.then : node.else;
      } else if (node?.op === "repeat") list = node.body;
    }
    return parts.join(".");
  }
  const location = (at: ParallelLocation | null | undefined) => at
    ? `${formatPath(at.path)}${at.iteration === null ? "" : ` · ${m.iteration} ${at.iteration}`}` : p.none;
  const conditionText = (c: ParallelCondition) => parallelConditionLabel(c, { ...m.actions, current: p.currentCell, self: p.self }, p.shortConditions, { item: p.itemValue, holding: p.holdingValue });

  useEffect(() => {
    if (!state.playing || !execution) return;
    const timer = window.setTimeout(() => {
      if (document.hidden) dispatch({ type: "pause" });
      else dispatch({ type: "tick", expected: execution });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state.playing, execution, delay]);
  useEffect(() => {
    const hide = () => { if (document.hidden) dispatch({ type: "pause" }); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);


  return <fieldset disabled={busy} className="pg-player min-w-0 space-y-4" aria-label={p.parallel}>
    <div className="space-y-1"><h2 className="text-xl font-semibold">{title}</h2><p>{task}</p>
</div>
    <ProgrammingConcepts teaching={teaching} locale={locale} />
    <div className="pg-parallel-workspace pg-game-stage">
    <div className="pg-game-scene min-w-0 space-y-4">
    <ParallelWarehouseBoard level={level} robots={robots} selectedId={selected.id} onSelect={select} items={items} passed={execution?.status === "passed"} locale={locale} />
    <div className="space-y-2 rounded-lg border p-3">
      <h3 className="font-semibold">{p.robots}</h3>
      <div className="flex flex-wrap gap-2">
        {robots.map((r) => <Button key={r.id} type="button" size="sm" variant={r.id === selected.id ? "default" : "outline"}
          aria-pressed={r.id === selected.id} onClick={() => select(r.id)} aria-label={`${p.select} ${r.id}`}>
          {m.robot} {r.id} · ({r.position.x},{r.position.y}) · {p.robotStatus[r.status]}
        </Button>)}
      </div>
      <details className="pg-robot-inspector">
      <summary>{p.inspect} · {selected.id}</summary>
      <div className="space-y-1 break-words text-sm" aria-label={p.selected}>
        <p className="font-medium">{p.selected}: {selected.id} · {p.robotStatus[selected.status]}</p>
        <p>{m.position}: ({selected.position.x},{selected.position.y})</p>
        {level.delivery && <p>{selected.holding ? `${p.holding}: ${selected.holding}${level.delivery?.numbers ? ` [${level.delivery.items.find((i) => i.id === selected.holding)?.value}]` : ""}` : p.emptyHands}</p>}
        <p>{p.next}: {location(next)} {next ? `· ${actionName(next.op)}` : ""}</p>
        <p>{p.last}: {location(selected.last)}</p>
        {selected.decision && <p>{p.decision}: {selected.decision.result ? p.true : p.false} · {conditionText(selected.decision.condition)} · {p.tick} {selected.decision.tick} · {m.at} {location(selected.decision.at)}</p>}
        <p>{p.perAttempts}: {selected.attempts} · {p.loopIterations}: {selected.loopIterations}</p>
        {selected.status === "ended" && <p>{p.finished}</p>}
        {selected.blocked && <p>{p.blocked}: {p.blocking[selected.blocked.reason]} · {p.related}: {selected.blocked.robotIds.join(", ")}</p>}
        {selected.error && <p>{p.errors[selected.error.code]} · {p.tick} {selected.error.tick} · {m.at} {location(selected.error.at)}</p>}
      </div>
      </details>
    </div>
    </div>
    <div className="pg-game-console min-w-0 space-y-4">
    {tutorial && <section className="space-y-2 rounded-lg border bg-muted/20 p-3" aria-label={locale === "zh" ? "教学演示" : "Tutorial demonstration"}>
      <h3 className="font-semibold">{locale === "zh" ? "教学关 · 参考程序已加载" : "Tutorial · Reference program loaded"}</h3>
      <p className="text-sm">{locale === "zh" ? "点击运行观看程序效果，使用暂停、世界单步和速度选项观察高亮模块及机器人状态。可修改程序进行试验，或恢复教师参考答案。" : "Run the program to watch it work. Pause, step or slow down to inspect highlighted blocks and robot state. Experiment with edits or restore the instructor's answer."}</p>
      {reference && <Button type="button" variant="outline" onClick={() => edit(parseParallelProgram(reference, level))}>{locale === "zh" ? "恢复参考程序" : "Restore reference program"}</Button>}
    </section>}
    <CompactParallelEditor key={program.length ? "filled" : "empty"} level={level} program={program} focus={focus} onEdit={edit} locale={locale} />
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" disabled={!program.length} onClick={() => begin("run")}>{execution ? m.restart : m.run}</Button>
      {state.playing ? <Button type="button" variant="outline" onClick={() => dispatch({ type: "pause" })}>{m.pause}</Button>
        : <Button type="button" variant="outline" disabled={!execution || terminal} onClick={() => dispatch({ type: "continue" })}>{m.resume}</Button>}
      <Button type="button" variant="outline" disabled={state.playing || terminal || !program.length} onClick={() => begin("step")}>{p.worldStep}</Button>
      <Button type="button" variant="outline" onClick={() => { invalidate(); dispatch({ type: "reset" }); }}>{m.reset}</Button>
      <Button type="button" variant="outline" disabled={!program.length} title={m.clearNote} onClick={() => edit([])}>{m.clear}</Button>
      <label className="flex items-center gap-2 text-sm" htmlFor={inputId}>{p.tickDuration}
        <select id={inputId} className={SELECT} value={delay} aria-label={p.tickDuration} onChange={(e) => setDelay(Number(e.target.value))}>
          <option value={150}>{m.fast}</option><option value={500}>{m.normal}</option><option value={1000}>{m.slow}</option>
        </select>
      </label>
    </div>
    <div className="space-y-1 rounded-lg border bg-muted/20 p-3 text-sm" role="status" aria-live="polite" aria-atomic="true">
      <p className="font-medium">{state.playing ? m.running : !execution ? m.ready : execution.status === "ready" ? m.paused : m[execution.status]}</p>
      <p>{p.ticks}: {execution?.worldTicks ?? 0} · {p.attempts}: {execution?.instructionAttempts ?? 0} · {p.moves}: {execution?.successfulMoves ?? 0}</p>
      {execution?.failure && <p>{p.failure[execution.failure.code]} · {p.tick} {execution.failure.tick}</p>}
      {execution?.errors.map((e) => <p key={e.robotId}>{m.robot} {e.robotId}: {p.errors[e.code]} · {m.at} {location(e.at)} · {p.tick} {e.tick}</p>)}
      {!!execution?.undeliveredItemIds?.length && <p>{p.undelivered}: {execution.undeliveredItemIds.join(", ")}</p>}
      {!!execution?.unmetRobotIds.length && <p>{p.unmet}: {execution.unmetRobotIds.join(", ")}</p>}
    </div>
    {terminal && onSubmit && <div className="space-y-2 rounded-lg border p-3 text-sm">
      <p>{m.serverNote}</p><Button type="button" disabled={busy || submission?.ok === true} onClick={() => void submit()}>{busy ? m.submitting : submission?.ok ? m.submitted : submission ? m.retrySubmit : m.submitRun}</Button>
      {submission?.ok ? <p role="status">{submission.grade.completed ? m.serverPassed : m.serverNotPassed} · {submission.grade.score?.raw ?? 0}/100</p>
        : submission ? <p role="alert">{submission.code === "LEVEL_CHANGED" ? m.levelChanged : submission.error}</p> : null}
    </div>}
    {terminal && course && !onSubmit && <p className="text-sm text-muted-foreground">{m.local}</p>}
    <details className="pg-learning-panel"><summary>{w.hints}</summary><ol className="list-decimal space-y-2 pl-5">{hints.map((hint, i) => <li key={i}>{hint}</li>)}</ol></details>
    {reference && <details key={tutorial ? "tutorial-answer" : "challenge-answer"} open={tutorial ? true : undefined} className="pg-learning-panel"><summary>{w.answer}</summary><p className="my-2 text-sm">{w.answerNote}</p><AnswerProgram program={reference} locale={locale} /><Button type="button" className="mt-3" variant="outline" title={w.replace} onClick={() => edit(parseParallelProgram(reference, level))}>{w.use}</Button></details>}
    {state.inputError && <p role="alert" className="text-sm text-destructive">{p.errors[state.inputError] ?? state.inputError}</p>}
    </div>
    </div>
    <ProgrammingPseudocode key={JSON.stringify(teaching)} teaching={teaching} locale={locale} />
    {!course && <div className="pg-level-footer"><span>{execution?.status === "passed" ? (onNext ? m.passed : w.done) : w.locked}</span>{onNext && <Button type="button" disabled={execution?.status !== "passed"} onClick={onNext}>{w.next} <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></Button>}</div>}
    <details className="pg-workshop-help"><summary>{p.helpTitle}</summary><div className="space-y-1 text-xs text-muted-foreground"><p>{p.help}</p><p>{course ? m.serverNote : p.note}</p><p>{p.goal}</p><p>{m.resetNote}</p><p>{p.concurrent}</p>{level.delivery && <p>{p.itemHelp}</p>}{level.delivery?.numbers && <p>{p.numericHelp}</p>}<p>{p.pausedOnHide}</p><p>{p.limits}</p>{level.allowed.includes("if") && <p>{p.ifNote}</p>}</div></details>
    {knowledge.length > 0 && <section aria-label={m.knowledgeHeading} className="space-y-2"><h3 className="font-semibold">{m.knowledgeHeading}</h3>{knowledge.map((c, i) => <details key={i} className="rounded border p-3"><summary>{c.title}</summary><p className="whitespace-pre-wrap text-sm">{c.body}</p></details>)}</section>}
  </fieldset>;
}

function AnswerProgram({ program, locale }: { program: ParallelProgram; locale: "en" | "zh" }) {
  const p = PARALLEL_MESSAGES[locale], m = GAME_MESSAGES[locale];
  return <ol className="pg-answer-list">{program.map((c, i) => <li key={i}>
    {c.op === "repeat" ? <><strong>{m.repeat} × {c.count}</strong><AnswerProgram program={c.body} locale={locale} /></>
    : c.op === "if" ? <><strong>{p.if} {parallelConditionLabel(c.condition, { ...m.actions, current: p.currentCell, self: p.self }, p.shortConditions, { item: p.itemValue, holding: p.holdingValue })}</strong><div>{p.then}<AnswerProgram program={c.then} locale={locale} /></div>{c.else.length > 0 && <div>{p.else}<AnswerProgram program={c.else} locale={locale} /></div>}</>
    : c.op === "label" ? <>{p.label} ◆ {c.id}</> : c.op === "jump" ? <>{p.jump} → {c.target}</> : c.op === "wait" ? p.wait : c.op === "end" ? p.end : m.actions[c.op]}
  </li>)}</ol>;
}
