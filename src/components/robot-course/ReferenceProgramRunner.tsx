"use client";
import { useCallback } from "react";
import { parseParallelLevel } from "@/lib/programming-game/parallel-engine";
import { parallelProgrammingTeaching, type ParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
import { ParallelProgrammingGame } from "@/components/blocks/programming-game/ParallelProgrammingGame";
import { ROBOT_MESSAGES } from "./messages";
export function referenceSignature(payload: ParallelProgrammingPayload) {
  return JSON.stringify({ level: payload.customLevel, program: payload.referenceProgram, allowed: payload.allowed, robots: payload.robotCount });
}
export function ReferenceProgramRunner({ payload, locale, onChange, onVerified }: {
  payload: ParallelProgrammingPayload; locale: "en" | "zh";
  onChange: (p: ParallelProgrammingPayload) => void; onVerified: (signature: string, passed: boolean) => void;
}) {
  const signature = referenceSignature(payload), w = ROBOT_MESSAGES[locale];
  const result = useCallback((passed: boolean) => onVerified(signature, passed), [signature, onVerified]);
  let level; let teaching;
  try { level = parseParallelLevel(payload.customLevel); }
  catch { return <p role="alert">{locale === "zh" ? "地图尚不合法：请检查起点、目标、障碍、物品与配送区；物品和配送区数量不能为零或超出上限。数值须为-99到99的整数，每件物品须有相同数值的配送区。" : "Check starts, goals, walls, parcels and delivery zones before running; parcels and zones must not be empty or out of range. Values must be integers from -99 to 99 with a matching zone for every parcel."}</p>; }
  try { teaching = parallelProgrammingTeaching(payload, locale); } catch { /* The reference editor can contain an incomplete program. */ }
  return <section aria-label={w.verify} className="space-y-3">
    <p className="text-sm">{w.manualNote}</p>
    <ParallelProgrammingGame course teaching={teaching} level={level} title={w.verify} task="" locale={locale} initialProgram={payload.referenceProgram ?? []}
      onProgramChange={(referenceProgram) => onChange({ ...payload, referenceProgram })} onValidationResult={result} />
  </section>;
}
