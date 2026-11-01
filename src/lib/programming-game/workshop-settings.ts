import { getParallelTemplate, type ParallelTemplateId } from "./parallel-levels";
export type WorkshopSettings = { version: 1; templateId: ParallelTemplateId; locale: "en" | "zh"; robotCount: number; task: string; hints: string[]; knowledge: { title: string; body: string }[] };
export function createWorkshopSettings(templateId: ParallelTemplateId, locale: "en" | "zh"): WorkshopSettings {
  const t = getParallelTemplate(templateId);
  return { version: 1, templateId, locale, robotCount: 2, task: t.task[locale], hints: t.hints[locale], knowledge: t.knowledge?.[locale] ?? [] };
}
export function parseWorkshopSettings(value: unknown, templateId: ParallelTemplateId, locale: "en" | "zh"): WorkshopSettings {
  const s = value as WorkshopSettings;
  const text = (x: unknown, max: number) => typeof x === "string" && x.trim().length > 0 && x.length <= max;
  if (!s || s.version !== 1 || s.templateId !== templateId || s.locale !== locale || !Number.isInteger(s.robotCount) || s.robotCount < 1 || s.robotCount > 4 || !text(s.task, 2000)
    || !Array.isArray(s.hints) || s.hints.length > 12 || !s.hints.every((h) => text(h, 2000))
    || !Array.isArray(s.knowledge) || s.knowledge.length > 12 || !s.knowledge.every((c) => c && text(c.title, 120) && text(c.body, 4000))) throw new Error("INVALID_WORKSHOP_SETTINGS");
  return { ...s, hints: [...s.hints], knowledge: s.knowledge.map((c) => ({ ...c })) };
}
