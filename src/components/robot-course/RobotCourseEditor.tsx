"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/post-json";
import { robotCourseEditingSchema, type RobotCourseDraft } from "@/lib/programming-game/robot-course";
import { createParallelProgrammingPayload, parallelProgrammingEditingSchema } from "@/lib/programming-game/parallel-config";
import { CourseProgrammingForm } from "@/components/teach/editor/course-programming-form";
import { isParallelProgramming } from "@/lib/programming-game/course-config";
import { referenceSignature } from "./ReferenceProgramRunner";
import { RobotLevelDesigner } from "./RobotLevelDesigner";
import { RobotCourseScreen } from "./RobotCourseScreen";
import { ROBOT_MESSAGES } from "./messages";

type SaveResult = { ok: true; courseId: string; updatedAt: string } | { ok: false; error: string };
type HintsResult = { ok: true; hints: string[]; mock: boolean } | { ok: false; error: string };
export function RobotCourseEditor({ courseId: initialCourseId = null, initial }: { courseId?: string | null; initial: RobotCourseDraft }) {
  const { locale } = useI18n(), w = ROBOT_MESSAGES[locale];
  const [draft, setDraft] = useState(initial), [courseId, setCourseId] = useState(initialCourseId), [active, setActive] = useState(0), [busy, setBusy] = useState(false), [generating, setGenerating] = useState(false);
  const [studentPreview, setStudentPreview] = useState(false);
  const [notice, setNotice] = useState(""), [generated, setGenerated] = useState<{ hints: string[]; mock: boolean; signature: string } | null>(null);
  const signature = JSON.stringify({ lessonId: draft.levels[active].lessonId, language: draft.language, payload: draft.levels[active].payload });
  const latest = useRef(signature), savingNow = useRef(false), generatingNow = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { latest.current = signature; }, [signature]);
  const [checks, setChecks] = useState<Record<string, { signature: string; passed: boolean }>>(() => Object.fromEntries(initial.updatedAt ? initial.levels.filter((l) => l.payload.customLevel).map((l) => [l.lessonId, { signature: referenceSignature(l.payload), passed: true }]) : []));
  const level = draft.levels[active], structurallyValid = robotCourseEditingSchema.safeParse(draft).success;
  const valid = structurallyValid && draft.levels.every((l) => !l.payload.customLevel || (checks[l.lessonId]?.passed && checks[l.lessonId]?.signature === referenceSignature(l.payload)));
  const onVerified = useCallback((signature: string, passed: boolean) => setChecks((old) => old[level.lessonId]?.signature === signature && old[level.lessonId]?.passed === passed ? old : { ...old, [level.lessonId]: { signature, passed } }), [level.lessonId]);
  function changeLevel(next: typeof level) { setDraft((d) => ({ ...d, levels: d.levels.map((l, i) => i === active ? next : l) })); setNotice(""); }
  async function save() {
    if (savingNow.current || !valid) return; savingNow.current = true; setBusy(true); setNotice("");
    try {
      const result = await postJson<SaveResult>("/api/teach/robot-courses", { courseId, draft }, { timeoutMs: 30000, timeoutMessage: w.failed, failureMessage: w.failed });
      if (!mounted.current) return;
      if (!result.ok) throw new Error(result.error);
      setCourseId(result.courseId); setDraft((d) => ({ ...d, updatedAt: result.updatedAt })); setNotice(locale === "zh" ? "课程已保存" : "Course saved");
      window.history.replaceState(null, "", `/teach/programming-game/${result.courseId}`);
    } catch (e) { if (mounted.current) setNotice(e instanceof Error ? e.message : w.failed); } finally { savingNow.current = false; if (mounted.current) setBusy(false); }
  }
  async function hints() {
    if (generatingNow.current) return; generatingNow.current = true; const requestedSignature = latest.current; setGenerating(true); setGenerated(null); setNotice("");
    try {
      const result = await postJson<HintsResult>("/api/teach/programming-hints", { ...(courseId ? { courseId } : {}), locale: draft.language, payload: level.payload }, { timeoutMs: 90000, timeoutMessage: w.failed, failureMessage: w.failed });
      if (!mounted.current) return;
      if (!result.ok) throw new Error(result.error);
      if (requestedSignature !== latest.current) { setNotice(w.changed); return; }
      setGenerated({ hints: result.hints, mock: result.mock, signature: requestedSignature });
    } catch (e) { if (mounted.current) setNotice(e instanceof Error ? e.message : w.failed); } finally { generatingNow.current = false; if (mounted.current) setGenerating(false); }
  }
  return <div className="space-y-5"><h1 className="text-2xl font-semibold">{w.edit}</h1><fieldset disabled={busy} className="min-w-0 space-y-4 rounded-xl border p-4">
    <label className="block">{w.name}<input className="mt-1 block w-full rounded border bg-background p-2" aria-label={w.name} maxLength={90} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
    <label className="block">{w.description}<textarea className="mt-1 block w-full rounded border bg-background p-2" aria-label={w.description} maxLength={600} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
    <label className="flex gap-2">{w.status}<select className="rounded border bg-background p-2" aria-label={w.status} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as typeof draft.status })}><option value="DRAFT">{w.draft}</option><option value="PUBLISHED">{w.published}</option><option value="ARCHIVED">{w.archived}</option></select></label>
    <div className="flex flex-wrap items-center gap-3"><label>{w.choose}<select className="ml-2 max-w-full rounded border bg-background p-2" aria-label={w.choose} value={active} onChange={(e) => { setActive(Number(e.target.value)); setGenerated(null); }}>{draft.levels.map((l, i) => <option key={l.lessonId} value={i}>{i + 1}. {l.title}</option>)}</select></label><Button type="button" variant="outline" disabled={draft.levels.length >= 20} onClick={() => {
      setDraft({ ...draft, levels: [...draft.levels, { lessonId: crypto.randomUUID(), blockId: crypto.randomUUID(), title: `${w.choose} ${draft.levels.length + 1}`, payload: createParallelProgrammingPayload("parallel-lanes", draft.language) }] }); setActive(draft.levels.length); setGenerated(null);
    }}>{w.add}</Button></div>
    <label className="block">{w.levelName}<input className="mt-1 block w-full rounded border bg-background p-2" aria-label={w.levelName} maxLength={120} value={level.title} onChange={(e) => changeLevel({ ...level, title: e.target.value })} /></label>
    <details className="rounded border p-3"><summary className="cursor-pointer">{w.settings}</summary><div className="mt-3"><CourseProgrammingForm payload={level.payload} onChange={(payload) => { if (isParallelProgramming(payload)) changeLevel({ ...level, payload }); }} onPreset={(payload, title) => { if (isParallelProgramming(payload)) changeLevel({ ...level, payload, title }); }} /></div></details>
    <div className="flex flex-wrap gap-2" role="group" aria-label={locale === "zh" ? "编辑视图" : "Editor view"}>
      <Button type="button" variant={!studentPreview ? "default" : "outline"} aria-pressed={!studentPreview} onClick={() => setStudentPreview(false)}>{locale === "zh" ? "地图与参考答案" : "Map and reference answer"}</Button>
      <Button type="button" variant={studentPreview ? "default" : "outline"} aria-pressed={studentPreview} onClick={() => setStudentPreview(true)}>{w.preview}</Button>
    </div>
    {!studentPreview && <RobotLevelDesigner key={level.lessonId} payload={level.payload} locale={locale} onVerified={onVerified} onChange={(payload) => changeLevel({ ...level, payload })} />}
    <div className="flex flex-wrap gap-3"><Button type="button" disabled={generating || !parallelProgrammingEditingSchema.safeParse(level.payload).success} variant="outline" onClick={() => void hints()}>{generating ? w.generating : w.ai}</Button><Button type="button" disabled={!valid || busy} onClick={() => void save()}>{busy ? w.saving : w.save}</Button>{courseId && <a className="self-center underline" href={`/play/programming/${courseId}?preview=1`}>{w.play}</a>}</div>
    {generated && <div className="space-y-2 rounded border p-3">{generated.mock && <p>{w.mock}</p>}<ol className="list-decimal pl-5">{generated.hints.map((h, i) => <li key={i}>{h}</li>)}</ol><Button type="button" variant="outline" disabled={generated.signature !== signature} onClick={() => { changeLevel({ ...level, payload: { ...level.payload, hints: generated.hints } }); setGenerated(null); }}>{w.apply}</Button></div>}
    {level.payload.customLevel && <p role="status" className="text-sm">{checks[level.lessonId]?.signature === referenceSignature(level.payload) ? checks[level.lessonId]?.passed ? w.valid : w.referenceFailed : w.pending}</p>}
    <p role="status" className="text-sm">{notice}</p>
  </fieldset>
    {studentPreview && <section><h2 className="text-xl font-semibold">{w.preview}</h2><p className="text-sm text-muted-foreground">{w.unsaved}</p>
    {structurallyValid ? <RobotCourseScreen key={`${active}:${JSON.stringify(draft.levels)}`} title={draft.title} levels={draft.levels} preview initialLessonId={level.lessonId} onLevelChange={(lessonId) => setActive(draft.levels.findIndex((l) => l.lessonId === lessonId))} /> : <p role="alert">{w.invalid}</p>}</section>}
  </div>;
}
