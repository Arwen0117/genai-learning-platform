"use client";
import { Button } from "@/components/ui/button";
type PendingLevel = { index: number; title: string; reason: "pending" | "changed" | "failed" };
type InputIssue = { path: readonly PropertyKey[]; message: string };
export function RobotCourseSaveStatus({ pending, issues, locale, onSelect, serverChecksPending = false }: {
  serverChecksPending?: boolean; pending: PendingLevel[]; issues: InputIssue[]; locale: "zh" | "en"; onSelect: (index: number) => void;
}) {
  const zh = locale === "zh";
  if (!pending.length && !issues.length) return <p role="status" className="text-sm">{serverChecksPending ? zh ? "导入的参考答案无需逐关手动运行，可直接保存；保存时将自动校验。" : "Imported references do not need manual runs. Save to validate them automatically." : zh ? "整门课程检查通过，可以保存课程。" : "All course checks passed. You can save the course."}</p>;
  const fields: Record<string, string> = zh
    ? { title: "名称", description: "课程介绍", language: "课程语言", status: "发布状态", customLevel: "地图", referenceProgram: "参考答案", allowed: "允许指令", task: "任务说明", hints: "提示", knowledge: "知识卡", teaching: "考点与伪代码", concepts: "考点解说", pseudocode: "伪代码" }
    : { title: "Title", description: "Course description", language: "Language", status: "Publication status", customLevel: "Map", referenceProgram: "Reference answer", allowed: "Allowed commands", task: "Task", hints: "Hints", knowledge: "Knowledge cards", teaching: "Teaching notes", concepts: "Concepts", pseudocode: "Pseudocode" };
  function levelName(index: number) { return zh ? `第 ${index + 1} 关` : `Level ${index + 1}`; }
  const reasons = zh ? { pending: "尚未验证", changed: "地图或程序已修改，需要重新验证", failed: "参考答案未通过" } : { pending: "Not verified", changed: "Map or program changed; verify again", failed: "Reference answer did not pass" };
  return <section aria-label={zh ? "保存前检查" : "Save checks"} className="space-y-2 rounded border p-3 text-sm">
    <p className="font-medium">{zh ? "暂时不能保存：保存会检查整门课程，当前关卡通过不代表全部关卡已通过。" : "Cannot save yet: saving checks the whole course, not just the current level."}</p>
    <ul className="list-disc space-y-2 pl-5">
      {pending.map(p => <li key={p.index}><span>{levelName(p.index)} · {p.title}：{reasons[p.reason]} </span><Button type="button" variant="outline" size="sm" onClick={() => onSelect(p.index)}>{zh ? "前往验证" : "Verify level"}</Button></li>)}
      {issues.map((issue, i) => {
        const index = issue.path[0] === "levels" && typeof issue.path[1] === "number" ? issue.path[1] : null;
        const field = issue.path.filter(v => typeof v === "string" && v !== "levels" && v !== "payload").map(v => fields[String(v)] ?? String(v)).join(" / ");
        return <li key={i}>{index !== null ? `${levelName(index)} · ` : ""}{field || (zh ? "课程内容" : "Course content")}：{issue.message}{index !== null && <Button type="button" variant="outline" size="sm" onClick={() => onSelect(index)}>{zh ? "前往修改" : "Edit level"}</Button>}</li>;
      })}
    </ul>
  </section>;
}
