"use client";
import { useCallback } from "react";
import { parseParallelLevel } from "@/lib/programming-game/parallel-engine";
import type { ParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
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
  let level;
  try { level = parseParallelLevel(payload.customLevel); }
  catch { return <p role="alert">{locale === "zh" ? "地图尚不合法：请检查起点、目标、障碍和机器人是否重叠。" : "Check the map starts, goals, walls and overlapping robots before running."}</p>; }
  return <section aria-label={w.verify} className="space-y-3">
    <p className="text-sm">{w.manualNote}</p>
    <ParallelProgrammingGame course level={level} title={w.verify} task="" locale={locale} initialProgram={payload.referenceProgram ?? []}
      onProgramChange={(referenceProgram) => onChange({ ...payload, referenceProgram })} onValidationResult={result} />
  </section>;
}
