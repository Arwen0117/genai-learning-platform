import { TEACHING_MESSAGES, type ProgrammingTeaching } from "@/lib/programming-game/teaching";

export function ProgrammingConcepts({ teaching, locale }: { teaching?: ProgrammingTeaching; locale: "en" | "zh" }) {
  const m = TEACHING_MESSAGES[locale];
  return teaching?.concepts.trim() ? <section aria-label={m.concepts} data-programming-concepts className="min-w-0 space-y-2 rounded-xl border bg-muted/20 p-4"><h3 className="font-semibold">{m.concepts}</h3><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{teaching.concepts}</p></section> : null;
}
export function ProgrammingPseudocode({ teaching, locale }: { teaching?: ProgrammingTeaching; locale: "en" | "zh" }) {
  const m = TEACHING_MESSAGES[locale];
  return teaching?.pseudocode.trim() ? <details data-programming-pseudocode className="min-w-0 space-y-3 rounded-xl border p-4"><summary className="cursor-pointer font-semibold">{m.code}</summary><p className="text-sm text-muted-foreground">{m.sourceNote}</p><pre className="max-h-[32rem] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-sm leading-relaxed" aria-label={m.codeLabel}><code>{teaching.pseudocode}</code></pre><p className="text-xs text-muted-foreground">{m.note}</p></details> : null;
}
