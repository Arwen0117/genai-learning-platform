"use client";
import { useCallback, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { ParallelProgrammingActivity } from "@/components/blocks/programming-game/ParallelProgrammingActivity";
import { AttemptHistory } from "@/components/blocks/attempt-history";
import type { RobotCourseDraft } from "@/lib/programming-game/robot-course";
import { ROBOT_MESSAGES } from "./messages";
export type RobotCourseLevel = RobotCourseDraft["levels"][number] & { completed?: boolean };
export function RobotCourseScreen({ title, levels, preview, initialLessonId, onLevelChange }: { title: string; levels: RobotCourseLevel[]; preview: boolean; initialLessonId?: string; onLevelChange?: (lessonId: string) => void }) {
  const { locale } = useI18n(), w = ROBOT_MESSAGES[locale];
  const [index, setIndex] = useState(() => Math.max(0, levels.findIndex((l) => l.lessonId === initialLessonId)));
  const [passed, setPassed] = useState<string[]>(() => preview ? [] : levels.filter((l) => l.completed).map((l) => l.lessonId));
  const root = useRef<HTMLDivElement>(null);
  const level = levels[index] ?? levels[0];
  function navigate(next: number) {
    if (!levels[next]) return;
    setIndex(next);
    onLevelChange?.(levels[next].lessonId);
    root.current?.scrollIntoView({ block: "start", behavior: "instant" });
    if (!preview) {
      const url = new URL(window.location.href); url.searchParams.set("level", levels[next].lessonId);
      window.history.replaceState(null, "", url);
    }
  }
  const onPassed = useCallback(() => setPassed((old) => old.includes(level.lessonId) ? old : [...old, level.lessonId]), [level.lessonId]);
  return <div ref={root} className="space-y-4 scroll-mt-20" data-robot-course-screen><header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">{title}</h1><label className="flex items-center gap-2 text-sm">{w.choose}<select className="max-w-full rounded border bg-background p-2" aria-label={w.choose} value={level.lessonId} onChange={(e) => navigate(levels.findIndex((l) => l.lessonId === e.target.value))}>{levels.map((l, i) => <option key={l.lessonId} value={l.lessonId}>{i + 1}. {l.title}{l.payload.tutorial ? (locale === "zh" ? " · 教学关" : " · Tutorial") : ""}{passed.includes(l.lessonId) ? " ✓" : ""}</option>)}</select><span>{index + 1}/{levels.length}</span></label></header>
    <ParallelProgrammingActivity key={`game:${level.lessonId}`} payload={level.payload} title={level.title} lessonId={level.lessonId} blockId={level.blockId} preview={preview} onPassed={onPassed} />
    <div className="pg-level-footer"><span>{passed.includes(level.lessonId) ? index === levels.length - 1 ? w.complete : w.passed : w.unlock}</span>{index < levels.length - 1 && <Button type="button" disabled={!passed.includes(level.lessonId)} onClick={() => navigate(index + 1)}>{w.next}</Button>}</div>
    {!preview && <AttemptHistory key={`history:${level.lessonId}`} lessonId={level.lessonId} blockId={level.blockId} />}
  </div>;
}
