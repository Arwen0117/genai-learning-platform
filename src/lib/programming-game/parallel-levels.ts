import {
  PARALLEL_ACTIONS, PARALLEL_COMMANDS, parseParallelLevel, parseParallelProgram, type ParallelLevel, type ParallelProgram,
} from "./parallel-engine";

export type ParallelTemplateId = "parallel-lanes" | "parallel-queue" | "parallel-conditional-route" | "parallel-goal-guard" | "parallel-jump-route" | "parallel-turn-corner" | "parallel-boundary-check";
export type ParallelTemplate = {
  id: ParallelTemplateId;
  title: { en: string; zh: string };
  task: { en: string; zh: string };
  level: ParallelLevel;
  hints: Record<"en" | "zh", string[]>;
  /** Explicitly revealed reference answer; never applied automatically. */
  reference: ParallelProgram;
  knowledge?: Record<"en" | "zh", { title: string; body: string }[]>;
};
/** Workshop templates only; not registered in the formal course schema. */
export const PARALLEL_TEMPLATES: readonly ParallelTemplate[] = [
  {
    id: "parallel-lanes", title: { en: "One shared program", zh: "一份程序，一起出发" },
    task: { en: "Move every robot into the goal zone using the same program.", zh: "让所有机器人执行同一份程序，到达目标区域。" },
    level: {
      id: "parallel-lanes", rulesVersion: 2, width: 5, height: 3, walls: [],
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 0, y: 2 } }],
      goals: [{ x: 4, y: 0 }, { x: 4, y: 2 }], allowed: [...PARALLEL_ACTIONS, "repeat"],
    },
    hints: { en: ["Repeat four moves to the right."], zh: ["循环执行四次向右移动。"] },
    reference: [{ op: "repeat", count: 4, body: [{ op: "right" }] }],
  },
  {
    id: "parallel-queue", title: { en: "Move as a queue", zh: "一起排队前进" },
    task: { en: "Move every robot into the goal zone. A robot may enter a cell vacated in the same tick.", zh: "让所有机器人都进入目标区域。可以进入其他机器人在同一时刻成功离开的格子。" },
    level: {
      id: "parallel-queue", rulesVersion: 2, width: 4, height: 1, walls: [],
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 1, y: 0 } }],
      goals: [{ x: 2, y: 0 }, { x: 3, y: 0 }], allowed: [...PARALLEL_ACTIONS, "repeat"],
    },
    hints: { en: ["The whole queue can move together. Move right twice."], zh: ["整条队伍可以同时前进，向右两次。"] },
    reference: [{ op: "repeat", count: 2, body: [{ op: "right" }] }],
  },
  {
    id: "parallel-conditional-route",
    title: { en: "Look before you move", zh: "看环境，再出发" },
    task: { en: "Use one program to reach every goal. Robots with a wall on their right need to move up first.", zh: "用同一份程序到达所有目标。右边紧邻障碍的机器人需要先向上绕行。" },
    level: {
      id: "parallel-conditional-route", rulesVersion: 2, width: 5, height: 3,
      walls: [{ x: 1, y: 2 }],
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 0, y: 2 } }],
      goals: [{ x: 4, y: 0 }, { x: 4, y: 1 }], allowed: [...PARALLEL_ACTIONS, "repeat", "if"],
    },
    hints: { en: ["Check the right-hand wall first. Move up when blocked, then move right four times."], zh: ["先判断右边是否有障碍，有障碍就向上，再向右四次。"] },
    reference: [
      { op: "if", condition: { kind: "wall", direction: "right", not: false }, then: [{ op: "up" }], else: [] },
      { op: "repeat", count: 4, body: [{ op: "right" }] },
    ],
    knowledge: {
      en: [{ title: "Local decisions", body: "A shared program can take different branches for different robots. IF observes the world at the start of one tick; its chosen arm begins no earlier than the next tick. Compare the two robots after each world step." }],
      zh: [{ title: "局部判断与分工", body: "共享程序不代表角色永远执行同一行。IF用一个tick观察当前角色周围的环境，选中的分支最早在下一tick执行。每次世界单步后，切换机器人，比较下一条指令。" }],
    },
  },
  {
    id: "parallel-goal-guard",
    title: { en: "Stop moving on the goal", zh: "到目标后不再前进" },
    task: { en: "Repeat the same decision: move right only when not already on a goal.", zh: "重复同一个判断：尚未在目标格时才向右移动。" },
    level: {
      id: "parallel-goal-guard", rulesVersion: 2, width: 5, height: 3, walls: [],
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 2, y: 2 } }],
      goals: [{ x: 4, y: 0 }, { x: 4, y: 2 }], allowed: [...PARALLEL_ACTIONS, "repeat", "if"],
    },
    hints: { en: ["Repeat a goal check four times. Move right only if not on a goal."], zh: ["重复判断四次：不在目标格才向右，否则等待。"] },
    reference: [{ op: "repeat", count: 4, body: [{ op: "if", condition: { kind: "goal", not: true }, then: [{ op: "right" }], else: [{ op: "wait" }] }] }],
    knowledge: {
      en: [{ title: "A condition inside a loop", body: "Repeat re-evaluates IF each iteration. NOT reverses the local goal test. An empty ELSE skips work, while WAIT spends one tick; these can reach the same outcome with different timing. A robot is not finished merely because it touches a goal." }],
      zh: [{ title: "循环、条件与NOT", body: "循环每次都会重新判断环境。NOT把“在目标格”反转为“尚未在目标格”。空ELSE直接跳过，而等待会消耗一个tick，两种策略可能结果相同、耗时不同。角色经过目标格不等于程序已经结束。" }],
    },
  },
  {
    id: "parallel-jump-route",
    title: { en: "Choose a jump destination", zh: "给跳转指定目标" },
    task: { en: "Use a marker and a jump to check the goal again after each move.", zh: "放置目标标记，让机器人移动后跳回来，再判断是否到达目标。" },
    level: {
      id: "parallel-jump-route", rulesVersion: 2, width: 5, height: 3, walls: [],
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 2, y: 2 } }],
      goals: [{ x: 4, y: 0 }, { x: 4, y: 2 }], allowed: [...PARALLEL_COMMANDS].filter((op) => op !== "repeat"),
    },
    hints: { en: ["Place marker A before IF. On a goal, end; otherwise move right and jump to A."], zh: ["先放标记 A，再判断目标：到达就结束，否则向右，再跳转到 A。"] },
    reference: [
      { op: "label", id: "A" },
      { op: "if", condition: { kind: "goal", not: false }, then: [{ op: "end" }], else: [{ op: "right" }] },
      { op: "jump", target: "A" },
    ],
    knowledge: {
      en: [{ title: "Named destinations", body: "A jump returns to the chosen root marker, even after other instructions are inserted. A marker and a jump each spend one tick. Missing targets are rejected before running; a loop that never finishes stops at the execution limit." }],
      zh: [{ title: "跳转目标", body: "跳转回到所选标记，不依赖容易变化的行号。标记和跳转各用一个tick。删除目标后要重新选择；一直跳回而不结束的程序会在执行上限处停止。" }],
    },
  },
  {
    id: "parallel-turn-corner", title: { en: "Around the corner", zh: "转过弯角" },
    task: { en: "Reach the goals around the corner.", zh: "沿着各自的通道转弯，到达目标格。" },
    level: { id: "parallel-turn-corner", rulesVersion: 2, width: 5, height: 4, walls: [],
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 0, y: 2 } }],
      goals: [{ x: 4, y: 1 }, { x: 4, y: 3 }], allowed: [...PARALLEL_ACTIONS, "repeat"] },
    hints: { en: ["Move right four times, then down once."], zh: ["先向右四次，再向下一次。"] },
    reference: [{ op: "repeat", count: 4, body: [{ op: "right" }] }, { op: "down" }],
  },
  {
    id: "parallel-boundary-check", title: { en: "Read the boundary", zh: "观察边界" },
    task: { en: "Move one cell inward from either edge with the same program.", zh: "用同一份程序，让机器人从两侧边界向内移动一格。" },
    level: { id: "parallel-boundary-check", rulesVersion: 2, width: 5, height: 3, walls: [],
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 4, y: 2 } }],
      goals: [{ x: 1, y: 0 }, { x: 3, y: 2 }], allowed: [...PARALLEL_ACTIONS, "if"] },
    hints: { en: ["If the right side is a boundary, move left; otherwise move right."], zh: ["如果右侧是边界，就向左；否则向右。"] },
    reference: [{ op: "if", condition: { kind: "boundary", direction: "right", not: false }, then: [{ op: "left" }], else: [{ op: "right" }] }],
  },
];

export function getParallelTemplate(id: ParallelTemplateId): ParallelTemplate {
  const template = PARALLEL_TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error("UNKNOWN_PARALLEL_TEMPLATE");
  return {
    id: template.id, title: { ...template.title }, task: { ...template.task },
    hints: { en: [...template.hints.en], zh: [...template.hints.zh] },
    level: parseParallelLevel(template.level),
    reference: parseParallelProgram(template.reference, template.level),
    ...(template.knowledge ? { knowledge: {
      en: template.knowledge.en.map((c) => ({ ...c })), zh: template.knowledge.zh.map((c) => ({ ...c })),
    } } : {}),
  };
}

/** The same rules and reference program support one to four robots. */
export function configureParallelTemplate(id: ParallelTemplateId, count: unknown): ParallelTemplate {
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 4) throw new Error("INVALID_ROBOT_COUNT");
  const t = getParallelTemplate(id);
  const queue = id === "parallel-queue", corner = id === "parallel-turn-corner";
  t.level.width = queue ? count + 2 : 5;
  t.level.height = queue ? 1 : corner ? count * 2 : count * 2 - 1;
  t.level.walls = [];
  t.level.robots = Array.from({ length: count }, (_, i) => ({ id: String.fromCharCode(97 + i), start: {
    x: queue ? i : id === "parallel-boundary-check" ? (i % 2 ? 4 : 0) : id === "parallel-goal-guard" || id === "parallel-jump-route" ? (i % 2 ? 2 : 0) : 0,
    y: queue ? 0 : i * 2,
  } }));
  t.level.goals = t.level.robots.map((r, i) => ({ x: queue ? i + 2 : id === "parallel-boundary-check" ? (i % 2 ? 3 : 1) : 4,
    y: corner ? i * 2 + 1 : id === "parallel-conditional-route" && i % 2 ? i * 2 - 1 : r.start.y }));
  if (id === "parallel-conditional-route") t.level.walls = t.level.robots.filter((_, i) => i % 2).map((r) => ({ x: 1, y: r.start.y }));
  t.level = parseParallelLevel(t.level);
  return t;
}
