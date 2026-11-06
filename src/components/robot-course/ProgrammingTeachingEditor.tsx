"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/post-json";
import { parallelProgrammingEditingSchema, parallelProgrammingTeaching, type ParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
import { PROGRAMMING_TEACHING_LIMITS, TEACHING_MESSAGES, type ProgrammingTeaching } from "@/lib/programming-game/teaching";

type Result = { ok: true; teaching: ProgrammingTeaching; mock: boolean } | { ok: false; error: string };
export function ProgrammingTeachingEditor({ payload, onChange, locale, courseId }: { payload: ParallelProgrammingPayload; onChange: (p: ParallelProgrammingPayload) => void; locale: "en" | "zh"; courseId?: string | null }) {
  const m = TEACHING_MESSAGES[locale], signature = JSON.stringify({ payload, locale, courseId });
  const latest = useRef(signature), pending = useRef(false), mounted = useRef(true);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [generated, setGenerated] = useState<{ teaching: ProgrammingTeaching; mock: boolean; signature: string } | null>(null);
  useEffect(() => { latest.current = signature; }, [signature]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const valid = parallelProgrammingEditingSchema.safeParse(payload).success;
  let teaching = payload.teaching ?? { version: 1 as const, concepts: "", pseudocode: "" };
  try { teaching = parallelProgrammingTeaching(payload, locale); } catch { /* Invalid program drafts remain editable. */ }
  function change(field: "concepts" | "pseudocode", value: string) {
    setNotice(""); onChange({ ...payload, teaching: { ...teaching, [field]: value } });
  }
  async function generate() {
    if (pending.current || !valid) return;
    pending.current = true; setBusy(true); setNotice(""); setGenerated(null);
    const requested = signature;
    try {
      const result = await postJson<Result>("/api/teach/programming-teaching", { ...(courseId ? { courseId } : {}), locale, payload }, { timeoutMs: 90000, timeoutMessage: m.failed, failureMessage: m.failed });
      if (!mounted.current) return;
      if (requested !== latest.current) { setNotice(m.changed); return; }
      if (!result.ok) throw new Error(result.error);
      setGenerated({ teaching: result.teaching, mock: result.mock, signature: requested });
    } catch (e) { if (mounted.current) setNotice(e instanceof Error ? e.message : m.failed); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="min-w-0 space-y-3 rounded-xl border p-4" aria-label={m.edit} data-teaching-editor>
    <h3 className="font-semibold">{m.edit}</h3><p className="text-xs text-muted-foreground">{m.guidance}</p>
    <label className="block space-y-1 text-sm"><span>{m.concepts}</span><textarea className="block w-full rounded border bg-background p-2" rows={5} aria-label={m.concepts} maxLength={PROGRAMMING_TEACHING_LIMITS.concepts} value={teaching.concepts} onChange={(e) => change("concepts", e.target.value)} /></label>
    <label className="block space-y-1 text-sm"><span>{m.codeLabel}</span><textarea className="block w-full rounded border bg-background p-2 font-mono" rows={8} spellCheck={false} aria-label={m.codeLabel} maxLength={PROGRAMMING_TEACHING_LIMITS.pseudocode} value={teaching.pseudocode} onChange={(e) => change("pseudocode", e.target.value)} /></label>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy || !valid} onClick={() => void generate()}>{busy ? m.generating : m.generate}</Button><Button type="button" variant="outline" disabled={!valid} onClick={() => { const next = { ...payload }; delete next.teaching; onChange(next); setGenerated(null); setNotice(""); }}>{m.reset}</Button></div>
    {!valid && <p className="text-sm text-muted-foreground">{m.invalid}</p>}
    {generated && <section className="min-w-0 space-y-2 rounded-lg border bg-muted/20 p-3" aria-label={m.draft}>
      <h4 className="font-medium">{m.draft}</h4>{generated.mock && <p className="text-sm">{m.mock}</p>}
      <p className="whitespace-pre-wrap break-words text-sm">{generated.teaching.concepts}</p><pre className="max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-words text-xs">{generated.teaching.pseudocode}</pre>
      {generated.signature !== signature && <p role="status" className="text-sm">{m.changed}</p>}
      <Button type="button" variant="outline" disabled={generated.signature !== signature} onClick={() => { if (generated.signature !== latest.current) return; onChange({ ...payload, teaching: generated.teaching }); setGenerated(null); setNotice(""); }}>{m.apply}</Button>
    </section>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </section>;
}
