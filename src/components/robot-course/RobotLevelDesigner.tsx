"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReferenceProgramRunner } from "./ReferenceProgramRunner";
import { PARALLEL_COMMANDS, type ParallelLevel } from "@/lib/programming-game/parallel-engine";
import { configureParallelTemplate } from "@/lib/programming-game/parallel-levels";
import { type ParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
import { GAME_MESSAGES } from "@/components/blocks/programming-game/messages";
import { PARALLEL_MESSAGES } from "@/components/blocks/programming-game/parallel-messages";
import { ROBOT_MESSAGES } from "./messages";

export function RobotLevelDesigner({ payload, onChange, locale, onVerified }: { payload: ParallelProgrammingPayload; onChange: (p: ParallelProgrammingPayload) => void; locale: "en" | "zh"; onVerified: (signature: string, passed: boolean) => void }) {
  const m = GAME_MESSAGES[locale], p = PARALLEL_MESSAGES[locale];
  const commandName = (op: typeof PARALLEL_COMMANDS[number]) => op === "if" ? p.if : op === "repeat" ? m.repeat : op === "label" ? p.label : op === "jump" ? p.jump : op === "wait" ? p.wait : op === "end" ? p.end : m.actions[op];
  const w = ROBOT_MESSAGES[locale], [brush, setBrush] = useState("wall");
  if (!payload.customLevel) return <Button type="button" variant="outline" onClick={() => {
    const t = configureParallelTemplate(payload.templateId, payload.robotCount);
    onChange({ ...payload, allowed: [...PARALLEL_COMMANDS], customLevel: { ...t.level, allowed: [...PARALLEL_COMMANDS] }, referenceProgram: t.reference });
  }}>{w.customize}</Button>;
  const level = payload.customLevel;
  function update(map: ParallelLevel) { onChange({ ...payload, customLevel: map, robotCount: map.robots.length, allowed: [...map.allowed] }); }
  function resize(key: "width" | "height", n: number) {
    if (!Number.isInteger(n) || n < 1 || n > 12) return;
    const next = { ...level, [key]: n }, inside = (p: { x: number; y: number }) => p.x < next.width && p.y < next.height;
    // Keep starts visible. Collisions after resizing are reported until the teacher moves them.
    update({ ...next, walls: level.walls.filter(inside), goals: level.goals.filter(inside), robots: level.robots.map((r) => ({ ...r, start: { x: Math.min(r.start.x, next.width - 1), y: Math.min(r.start.y, next.height - 1) } })) });
  }
  function paint(x: number, y: number) {
    const at = (p: { x: number; y: number }) => p.x === x && p.y === y;
    const walls = level.walls.filter((p) => !at(p)), goals = level.goals.filter((p) => !at(p));
    if (brush.startsWith("robot:")) {
      const id = brush.slice(6); if (level.robots.some((r) => r.id !== id && at(r.start))) return;
      update({ ...level, walls, robots: level.robots.map((r) => r.id === id ? { ...r, start: { x, y } } : r) });
    } else if (brush === "wall") {
      if (level.robots.some((r) => at(r.start))) return;
      update({ ...level, walls: level.walls.some(at) ? walls : [...walls, { x, y }], goals });
    } else update({ ...level, walls, goals: brush === "goal" && !level.goals.some(at) ? [...goals, { x, y }] : goals });
  }
  function count(n: number) {
    const robots = level.robots.slice(0, n);
    for (let i = robots.length; i < n; i++) {
      let cell: { x: number; y: number } | null = null;
      for (let y = 0; y < level.height && !cell; y++) for (let x = 0; x < level.width && !cell; x++)
        if (!robots.some((r) => r.start.x === x && r.start.y === y) && !level.walls.some((p) => p.x === x && p.y === y)) cell = { x, y };
      if (!cell) return; robots.push({ id: String.fromCharCode(97 + i), start: cell });
    }
    update({ ...level, robots }); setBrush("wall");
  }

  return <section className="space-y-4 rounded-xl border p-4" aria-label={w.map}>
    <h3 className="font-semibold">{w.map}</h3>
    <div className="flex flex-wrap gap-4">{(["width", "height"] as const).map((key) => <label key={key}>{key === "width" ? w.width : w.height}<input type="number" className="ml-2 w-16 rounded border bg-background p-1" min={1} max={12} aria-label={key === "width" ? w.width : w.height} value={level[key]} onChange={(e) => resize(key, Number(e.target.value))} /></label>)}<label>{w.robot}<select className="ml-2 rounded border bg-background p-1" aria-label={w.robot} value={level.robots.length} onChange={(e) => count(Number(e.target.value))}>{[1,2,3,4].map((n) => <option key={n}>{n}</option>)}</select></label></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label={locale === "zh" ? "地图画笔" : "Map tools"}>{["wall", "floor", "goal", ...level.robots.map((r) => `robot:${r.id}`)].map((b) => <Button type="button" size="sm" key={b} variant={brush === b ? "default" : "outline"} aria-pressed={brush === b} onClick={() => setBrush(b)}>{b === "wall" ? w.wall : b === "floor" ? w.floor : b === "goal" ? w.goal : `${w.robot} ${b.slice(6)}`}</Button>)}</div>
    <div className="grid max-w-[600px] gap-1" style={{ gridTemplateColumns: `repeat(${level.width}, minmax(0, 1fr))` }} role="group" aria-label={w.map}>
      {Array.from({ length: level.width * level.height }, (_, i) => { const x = i % level.width, y = Math.floor(i / level.width), wall = level.walls.some((p) => p.x === x && p.y === y), goal = level.goals.some((p) => p.x === x && p.y === y), robot = level.robots.find((r) => r.start.x === x && r.start.y === y);
        return <button key={i} type="button" className="min-w-0 rounded border p-1 text-xs" style={{ aspectRatio: "1", background: wall ? "#4b6570" : goal ? "#b0dfc7" : "#e5f0f4", color: "#173d52" }} aria-label={`${x},${y}: ${robot ? `${w.robot} ${robot.id}` : ""} ${wall ? w.wall : goal ? w.goal : w.floor}`} onClick={() => paint(x, y)}>{robot ? `🤖 ${robot.id}` : wall ? "■" : goal ? "⚑" : `${x},${y}`}</button>;
      })}
    </div>
    <fieldset className="flex flex-wrap gap-3"><legend>{locale === "zh" ? "允许指令" : "Allowed commands"}</legend>{PARALLEL_COMMANDS.map((op) => <label key={op} className="text-xs"><input type="checkbox" checked={level.allowed.includes(op)} onChange={(e) => update({ ...level, allowed: e.target.checked ? [...level.allowed, op] : level.allowed.filter((a) => a !== op) })} /> {commandName(op)}</label>)}</fieldset>
    <ReferenceProgramRunner payload={payload} locale={locale} onChange={onChange} onVerified={onVerified} />
  </section>;
}
