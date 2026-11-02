"use client";
import { useCallback, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { ParallelProgrammingActivity } from "@/components/blocks/programming-game/ParallelProgrammingActivity";
import { AttemptHistory } from "@/components/blocks/attempt-history";
import type { RobotCourseDraft } from "@/lib/programming-game/robot-course";
import { ROBOT_MESSAGES } from "./messages";
export type RobotCourseLevel = RobotCourseDraft["levels"][number] & { completed?: boolean };
export function RobotCourseScreen({ title, levels, preview, initialLessonId }: { title: string; levels: RobotCourseLevel[]; preview: boolean; initialLessonId?: string }) {
  const { locale } = useI18n(), w = ROBOT_MESSAGES[locale];
  const [index, setIndex] = useState(() => Math.max(0, levels.findIndex((l) => l.lessonId === initialLessonId)));
  const [passed, setPassed] = useState<string[]>(() => preview ? [] : levels.filter((l) => l.completed).map((l) => l.lessonId));
  const level = levels[index] ?? levels[0];
  function navigate(next: number) {
    if (!levels[next]) return;
    setIndex(next);
    if (!preview) {
      const url = new URL(window.location.href); url.searchParams.set("level", levels[next].lessonId);
      window.history.replaceState(null, "", url);
    }
  }
  const onPassed = useCallback(() => setPassed((old) => old.includes(level.lessonId) ? old : [...old, level.lessonId]), [level.lessonId]);
  return <div className="space-y-4"><header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">{title}</h1><label className="flex items-center gap-2 text-sm">{w.choose}<select className="max-w-full rounded border bg-background p-2" aria-label={w.choose} value={level.lessonId} onChange={(e) => navigate(levels.findIndex((l) => l.lessonId === e.target.value))}>{levels.map((l, i) => <option key={l.lessonId} value={l.lessonId}>{i + 1}. {l.title}{passed.includes(l.lessonId) ? " ✓" : ""}</option>)}</select><span>{index + 1}/{levels.length}</span></label></header>
    <ParallelProgrammingActivity key={level.lessonId} payload={level.payload} title={level.title} lessonId={level.lessonId} blockId={level.blockId} preview={preview} onPassed={onPassed} />
    <div className="pg-level-footer"><span>{passed.includes(level.lessonId) ? index === levels.length - 1 ? w.complete : w.passed : w.unlock}</span>{index < levels.length - 1 && <Button type="button" disabled={!passed.includes(level.lessonId)} onClick={() => navigate(index + 1)}>{w.next}</Button>}</div>
    {!preview && <AttemptHistory key={level.lessonId} lessonId={level.lessonId} blockId={level.blockId} />}
  </div>;
}
