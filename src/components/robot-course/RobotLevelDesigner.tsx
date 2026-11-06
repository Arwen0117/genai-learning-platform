"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReferenceProgramRunner } from "./ReferenceProgramRunner";
import { PARALLEL_VALUE_LIMIT, ALL_PARALLEL_COMMANDS, PARALLEL_COMMANDS, type ParallelLevel } from "@/lib/programming-game/parallel-engine";
import { configureParallelTemplate } from "@/lib/programming-game/parallel-levels";
import { type ParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
import { GAME_MESSAGES } from "@/components/blocks/programming-game/messages";
import { PARALLEL_MESSAGES } from "@/components/blocks/programming-game/parallel-messages";
import { ROBOT_MESSAGES } from "./messages";

export function RobotLevelDesigner({ payload, onChange, locale, onVerified }: { payload: ParallelProgrammingPayload; onChange: (p: ParallelProgrammingPayload) => void; locale: "en" | "zh"; onVerified: (signature: string, passed: boolean) => void }) {
  const m = GAME_MESSAGES[locale], p = PARALLEL_MESSAGES[locale];
  const commandName = (op: typeof ALL_PARALLEL_COMMANDS[number]) => op === "if" ? p.if : op === "repeat" ? m.repeat : op === "label" ? p.label : op === "jump" ? p.jump : op === "wait" ? p.wait : op === "end" ? p.end : m.actions[op];
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
    update({ ...next, ...(level.delivery ? { delivery: { ...level.delivery, items: level.delivery.items.filter((i) => inside(i.start)), targets: level.delivery.targets.filter(inside) } } : {}), walls: level.walls.filter(inside), goals: level.goals.filter(inside), robots: level.robots.map((r) => ({ ...r, start: { x: Math.min(r.start.x, next.width - 1), y: Math.min(r.start.y, next.height - 1) } })) });
  }
  function paint(x: number, y: number) {
    const at = (p: { x: number; y: number }) => p.x === x && p.y === y;
    const next = { ...level, walls: level.walls.filter((p) => !at(p)) };
    if (brush.startsWith("robot:")) {
      const id = brush.slice(6); if (level.robots.some((r) => r.id !== id && at(r.start))) return;
      update({ ...next, robots: level.robots.map((r) => r.id === id ? { ...r, start: { x, y } } : r) }); return;
    }
    if (brush === "item" && level.delivery) {
      let items = level.delivery.items.filter((i) => !at(i.start));
      if (items.length === level.delivery.items.length) {
        if (items.length >= 12) return;
        let n = 1; while (items.some((i) => i.id === `parcel${n}`)) n++;
        items = [...items, { id: `parcel${n}`, start: { x, y }, ...(level.delivery.numbers ? { value: 0 } : {}) }];
      }
      update({ ...next, delivery: { ...level.delivery, items } }); return;
    }
    if (brush === "delivery" && level.delivery) {
      const targets = level.delivery.targets.filter((p) => !at(p));
      update({ ...next, delivery: { ...level.delivery, targets: targets.length === level.delivery.targets.length ? [...targets, { x, y, ...(level.delivery.numbers ? { value: 0 } : {}) }] : targets } }); return;
    }
    if (brush === "goal") {
      const goals = level.goals.filter((p) => !at(p));
      update({ ...next, goals: goals.length === level.goals.length ? [...goals, { x, y }] : goals }); return;
    }
    if (brush === "wall" && level.robots.some((r) => at(r.start))) return;
    update({ ...next, walls: brush === "wall" && !level.walls.some(at) ? [...next.walls, { x, y }] : next.walls,
      goals: level.goals.filter((p) => !at(p)),
      ...(level.delivery ? { delivery: { ...level.delivery, items: level.delivery.items.filter((i) => !at(i.start)), targets: level.delivery.targets.filter((p) => !at(p)) } } : {}) });
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
    <label className="flex gap-2"><input type="checkbox" aria-label={locale === "zh" ? "启用物品配送" : "Enable parcel delivery"} checked={!!level.delivery} onChange={(e) => {
      const next = { ...level };
      if (e.target.checked) { next.delivery = { version: 1, items: level.robots.map((r, i) => ({ id: `parcel${i + 1}`, start: { ...r.start } })), targets: level.goals.map((g) => ({ ...g })) }; next.allowed = [...level.allowed, ...(["pickup", "drop"] as const).filter((op) => !level.allowed.includes(op))]; }
      else { delete next.delivery; next.allowed = level.allowed.filter((op) => op !== "pickup" && op !== "drop"); setBrush("wall"); }
      update(next);
    }} />{locale === "zh" ? "启用物品配送（关闭会清除物品和配送区）" : "Enable parcel delivery (disabling removes parcels and delivery zones)"}</label>
    {level.delivery && <p className="text-sm">{p.itemHelp} {locale === "zh" ? "最多12件物品；配送区和机器人目标可以重叠。" : "Up to 12 parcels; delivery zones can overlap robot goals."}</p>}
    {level.delivery && <label className="flex gap-2"><input type="checkbox" aria-label={locale === "zh" ? "启用物品数值" : "Enable parcel values"} checked={!!level.delivery.numbers} onChange={(e) => {
      const d = level.delivery!;
      const stripValue = <T extends { value?: number },>(v: T) => { const next = { ...v }; delete next.value; return next; };
      const next = { ...d, items: d.items.map((i) => e.target.checked ? { ...i, value: i.value ?? 0 } : stripValue(i)), targets: d.targets.map((t) => e.target.checked ? { ...t, value: t.value ?? 0 } : stripValue(t)) };
      if (e.target.checked) next.numbers = { version: 1 }; else delete next.numbers;
      update({ ...level, delivery: next });
    }} />{locale === "zh" ? "启用物品数值（关闭会清除数值，需移除数值判断后重新验证）" : "Enable parcel values (disabling clears values; remove numeric tests and revalidate)"}</label>}
    {level.delivery?.numbers && <fieldset className="space-y-3 rounded border p-3"><legend>{locale === "zh" ? "物品与配送区数值" : "Parcel and delivery values"}</legend><p className="text-sm">{p.numericHelp}</p>
      <div className="flex flex-wrap gap-3">{level.delivery.items.map((item) => <label key={item.id} className="text-sm">📦 {item.id} ({item.start.x},{item.start.y})<input className="ml-2 w-20 rounded border bg-background p-1" type="number" min={-PARALLEL_VALUE_LIMIT} max={PARALLEL_VALUE_LIMIT} step={1} aria-label={`${p.itemValue} ${item.id}`} value={Number.isFinite(item.value) ? item.value : ""} onChange={(e) => update({ ...level, delivery: { ...level.delivery!, items: level.delivery!.items.map((i) => i.id === item.id ? { ...i, value: e.target.valueAsNumber } : i) } })} /></label>)}</div>
      <div className="flex flex-wrap gap-3">{level.delivery.targets.map((target, index) => <label key={`${target.x},${target.y}`} className="text-sm">▧ ({target.x},{target.y})<input className="ml-2 w-20 rounded border bg-background p-1" type="number" min={-PARALLEL_VALUE_LIMIT} max={PARALLEL_VALUE_LIMIT} step={1} aria-label={`${p.delivery} ${p.numberValue} ${target.x},${target.y}`} value={Number.isFinite(target.value) ? target.value : ""} onChange={(e) => update({ ...level, delivery: { ...level.delivery!, targets: level.delivery!.targets.map((t, i) => i === index ? { ...t, value: e.target.valueAsNumber } : t) } })} /></label>)}</div>
    </fieldset>}
    <div className="flex flex-wrap gap-4">{(["width", "height"] as const).map((key) => <label key={key}>{key === "width" ? w.width : w.height}<input type="number" className="ml-2 w-16 rounded border bg-background p-1" min={1} max={12} aria-label={key === "width" ? w.width : w.height} value={level[key]} onChange={(e) => resize(key, Number(e.target.value))} /></label>)}<label>{w.robot}<select className="ml-2 rounded border bg-background p-1" aria-label={w.robot} value={level.robots.length} onChange={(e) => count(Number(e.target.value))}>{[1,2,3,4].map((n) => <option key={n}>{n}</option>)}</select></label></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label={locale === "zh" ? "地图画笔" : "Map tools"}>{["wall", "floor", "goal", ...(level.delivery ? ["item", "delivery"] : []), ...level.robots.map((r) => `robot:${r.id}`)].map((b) => <Button type="button" size="sm" key={b} variant={brush === b ? "default" : "outline"} aria-pressed={brush === b} onClick={() => setBrush(b)}>{b === "wall" ? w.wall : b === "floor" ? w.floor : b === "goal" ? w.goal : b === "item" ? p.item : b === "delivery" ? p.delivery : `${w.robot} ${b.slice(6)}`}</Button>)}</div>
    <div className="grid max-w-[600px] gap-1" style={{ gridTemplateColumns: `repeat(${level.width}, minmax(0, 1fr))` }} role="group" aria-label={w.map}>
      {Array.from({ length: level.width * level.height }, (_, i) => { const x = i % level.width, y = Math.floor(i / level.width), wall = level.walls.some((p) => p.x === x && p.y === y), goal = level.goals.some((p) => p.x === x && p.y === y), robot = level.robots.find((r) => r.start.x === x && r.start.y === y);
        const item = level.delivery?.items.find((i) => i.start.x === x && i.start.y === y), target = level.delivery?.targets.find((p) => p.x === x && p.y === y);
        return <button key={i} type="button" className="min-w-0 rounded border p-1 text-xs" style={{ aspectRatio: "1", background: wall ? "#4b6570" : goal ? "#b0dfc7" : "#e5f0f4", color: "#173d52" }} aria-label={`${x},${y}: ${robot ? `${w.robot} ${robot.id}` : ""} ${wall ? w.wall : goal ? w.goal : w.floor} ${item ? `${p.item} ${item.id}${level.delivery?.numbers ? ` [${item.value}]` : ""}` : ""} ${target ? `${p.delivery}${level.delivery?.numbers ? ` [${target.value}]` : ""}` : ""}`} onClick={() => paint(x, y)}>{robot ? `🤖 ${robot.id}` : wall ? "■" : goal ? "⚑" : `${x},${y}`} {item && `📦${level.delivery?.numbers ? item.value : ""}`} {target && `▧${level.delivery?.numbers ? target.value : ""}`}</button>;
      })}
    </div>
    <fieldset className="flex flex-wrap gap-3"><legend>{locale === "zh" ? "允许指令" : "Allowed commands"}</legend>{(level.delivery ? ALL_PARALLEL_COMMANDS : PARALLEL_COMMANDS).map((op) => <label key={op} className="text-xs"><input type="checkbox" checked={level.allowed.includes(op)} onChange={(e) => update({ ...level, allowed: e.target.checked ? [...level.allowed, op] : level.allowed.filter((a) => a !== op) })} /> {commandName(op)}</label>)}</fieldset>
    <ReferenceProgramRunner payload={payload} locale={locale} onChange={onChange} onVerified={onVerified} />
  </section>;
}
