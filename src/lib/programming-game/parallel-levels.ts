import {
  PARALLEL_COMMANDS, parseParallelLevel, type ParallelLevel, type ParallelProgram,
} from "./parallel-engine";

export type ParallelTemplateId = "parallel-lanes" | "parallel-queue";
export type ParallelTemplate = {
  id: ParallelTemplateId;
  title: { en: string; zh: string };
  task: { en: string; zh: string };
  level: ParallelLevel;
  /** Validation/testing only. Never fill the student editor with a solution. */
  reference: ParallelProgram;
};
/** B1 fixtures only: not registered in course schemas or the existing UI. */
export const PARALLEL_TEMPLATES: readonly ParallelTemplate[] = [
  {
    id: "parallel-lanes", title: { en: "One program, two robots", zh: "一份程序，两个机器人" },
    task: { en: "Move both robots into the goal zone using the same program.", zh: "让两个机器人执行同一份程序，到达目标区域。" },
    level: {
      id: "parallel-lanes", rulesVersion: 2, width: 5, height: 3, walls: [],
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 0, y: 2 } }],
      goals: [{ x: 4, y: 0 }, { x: 4, y: 2 }], allowed: [...PARALLEL_COMMANDS],
    },
    reference: [{ op: "repeat", count: 4, body: [{ op: "right" }] }],
  },
  {
    id: "parallel-queue", title: { en: "Move as a queue", zh: "一起排队前进" },
    task: { en: "Move both robots into the goal zone. A robot may enter a cell vacated in the same tick.", zh: "让两个机器人都进入目标区域。可以进入其他机器人在同一时刻成功离开的格子。" },
    level: {
      id: "parallel-queue", rulesVersion: 2, width: 4, height: 1, walls: [],
      robots: [{ id: "a", start: { x: 0, y: 0 } }, { id: "b", start: { x: 1, y: 0 } }],
      goals: [{ x: 2, y: 0 }, { x: 3, y: 0 }], allowed: [...PARALLEL_COMMANDS],
    },
    reference: [{ op: "repeat", count: 2, body: [{ op: "right" }] }],
  },
];

export function getParallelTemplate(id: ParallelTemplateId): ParallelTemplate {
  const template = PARALLEL_TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error("UNKNOWN_PARALLEL_TEMPLATE");
  return {
    id: template.id, title: { ...template.title }, task: { ...template.task },
    level: parseParallelLevel(template.level),
    reference: template.reference.map((c) => c.op === "repeat"
      ? { op: "repeat", count: c.count, body: c.body.map((a) => ({ ...a })) } : { ...c }),
  };
}
