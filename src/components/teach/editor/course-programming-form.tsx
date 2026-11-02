"use client";
import { useId } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { KnowledgeEditor } from "@/components/blocks/programming-game/KnowledgeEditor";
import { LegacyProgrammingForm } from "./programming-form";
import { isParallelProgramming, type CourseProgrammingPayload } from "@/lib/programming-game/course-config";
import { createParallelProgrammingPayload, parallelProgrammingEditingSchema } from "@/lib/programming-game/parallel-config";
import { getParallelTemplate, PARALLEL_TEMPLATES, type ParallelTemplateId } from "@/lib/programming-game/parallel-levels";
import { GAME_MESSAGES } from "@/components/blocks/programming-game/messages";
import { PARALLEL_MESSAGES } from "@/components/blocks/programming-game/parallel-messages";
import { WORKSHOP_MESSAGES } from "@/components/blocks/programming-game/workshop-messages";

export function CourseProgrammingForm({ payload, onChange, onPreset }: {
  payload: CourseProgrammingPayload; onChange: (p: CourseProgrammingPayload) => void;
  onPreset: (p: CourseProgrammingPayload, title: string) => void;
}) {
  const { locale } = useI18n(); const id = useId(), m = GAME_MESSAGES[locale], p = PARALLEL_MESSAGES[locale], w = WORKSHOP_MESSAGES[locale];
  if (!isParallelProgramming(payload)) return <div className="space-y-3">
    <p className="text-sm">{locale === "zh" ? "此活动保留旧版规则。转换将替换关卡配置，请先保存需要的教学内容。" : "This activity uses legacy rules. Converting replaces its configuration; save any teaching text you need first."}</p>
    <Button type="button" variant="outline" onClick={() => onPreset(createParallelProgrammingPayload("parallel-lanes", locale), getParallelTemplate("parallel-lanes").title[locale])}>{locale === "zh" ? "转换为统一机器人关卡" : "Convert to unified robot level"}</Button>
    <LegacyProgrammingForm payload={payload} onChange={onChange} onPreset={onPreset} />
  </div>;
  const valid = parallelProgrammingEditingSchema.safeParse(payload).success;
  const preset = getParallelTemplate(payload.templateId);
  const name = (op: typeof payload.allowed[number]) => op === "if" ? p.if : op === "repeat" ? m.repeat : op === "label" ? p.label : op === "jump" ? p.jump : op === "wait" ? p.wait : op === "end" ? p.end : m.actions[op];
  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">{locale === "zh" ? "统一机器人规则 v2 · 模板修订 1；预览不保存学生成绩。" : "Unified rules v2 · template revision 1. Preview does not save student grades."}</p>
    <label className="block text-sm">{w.choose}<select className="mt-1 block w-full rounded border bg-background p-2" aria-label={w.choose} value={payload.templateId} onChange={(e) => {
      const key = e.target.value as ParallelTemplateId; onPreset(createParallelProgrammingPayload(key, locale, payload.robotCount), getParallelTemplate(key).title[locale]);
    }}>{PARALLEL_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.title[locale]}</option>)}</select></label>
    {!payload.customLevel && <label className="flex items-center gap-3 text-sm">{w.count}<select className="rounded border bg-background p-2" aria-label={w.count} value={payload.robotCount} onChange={(e) => onChange({ ...payload, robotCount: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
    <label className="block text-sm" htmlFor={`${id}-task`}>{m.taskLabel}</label><textarea id={`${id}-task`} className="w-full rounded border bg-background p-2" rows={3} maxLength={4000} value={payload.task} onChange={(e) => onChange({ ...payload, task: e.target.value })} />
    {!payload.customLevel && <fieldset className="flex flex-wrap gap-3 rounded border p-3"><legend>{m.allowedLabel}</legend>{preset.level.allowed.map((op) => <label className="flex items-center gap-1 text-sm" key={op}><input type="checkbox" checked={payload.allowed.includes(op)} onChange={(e) => onChange({ ...payload, allowed: e.target.checked ? [...payload.allowed, op] : payload.allowed.filter((a) => a !== op) })} />{name(op)}</label>)}</fieldset>}
    {!valid && <p role="alert" className="text-sm text-destructive">{payload.customLevel ? (locale === "zh" ? "自定义地图或参考程序的结构无效，请到下方验证区检查。" : "The custom map or reference program has an invalid structure. Check the verification area below.") : m.allowedInvalid}</p>}
    <label className="block text-sm" htmlFor={`${id}-hints`}>{m.hintsLabel}</label><textarea id={`${id}-hints`} className="w-full rounded border bg-background p-2" rows={3} maxLength={24000} value={payload.hints.join("\n")} onChange={(e) => onChange({ ...payload, hints: e.target.value.split("\n") })} />
    <KnowledgeEditor mode="course" cards={payload.knowledge} onChange={(knowledge) => onChange({ ...payload, knowledge })} locale={locale} />
  </div>;
}
