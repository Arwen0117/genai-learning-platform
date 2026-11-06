import { describe, expect, it } from "vitest";
import { createParallelExecution, executeParallelProgram, type ParallelExecution, type ParallelProgram } from "./parallel-engine";
import { getParallelTemplate } from "./parallel-levels";
import { initialParallelPlayer, isParallelTerminal, parallelPlayerReducer, type ParallelPlayerState } from "./parallel-player";

const t = getParallelTemplate("parallel-lanes");
function prepared(program: ParallelProgram = t.reference) {
  return parallelPlayerReducer(initialParallelPlayer(t.level), { type: "edit", program });
}
function tick(s: ParallelPlayerState) {
  return parallelPlayerReducer(s, { type: "tick", expected: s.execution! });
}
describe("parallel playback controls", () => {
  it("starts empty with a selected robot but no execution", () => {
    expect(initialParallelPlayer(t.level)).toEqual({ program: [], selectedId: "a", execution: null, playing: false, inputError: null });
  });
  it("run starts at tick zero and step advances the entire world", () => {
    const run = parallelPlayerReducer(prepared(), { type: "run", level: t.level });
    expect(run.execution?.worldTicks).toBe(0); expect(run.playing).toBe(true);
    const step = parallelPlayerReducer(prepared(), { type: "step", level: t.level });
    expect(step.execution?.worldTicks).toBe(1);
    expect(step.execution?.robots.map((r) => r.position.x)).toEqual([1, 1]);
    expect(step.playing).toBe(false);
  });
  it("selection changes no world state or scheduler state", () => {
    const run = parallelPlayerReducer(prepared(), { type: "run", level: t.level });
    const selected = parallelPlayerReducer(run, { type: "select", id: "b", level: t.level });
    expect(selected.selectedId).toBe("b"); expect(selected.execution).toBe(run.execution);
    expect(selected.playing).toBe(true);
    expect(tick(selected).execution).toEqual(tick(run).execution);
    expect(parallelPlayerReducer(selected, { type: "select", id: "missing", level: t.level })).toBe(selected);
  });
  it("pause/resume invalidates a queued timeout and continues without repeating", () => {
    const first = tick(parallelPlayerReducer(prepared(), { type: "run", level: t.level }));
    const paused = parallelPlayerReducer(first, { type: "pause" });
    expect(tick(paused)).toBe(paused);
    const resumed = parallelPlayerReducer(paused, { type: "continue" });
    expect(parallelPlayerReducer(resumed, { type: "tick", expected: first.execution! })).toBe(resumed);
    expect(tick(resumed).execution?.worldTicks).toBe(2);
  });
  it("ignores step while playing and duplicate timeout callbacks", () => {
    const run = parallelPlayerReducer(prepared(), { type: "run", level: t.level });
    expect(parallelPlayerReducer(run, { type: "step", level: t.level })).toBe(run);
    const next = tick(run);
    expect(parallelPlayerReducer(next, { type: "tick", expected: run.execution! })).toBe(next);
  });
  it.each(["reset", "edit", "run"] as const)("%s invalidates an older run", (type) => {
    const old = tick(parallelPlayerReducer(prepared(), { type: "run", level: t.level }));
    const next = type === "reset" ? parallelPlayerReducer(old, { type })
      : type === "edit" ? parallelPlayerReducer(old, { type, program: [{ op: "wait" }] })
      : parallelPlayerReducer(old, { type, level: t.level });
    expect(parallelPlayerReducer(next, { type: "tick", expected: old.execution! })).toBe(next);
    if (type === "reset") expect(next.program).toEqual(old.program);
    if (type === "edit") expect(next.execution).toBeNull();
    if (type === "run") expect(next.execution?.worldTicks).toBe(0);
  });
  it("clear is an edit to empty program and stops playback", () => {
    const run = parallelPlayerReducer(prepared(), { type: "run", level: t.level });
    const empty = parallelPlayerReducer(run, { type: "edit", program: [] });
    expect(empty.program).toEqual([]); expect(empty.execution).toBeNull(); expect(empty.playing).toBe(false);
  });
  it("run and world-step reach the same final engine state", () => {
    let s = prepared();
    for (let i = 0; i < 4; i++) s = parallelPlayerReducer(s, { type: "step", level: t.level });
    expect(s.execution).toEqual(executeParallelProgram(t.level, t.reference));
    expect(parallelPlayerReducer(s, { type: "step", level: t.level })).toBe(s);
    expect(parallelPlayerReducer(s, { type: "continue" })).toBe(s);
  });
  it.each([
    { program: t.reference, status: "passed" },
    { program: [{ op: "wait" }] as ParallelProgram, status: "incomplete" },
    { program: [{ op: "left" }] as ParallelProgram, status: "error" },
  ])("stops automatically on $status", ({ program, status }) => {
    let s = parallelPlayerReducer(prepared(program), { type: "run", level: t.level });
    while (s.playing) s = tick(s);
    expect(s.execution?.status).toBe(status); expect(tick(s)).toBe(s);
  });
  it.each(["run", "step"] as const)("%s reports invalid loop drafts without executing", (type) => {
    const s = parallelPlayerReducer(prepared([{ op: "repeat", count: 2, body: [] }]), { type, level: t.level });
    expect(s.inputError).toBe("INVALID_LOOP_BODY"); expect(s.playing).toBe(false); expect(s.execution).toBeNull();
    expect(parallelPlayerReducer(s, { type: "edit", program: t.reference }).inputError).toBeNull();
  });
  it("pause/continue before run are no-ops", () => {
    const s = initialParallelPlayer(t.level);
    expect(parallelPlayerReducer(s, { type: "pause" })).toBe(s);
    expect(parallelPlayerReducer(s, { type: "continue" })).toBe(s);
  });
  it("knows all terminal world states", () => {
    expect(isParallelTerminal(null)).toBe(false);
    const base = createParallelExecution(t.level, t.reference);
    for (const status of ["ready", "paused", "passed", "incomplete", "error"] as const)
      expect(isParallelTerminal({ ...base, status } as ParallelExecution)).toBe(["passed", "incomplete", "error"].includes(status));
  });
});
