"use client";

import {
  AlertTriangle,
  Bot,
  Boxes,
  Flag,
  Package,
  Warehouse,
} from "lucide-react";
import type { CSSProperties } from "react";
import {
  samePoint,
  type Level,
  type Point,
  type Status,
} from "@/lib/programming-game/engine";
import { GAME_MESSAGES } from "./messages";
import "./warehouse-board.css";

type Props = {
  level: Level;
  robot: Point;
  item: Point | null;
  holding: boolean;
  status: Status;
  locale: "en" | "zh";
};

/** Display only: coordinates and outcomes come directly from the existing engine. */
export function WarehouseBoard({
  level,
  robot,
  item,
  holding,
  status,
  locale,
}: Props) {
  const m = GAME_MESSAGES[locale];
  const boardStyle: CSSProperties = {
    width: `calc(${level.width} * var(--pg-tile) + ${level.width - 1} * 8px)`,
  };
  const robotStyle: CSSProperties = {
    transform: `translate(calc(${robot.x} * (var(--pg-tile) + 8px)), calc(${robot.y} * (var(--pg-tile) + 8px)))`,
  };
  const legend = [
    { Icon: Bot, label: m.robot, style: "pg-legend-robot" },
    { Icon: Package, label: m.parcel, style: "pg-legend-parcel" },
    { Icon: Flag, label: m.goal, style: "pg-legend-goal" },
    { Icon: Boxes, label: m.wall, style: "pg-legend-wall" },
  ];
  return (
    <div className="pg-warehouse">
      <div className="pg-warehouse-header">
        <span className="pg-warehouse-title">
          <Warehouse size={18} aria-hidden="true" />
          {m.warehouse}
        </span>
        <span className="pg-warehouse-badge">
          {m.sector} {String(level.width).padStart(2, "0")} ×{" "}
          {String(level.height).padStart(2, "0")}
        </span>
      </div>
      <div
        className="pg-warehouse-scroll"
        tabIndex={0}
        role="region"
        aria-label={m.mapScroll}
      >
        <div className="pg-warehouse-stage">
          <div className="pg-warehouse-grid" style={boardStyle}>
            <div role="table" aria-label={m.map}>
              {Array.from({ length: level.height }, (_, y) => (
                <div role="row" key={y} className="pg-warehouse-row">
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
                        className={`pg-warehouse-tile ${isWall ? "pg-tile-wall" : isGoal ? "pg-tile-goal" : ""} ${isGoal && status === "passed" ? "pg-tile-complete" : ""}`}
                      >
                        <span className="pg-tile-coordinate" aria-hidden="true">
                          {x},{y}
                        </span>
                        {isGoal ? (
                          <span className="pg-goal-marker" aria-hidden="true">
                            <Flag size={19} strokeWidth={2.5} />
                          </span>
                        ) : null}
                        {isWall ? (
                          <span className="pg-obstacle" aria-hidden="true">
                            <Boxes strokeWidth={1.8} />
                          </span>
                        ) : null}
                        {isItem ? (
                          <span
                            className={`pg-parcel ${isRobot ? "pg-parcel-shared" : ""}`}
                            aria-hidden="true"
                          >
                            <Package strokeWidth={2} />
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div
              aria-hidden="true"
              className={`pg-robot-position ${status === "error" ? "pg-robot-error" : ""}`}
              style={robotStyle}
            >
              <div className="pg-robot-shell">
                <Bot strokeWidth={1.8} />
              </div>
              {holding ? (
                <span className="pg-robot-cargo" data-testid="robot-cargo">
                  <Package size={20} />
                </span>
              ) : null}
              {status === "error" ? (
                <span className="pg-robot-alert">
                  <AlertTriangle size={16} />
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="pg-warehouse-legend" aria-label={m.legend}>
        {legend.map(({ Icon, label, style }) => (
          <span key={label} className={style}>
            <Icon size={16} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
