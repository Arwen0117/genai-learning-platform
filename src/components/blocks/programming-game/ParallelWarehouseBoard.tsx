"use client";

import { AlertTriangle, Bot, Boxes, Flag, Warehouse } from "lucide-react";
import type { CSSProperties } from "react";
import type { ParallelItem, ParallelLevel, ParallelRobot } from "@/lib/programming-game/parallel-engine";
import { GAME_MESSAGES } from "./messages";
import { PARALLEL_MESSAGES } from "./parallel-messages";
import "./warehouse-board.css";
import "./parallel-board.css";

export function ParallelWarehouseBoard({ level, robots, selectedId, onSelect, passed, locale, items = [] }: {
  level: ParallelLevel; robots: ParallelRobot[]; selectedId: string;
  onSelect: (id: string) => void; passed: boolean; locale: "en" | "zh"; items?: ParallelItem[];
}) {
  const m = GAME_MESSAGES[locale]; const p = PARALLEL_MESSAGES[locale];
  const same = (a: { x: number; y: number }, x: number, y: number) => a.x === x && a.y === y;
  return (
    <div className="pg-warehouse pg-parallel" data-dense={level.width > 8 || level.height > 8 ? "true" : undefined} style={{ "--pg-cols": level.width, "--pg-rows": level.height } as CSSProperties}>
      <div className="pg-warehouse-header">
        <span className="pg-warehouse-title"><Warehouse size={18} aria-hidden="true" />{m.warehouse}</span>
        <span className="pg-warehouse-badge">v2 · {level.width} × {level.height}</span>
      </div>
      <div className="pg-warehouse-scroll" tabIndex={0} role="region" aria-label={m.mapScroll}>
        <div className="pg-warehouse-stage">
          <div className="pg-warehouse-grid" style={{ width: `calc(${level.width} * var(--pg-tile) + ${level.width - 1} * 8px)` }}>
            <div role="table" aria-label={m.map}>
              {Array.from({ length: level.height }, (_, y) => (
                <div role="row" key={y} className="pg-warehouse-row">
                  {Array.from({ length: level.width }, (_, x) => {
                    const robot = robots.find((r) => same(r.position, x, y));
                    const goal = level.goals.some((g) => same(g, x, y));
                    const wall = level.walls.some((g) => same(g, x, y));
                    const item = items.find((i) => i.position && same(i.position, x, y));
                    const target = level.delivery?.targets.some((g) => same(g, x, y));
                    const labels = [item && `${p.item} ${item.id}`, target && p.delivery, robot && `${m.robot} ${robot.id}: ${p.robotStatus[robot.status]}`, goal && m.goal, wall && m.wall].filter(Boolean);
                    return <div role="cell" key={x} aria-label={`${x},${y}: ${labels.join(", ") || m.emptyCell}`}
                      className={`pg-warehouse-tile ${wall ? "pg-tile-wall" : goal ? "pg-tile-goal" : ""} ${goal && passed ? "pg-tile-complete" : ""}`}>
                      <span className="pg-tile-coordinate" aria-hidden="true">{x},{y}</span>
                      {target && <span className="pg-delivery-marker" aria-hidden="true">▧</span>}
                      {item && <span className="pg-item-marker" aria-hidden="true">📦</span>}
                      {goal && <span className="pg-goal-marker" aria-hidden="true"><Flag size={19} /></span>}
                      {wall && <span className="pg-obstacle" aria-hidden="true"><Boxes /></span>}
                    </div>;
                  })}
                </div>
              ))}
            </div>
            {robots.map((robot, index) => {
              const style: CSSProperties = { transform: `translate(calc(${robot.position.x} * (var(--pg-tile) + 8px)), calc(${robot.position.y} * (var(--pg-tile) + 8px)))` };
              return <button type="button" key={robot.id} style={style} onClick={() => onSelect(robot.id)}
                className={`pg-robot-position pg-parallel-robot ${robot.error ? "pg-robot-error" : ""}`}
                data-tone={index % 4} data-status={robot.status} aria-pressed={selectedId === robot.id}
                aria-label={`${p.select} ${robot.id} (${robot.position.x},${robot.position.y}): ${p.robotStatus[robot.status]}`}>
                <span className="pg-robot-shell" aria-hidden="true"><Bot /></span>
                <span className="pg-parallel-id" aria-hidden="true">{robot.id}</span>
                {robot.holding && <span className="pg-cargo-marker" aria-label={`${p.holding}: ${robot.holding}`}>📦</span>}
                {robot.error && <span className="pg-robot-alert" aria-hidden="true"><AlertTriangle size={16} /></span>}
              </button>;
            })}
          </div>
        </div>
      </div>
      <div className="pg-warehouse-legend" aria-label={m.legend}>
        <span className="pg-legend-robot"><Bot size={16} aria-hidden="true" />{m.robot} · ID</span>
        <span className="pg-legend-goal"><Flag size={16} aria-hidden="true" />{m.goal}</span>
        {level.delivery && <><span>📦 {p.item}</span><span>▧ {p.delivery}</span></>}
        <span className="pg-legend-wall"><Boxes size={16} aria-hidden="true" />{m.wall}</span>
      </div>
    </div>
  );
}
