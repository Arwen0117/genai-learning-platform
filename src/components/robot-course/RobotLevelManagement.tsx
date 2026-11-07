"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { RobotCourseDraft } from "@/lib/programming-game/robot-course";
type Level = RobotCourseDraft["levels"][number];
export function RobotLevelManagement({ levels, active, locale, onMove, onDelete }: {
  levels: Level[]; active: number; locale: "zh" | "en";
  onMove: (target: number) => void; onDelete: () => void;
}) {
  const zh = locale === "zh", [confirming, setConfirming] = useState(false);
  return <section className="space-y-2 rounded border p-3" aria-label={zh ? "关卡管理" : "Level management"}>
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" disabled={active === 0} onClick={() => onMove(active - 1)}>{zh ? "上移关卡" : "Move level up"}</Button>
      <Button type="button" variant="outline" disabled={active === levels.length - 1} onClick={() => onMove(active + 1)}>{zh ? "下移关卡" : "Move level down"}</Button>
      <label>{zh ? "移到第几关" : "Move to position"}<select className="ml-2 rounded border bg-background p-2" aria-label={zh ? "移到第几关" : "Move to position"} value={active} onChange={(e) => onMove(Number(e.target.value))}>{levels.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>
      <Button type="button" variant="outline" disabled={levels.length <= 1} onClick={() => setConfirming(true)}>{zh ? "删除当前关卡" : "Delete current level"}</Button>
    </div>
    <p className="text-sm text-muted-foreground">{zh ? "排序和删除在保存课程后生效，至少保留一关。有学习记录的关卡不可永久删除。" : "Reordering and deletion take effect after saving. Keep at least one level. Levels with learning records cannot be permanently deleted."}</p>
    {confirming && <div className="space-y-2 rounded border p-3" role="group" aria-label={zh ? "确认删除关卡" : "Confirm level deletion"}>
      <p>{zh ? `删除“${levels[active].title}”？保存前可以恢复；保存后无法撤销删除。` : `Delete “${levels[active].title}”? You can restore it before saving; deletion cannot be undone after saving.`}</p>
      <Button type="button" variant="destructive" onClick={() => { setConfirming(false); onDelete(); }}>{zh ? "确认删除" : "Confirm delete"}</Button>{" "}
      <Button type="button" variant="outline" onClick={() => setConfirming(false)}>{zh ? "取消删除" : "Cancel deletion"}</Button>
    </div>}
  </section>;
}
