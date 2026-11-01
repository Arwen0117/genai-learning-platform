import {
  ACTIONS,
  executeProgram,
  parseLevel,
  type Level,
  type Program,
} from "./engine";

export type TemplateId = "first-route" | "parcel-delivery" | "repeat-route";
export type LevelTemplate = {
  id: TemplateId;
  title: { en: string; zh: string };
  task: { en: string; zh: string };
  level: Level;
  /** Teacher validation only. Never fill the learner editor with this answer. */
  reference: Program;
};
export const TEMPLATES: readonly LevelTemplate[] = [
  {
    id: "first-route",
    title: { en: "Your first route", zh: "第一条路线" },
    task: {
      en: "Program the robot to reach the goal.",
      zh: "编排指令，让机器人到达目标格。",
    },
    level: {
      id: "first-route",
      rulesVersion: 1,
      width: 3,
      height: 2,
      start: { x: 0, y: 0 },
      walls: [{ x: 0, y: 1 }],
      item: null,
      goal: { kind: "reach", at: { x: 2, y: 1 }, requireLoop: false },
      allowed: ["up", "down", "left", "right"],
    },
    reference: [{ op: "right" }, { op: "right" }, { op: "down" }],
  },
  {
    id: "parcel-delivery",
    title: { en: "Deliver a parcel", zh: "配送物品" },
    task: {
      en: "Pick up the parcel and put it on the goal.",
      zh: "拾取物品并将它放到目标格。",
    },
    level: {
      id: "parcel-delivery",
      rulesVersion: 1,
      width: 3,
      height: 3,
      start: { x: 0, y: 0 },
      walls: [{ x: 2, y: 1 }],
      item: { x: 1, y: 0 },
      goal: { kind: "deliver", at: { x: 1, y: 2 }, requireLoop: false },
      allowed: [...ACTIONS],
    },
    reference: [
      { op: "right" },
      { op: "pickup" },
      { op: "down" },
      { op: "down" },
      { op: "drop" },
    ],
  },
  {
    id: "repeat-route",
    title: { en: "Use a loop", zh: "使用循环" },
    task: {
      en: "Reach the goal using a repeat instruction.",
      zh: "使用循环指令到达目标格。",
    },
    level: {
      id: "repeat-route",
      rulesVersion: 1,
      width: 5,
      height: 1,
      start: { x: 0, y: 0 },
      walls: [],
      item: null,
      goal: { kind: "reach", at: { x: 4, y: 0 }, requireLoop: true },
      allowed: ["up", "down", "left", "right", "repeat"],
    },
    reference: [{ op: "repeat", count: 4, body: [{ op: "right" }] }],
  },
];

/** Returns independent data so an editor cannot mutate the shared defaults. */
export function getTemplate(id: TemplateId): LevelTemplate {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error("UNKNOWN_TEMPLATE");
  return JSON.parse(JSON.stringify(template)) as LevelTemplate;
}

/** Conservative template check, not a general proof of solvability.
 * Other solutions may exist even when the reference uses a forbidden action.
 */
export function validateTemplateAllowed(
  id: TemplateId,
  allowed: unknown,
): Level {
  const template = getTemplate(id);
  const level = parseLevel({ ...template.level, allowed });
  if (executeProgram(level, template.reference).status !== "passed")
    throw new Error("REFERENCE_SOLUTION_UNAVAILABLE");
  return level;
}
