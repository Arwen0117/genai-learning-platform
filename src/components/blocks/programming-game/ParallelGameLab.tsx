"use client";
import { useState } from "react";
import { configureParallelTemplate, PARALLEL_TEMPLATES, type ParallelTemplateId } from "@/lib/programming-game/parallel-levels";
import { createWorkshopSettings, parseWorkshopSettings, type WorkshopSettings } from "@/lib/programming-game/workshop-settings";
import { ParallelProgrammingGame } from "./ParallelProgrammingGame";
import { WORKSHOP_MESSAGES } from "./workshop-messages";
import { KnowledgeEditor } from "./KnowledgeEditor";
import { Button } from "@/components/ui/button";
const ORDER: ParallelTemplateId[] = ["parallel-lanes", "parallel-turn-corner", "parallel-queue", "parallel-conditional-route", "parallel-boundary-check", "parallel-goal-guard", "parallel-jump-route"];
export function ParallelGameLab({ locale, teacherId = "local" }: { locale: "en" | "zh"; teacherId?: string }) {
  const [id, setId] = useState<ParallelTemplateId>("parallel-lanes");
  const [drafts, setDrafts] = useState<Partial<Record<ParallelTemplateId, WorkshopSettings>>>({});
  const [notice, setNotice] = useState("");
  const settings = drafts[id] ?? createWorkshopSettings(id, locale);
  const template = configureParallelTemplate(id, settings.robotCount);
  const w = WORKSHOP_MESSAGES[locale]; const index = ORDER.indexOf(id);
  function update(change: Partial<WorkshopSettings>) { setNotice(""); setDrafts((old) => ({ ...old, [id]: { ...settings, ...change } })); }
  function storage(load: boolean) {
    try {
      const key = `programming-workshop:v2:${encodeURIComponent(teacherId)}:${id}:${locale}`;
      if (load) { const s = parseWorkshopSettings(JSON.parse(localStorage.getItem(key) ?? "null"), id, locale); update(s); setNotice(w.loaded); }
      else { localStorage.setItem(key, JSON.stringify(parseWorkshopSettings(settings, id, locale))); setNotice(w.saved); }
    } catch { setNotice(w.invalid); }
  }
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center gap-4"><label className="flex flex-wrap items-center gap-3 text-sm">{w.choose}
      <select className="h-10 max-w-full rounded-lg border bg-background px-2" value={id} aria-label={w.choose} onChange={(e) => { setId(e.target.value as ParallelTemplateId); setNotice(""); }}>
        {ORDER.map((key, i) => <option key={key} value={key}>{i + 1}. {PARALLEL_TEMPLATES.find((t) => t.id === key)!.title[locale]}</option>)}
      </select></label><span className="text-sm">{w.progress} {index + 1} / {ORDER.length}</span></div>
    <ParallelProgrammingGame key={id} level={template.level} title={template.title[locale]} task={settings.task} locale={locale} hints={settings.hints} reference={template.reference} onNext={index < ORDER.length - 1 ? () => { setId(ORDER[index + 1]); setNotice(""); } : undefined} />
    {settings.knowledge.length > 0 && <section aria-label={w.knowledge} className="space-y-2">{settings.knowledge.map((c, i) => <details key={i} className="rounded-lg border p-3"><summary>{c.title}</summary><p className="whitespace-pre-wrap text-sm">{c.body}</p></details>)}</section>}
    <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">{w.settings}</summary><div className="mt-4 space-y-3"><p className="text-sm text-muted-foreground">{w.local}</p>
      <label className="flex items-center gap-3">{w.count}<select className="rounded border bg-background p-2" aria-label={w.count} value={settings.robotCount} onChange={(e) => update({ robotCount: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <label className="block">{w.task}<textarea className="mt-1 block w-full rounded border bg-background p-2" aria-label={w.task} maxLength={2000} value={settings.task} onChange={(e) => update({ task: e.target.value })} /></label>
      <label className="block">{w.hintEdit}<textarea className="mt-1 block w-full rounded border bg-background p-2" aria-label={w.hintEdit} maxLength={24000} value={settings.hints.join("\n")} onChange={(e) => update({ hints: e.target.value.split("\n") })} /></label>
      <KnowledgeEditor mode="embedded" cards={settings.knowledge} onChange={(knowledge) => update({ knowledge })} locale={locale} />
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => storage(false)}>{w.save}</Button><Button type="button" variant="outline" onClick={() => storage(true)}>{w.load}</Button></div><p role="status">{notice}</p>
    </div></details>
  </div>;
}
