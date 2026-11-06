import { createParallelProgrammingPayload, type ParallelProgrammingPayload } from "./parallel-config";
import { ALL_PARALLEL_COMMANDS as PARALLEL_COMMANDS } from "./parallel-engine";
export function createDeliveryPayload(locale: "en" | "zh", count = 2): ParallelProgrammingPayload {
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error("INVALID_ROBOTS");
  const robots = Array.from({ length: count }, (_, i) => ({ id: String.fromCharCode(97 + i), start: { x: 0, y: i * 2 } }));
  const targets = robots.map((r) => ({ x: 4, y: r.start.y }));
  return { ...createParallelProgrammingPayload("parallel-lanes", locale, count), allowed: [...PARALLEL_COMMANDS],
    task: locale === "zh" ? "所有机器人执行同一份程序：拿起脚下物品，运到配送区并放下，最后停在目标格。" : "Use one shared program to pick up each parcel, deliver and put it down in a delivery zone, then finish on a goal.",
    hints: locale === "zh" ? ["先拿起脚下物品，每人只能携带一件。", "携带物品时可以正常移动。", "到配送区后要放下；拿着到达不算送达。"] : ["Pick up the parcel under each robot; each can hold one.", "Movement carries the parcel with the robot.", "Put it down in a delivery zone; arriving while carrying is not enough."],
    knowledge: [{ title: locale === "zh" ? "状态与前置条件" : "State and preconditions", body: locale === "zh" ? "拿起需要脚下有物品且双手为空；放下需要正在携带且当前格没有物品。所有机器人在每个tick开始时观察同一个世界快照。" : "Pick up requires an item and empty hands. Put down requires a carried item and a free item slot. All robots observe the same tick-start snapshot." }],
    customLevel: { id: "parallel-delivery", rulesVersion: 2, width: 5, height: count * 2 - 1, walls: [], robots, goals: targets, allowed: [...PARALLEL_COMMANDS], delivery: { version: 1, items: robots.map((r, i) => ({ id: `parcel${i + 1}`, start: { ...r.start } })), targets } },
    referenceProgram: [{ op: "pickup" }, { op: "repeat", count: 4, body: [{ op: "right" }] }, { op: "drop" }],
  };
}
