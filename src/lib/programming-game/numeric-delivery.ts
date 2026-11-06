import { createDeliveryPayload } from "./delivery-level";
import type { ParallelProgrammingPayload } from "./parallel-config";
/** Optional numeric capability: item values are immutable, destinations match exactly. */
export function createNumericDeliveryPayload(locale: "en" | "zh"): ParallelProgrammingPayload {
  const base = createDeliveryPayload(locale);
  const allowed = [...base.allowed];
  return { ...base,
    task: locale === "zh" ? "所有机器人执行同一份程序：拾取物品。数值小于5的送往左边，相反送往右边，放到相同数值的配送区后结束。" : "Use one shared program. Pick up each parcel: values below 5 go left, other values go right. Put each parcel in a zone with the same value and finish on a goal.",
    hints: locale === "zh" ? ["先拾取，才能比较手中物品的数值。", "用“手中数值 < 5”分成两条路线。", "两边各走两格，最后放下物品。"] : ["Pick up first to compare the carried value.", "Branch on Carried value < 5.", "Move two cells to either side, then put the parcel down."],
    knowledge: [{ title: locale === "zh" ? "数值与分支" : "Values and branching", body: locale === "zh" ? "物品数值在运行中不会改变。没有物品时比较不成立，0是有效数值。机器人同时运行同一份程序，但可根据各自手中的数值选择不同分支。配送区只接收相同数值。" : "Parcel values never change during a run. Comparisons are false without a parcel; zero is a valid value. Robots share one program and branch using their own carried values. Delivery zones accept the same value only." }],
    customLevel: { id: "parallel-numeric-sorting", rulesVersion: 2, width: 5, height: 3, walls: [], robots: [{ id: "a", start: { x: 2, y: 0 } }, { id: "b", start: { x: 2, y: 2 } }], goals: [{ x: 0, y: 0 }, { x: 4, y: 2 }], allowed,
      delivery: { version: 1, numbers: { version: 1 }, items: [{ id: "parcel1", start: { x: 2, y: 0 }, value: 3 }, { id: "parcel2", start: { x: 2, y: 2 }, value: 8 }], targets: [{ x: 0, y: 0, value: 3 }, { x: 4, y: 2, value: 8 }] } },
    referenceProgram: [{ op: "pickup" }, { op: "if", condition: { kind: "value", source: "holding", operator: "lt", value: 5, not: false }, then: [{ op: "left" }, { op: "left" }], else: [{ op: "right" }, { op: "right" }] }, { op: "drop" }],
  };
}
