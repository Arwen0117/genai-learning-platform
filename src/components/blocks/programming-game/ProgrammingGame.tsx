"use client";

import { useEffect, useId, useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTIONS,
  LIMITS,
  samePoint,
  type Action,
  type Command,
  type Level,
  type Program,
} from "@/lib/programming-game/engine";
import {
  initialPlayer,
  isTerminal,
  playerReducer,
} from "@/lib/programming-game/player";
import { GAME_MESSAGES } from "./messages";

export type ProgrammingGameProps = {
  level: Level;
  title: string;
  task: string;
  hints?: string[];
  locale: "en" | "zh";
};
const SELECT =
  "h-9 max-w-full rounded-lg border border-input bg-background px-2 text-sm";

/** Local interaction only. Integration with official submissions is a later step. */
export function ProgrammingGame(props: ProgrammingGameProps) {
  // New rule data remounts the session, cancelling timers and stale results.
  return <GameSession key={JSON.stringify(props.level)} {...props} />;
}

function GameSession({
  level,
  title,
  task,
  hints = [],
  locale,
}: ProgrammingGameProps) {
  const m = GAME_MESSAGES[locale];
  const [state, dispatch] = useReducer(playerReducer, undefined, initialPlayer);
  const [delay, setDelay] = useState(500);
  const id = useId();
  const execution = state.execution;
  const terminal = isTerminal(execution);
  const program = state.program;
  const nodes = program.reduce(
    (n, c) => n + 1 + (c.op === "repeat" ? c.body.length : 0),
    0,
  );
  const robot = execution?.robot ?? level.start;
  const item = execution ? execution.item : level.item;
  const last = execution?.error?.at ?? execution?.last;
  const next = execution?.instructions[execution.cursor];
  const active = state.playing ? (next ?? last) : last;

  useEffect(() => {
    if (!state.playing || !execution) return;
    const timeout = window.setTimeout(() => {
      if (document.hidden) dispatch({ type: "pause" });
      else dispatch({ type: "tick", expected: execution });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [state.playing, execution, delay]);

  useEffect(() => {
    function hide() {
      if (document.hidden) dispatch({ type: "pause" });
    }
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  function edit(updated: Program) {
    dispatch({ type: "edit", program: updated });
  }
  function changeBody(index: number, body: { op: Action }[]) {
    edit(
      program.map((c, i) =>
        i === index && c.op === "repeat" ? { ...c, body } : c,
      ),
    );
  }
  function move(index: number, direction: number, parent?: number) {
    const list =
      parent === undefined
        ? [...program]
        : [...(program[parent] as Extract<Command, { op: "repeat" }>).body];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    if (parent === undefined) edit(list);
    else changeBody(parent, list as { op: Action }[]);
  }
  function remove(index: number, parent?: number) {
    if (parent === undefined) edit(program.filter((_, i) => i !== index));
    else {
      const loop = program[parent];
      if (loop.op === "repeat")
        changeBody(
          parent,
          loop.body.filter((_, i) => i !== index),
        );
    }
  }
  function add(op: Action | "repeat", parent?: number) {
    if (nodes >= LIMITS.nodes) return;
    if (parent !== undefined && op !== "repeat") {
      const loop = program[parent];
      if (loop.op === "repeat") changeBody(parent, [...loop.body, { op }]);
    } else if (parent === undefined) {
      edit([...program, op === "repeat" ? { op, count: 2, body: [] } : { op }]);
    }
  }
  function addButtons(parent?: number) {
    return (
      <div
        className="flex flex-wrap gap-2"
        aria-label={
          parent === undefined ? m.add : `${m.addInside} ${parent + 1}`
        }
      >
        {ACTIONS.filter((op) => level.allowed.includes(op)).map((op) => (
          <Button
            key={op}
            type="button"
            variant="outline"
            size="sm"
            disabled={nodes >= LIMITS.nodes}
            onClick={() => add(op, parent)}
            aria-label={`${parent === undefined ? m.add : `${m.addInside} ${parent + 1}`} ${m.actions[op]}`}
          >
            + {m.actions[op]}
          </Button>
        ))}
        {parent === undefined && level.allowed.includes("repeat") ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={nodes >= LIMITS.nodes}
            onClick={() => add("repeat")}
          >
            + {m.repeat}
          </Button>
        ) : null}
      </div>
    );
  }
  function rows(list: Program, parent?: number) {
    return (
      <ol className="space-y-2">
        {list.map((command, index) => {
          const path = parent === undefined ? [index] : [parent, index];
          const number = path.map((n) => n + 1).join(".");
          const highlighted = active?.path.join(".") === path.join(".");
          return (
            <li
              key={index}
              className={`rounded-lg border p-2 ${highlighted ? "border-primary bg-primary/10" : "border-border"}`}
              aria-current={highlighted ? "step" : undefined}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {number}
                </span>
                <span className="text-sm font-medium">
                  {command.op === "repeat" ? m.repeat : m.actions[command.op]}
                </span>
                {command.op === "repeat" ? (
                  <label className="flex items-center gap-2 text-xs">
                    {m.times}
                    <Input
                      className="w-20"
                      type="number"
                      min={1}
                      max={LIMITS.repeat}
                      step={1}
                      aria-label={`${m.times} ${number}`}
                      value={command.count || ""}
                      onChange={(event) =>
                        edit(
                          program.map((c, i) =>
                            i === index && c.op === "repeat"
                              ? { ...c, count: Number(event.target.value) }
                              : c,
                          ),
                        )
                      }
                    />
                  </label>
                ) : null}
                <div className="ml-auto flex gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={index === 0}
                    aria-label={`${m.moveUp} ${number}`}
                    onClick={() => move(index, -1, parent)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={index === list.length - 1}
                    aria-label={`${m.moveDown} ${number}`}
                    onClick={() => move(index, 1, parent)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`${m.remove} ${number}`}
                    onClick={() => remove(index, parent)}
                  >
                    {m.remove}
                  </Button>
                </div>
              </div>
              {command.op === "repeat" ? (
                <div className="mt-2 space-y-2 border-l-2 border-primary/30 pl-3">
                  <p className="text-xs text-muted-foreground">{m.body}</p>
                  {rows(command.body, index)}
                  {addButtons(index)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    );
  }
  const status = state.playing
    ? m.running
    : execution
      ? execution.status === "ready"
        ? m.paused
        : m[execution.status]
      : m.ready;
  return (
    <section className="space-y-5" aria-label={title}>
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm">{task}</p>
        <p className="text-sm text-muted-foreground">{m.help}</p>
      </header>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <section className="min-w-0 space-y-3" aria-label={m.map}>
          <h3 className="font-medium">{m.map}</h3>
          <div className="overflow-x-auto rounded-xl border bg-muted/20 p-3">
            <div
              role="table"
              aria-label={m.map}
              className="mx-auto w-max space-y-1"
            >
              {Array.from({ length: level.height }, (_, y) => (
                <div role="row" key={y} className="flex gap-1">
                  {Array.from({ length: level.width }, (_, x) => {
                    const at = { x, y };
                    const isRobot = samePoint(robot, at);
                    const isItem = samePoint(item, at);
                    const isGoal = samePoint(level.goal.at, at);
                    const isWall = level.walls.some((p) => samePoint(p, at));
                    const labels = [
                      isRobot && m.robot,
                      isItem && m.parcel,
                      isGoal && m.goal,
                      isWall && m.wall,
                    ].filter(Boolean);
                    return (
                      <div
                        role="cell"
                        key={x}
                        aria-label={`${x},${y}: ${labels.join(", ") || m.emptyCell}`}
                        className={`flex size-11 shrink-0 items-center justify-center rounded-md border font-mono text-sm ${isWall ? "bg-foreground/20" : isGoal ? "border-primary bg-primary/10" : "bg-background"}`}
                      >
                        <span aria-hidden="true">
                          {isWall
                            ? "#"
                            : `${isRobot ? "R" : ""}${isItem ? "P" : ""}${isGoal ? "G" : ""}` ||
                              "·"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{m.legend}</p>
          <p className="text-sm" data-testid="robot-position">
            {m.position}: ({robot.x}, {robot.y})
          </p>
          <p className="text-sm">
            {m.carrying}: {execution?.holding ? m.yes : m.no}
          </p>
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer">{m.hint}</summary>
            {hints.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {hints.map((hint, i) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2">{m.hintsEmpty}</p>
            )}
          </details>
        </section>
        <section className="min-w-0 space-y-3" aria-label={m.program}>
          <div className="flex justify-between gap-2">
            <h3 className="font-medium">{m.program}</h3>
            <span className="text-xs text-muted-foreground">
              {m.nodes}: {nodes}/{LIMITS.nodes}
            </span>
          </div>
          {addButtons()}
          {!program.length ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {m.empty}
            </p>
          ) : (
            rows(program)
          )}
          <p className="text-xs text-muted-foreground">{m.limits}</p>
        </section>
      </div>
      <div className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!program.length}
            onClick={() => dispatch({ type: "run", level })}
          >
            {execution ? m.restart : m.run}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!state.playing}
            onClick={() => dispatch({ type: "pause" })}
          >
            {m.pause}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!execution || state.playing || terminal}
            onClick={() => dispatch({ type: "continue" })}
          >
            {m.resume}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!program.length || state.playing || terminal}
            onClick={() => dispatch({ type: "step", level })}
          >
            {m.step}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => dispatch({ type: "reset" })}
          >
            {m.reset}
          </Button>
          <label htmlFor={`${id}-speed`} className="text-xs">
            {m.speed}
          </label>
          <select
            id={`${id}-speed`}
            value={delay}
            className={SELECT}
            onChange={(event) => setDelay(Number(event.target.value))}
          >
            <option value={200}>{m.fast}</option>
            <option value={500}>{m.normal}</option>
            <option value={1000}>{m.slow}</option>
          </select>
        </div>
        <p role="status" className="font-medium">
          {status}
        </p>
        <p className="text-sm">
          {m.steps}: {execution?.steps ?? 0}/{LIMITS.steps}
        </p>
        {active ? (
          <p className="text-xs">
            {m.at}: {active.path.map((n) => n + 1).join(".")}
            {active.iteration !== null
              ? ` · ${m.iteration}: ${active.iteration}`
              : ""}
          </p>
        ) : null}
        {state.inputError ? (
          <p role="alert" className="text-sm text-destructive">
            {m.errors[state.inputError] ?? m.errors.INVALID_ACTION}
          </p>
        ) : null}
        {execution?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {m.errors[execution.error.code]}
          </p>
        ) : null}
        {execution?.unmet.map((reason) => (
          <p key={reason} className="text-sm">
            {reason === "POSITION"
              ? m.needPosition
              : reason === "DELIVERY"
                ? m.needDelivery
                : m.needLoop}
          </p>
        ))}
        {terminal ? (
          <p className="text-sm text-muted-foreground">{m.local}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{m.resetNote}</p>
      </div>
    </section>
  );
}
