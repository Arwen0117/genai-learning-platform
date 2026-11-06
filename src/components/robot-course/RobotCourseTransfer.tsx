"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { exportRobotCourse, importRobotCourse, ROBOT_COURSE_FILE_LIMIT } from "@/lib/programming-game/course-transfer";
import type { RobotCourseDraft } from "@/lib/programming-game/robot-course";

export function RobotCourseTransfer({ draft, locale, onImport }: { draft: RobotCourseDraft; locale: "en" | "zh"; onImport: (draft: RobotCourseDraft) => void }) {
  const zh = locale === "zh", input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<RobotCourseDraft | null>(null), [notice, setNotice] = useState(""), [reading, setReading] = useState(false), [dragging, setDragging] = useState(false);
  const readingNow = useRef(false), dragDepth = useRef(0);
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([exportRobotCourse(draft)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "robot-course.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(zh ? "课程文件已导出，包含参考答案；请妥善保管。" : "Course exported, including reference answers. Keep this file private.");
    } catch { setNotice(zh ? "无法导出：请检查课程内容是否完整，文件不得超过 2 MiB。" : "Could not export. Check course content and the 2 MiB limit."); }
  }
  async function read(file: File) {
    if (readingNow.current) return;
    readingNow.current = true;
    setReading(true); setPending(null); setNotice("");
    try {
      if (!file.name.toLowerCase().endsWith(".json") || file.size > ROBOT_COURSE_FILE_LIMIT) throw new Error("size");
      setPending(importRobotCourse(await file.text()));
    } catch { setNotice(zh ? "无法导入：请使用有效的机器人课程 JSON 文件（版本 1，最大 2 MiB）。" : "Cannot import. Use a valid robot course JSON file (version 1, up to 2 MiB)."); }
    finally { readingNow.current = false; setReading(false); }
  }
  return <section className="space-y-3 rounded border p-3" aria-label={zh ? "课程迁移" : "Course transfer"}>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={download}>{zh ? "导出课程" : "Export course"}</Button>
      <Button type="button" variant="outline" disabled={reading} onClick={() => input.current?.click()}>{reading ? (zh ? "读取中…" : "Reading…") : (zh ? "导入课程" : "Import course")}</Button>
      <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label={zh ? "选择课程文件" : "Choose course file"} disabled={reading} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void read(file); }} />
    </div>
    <button type="button" disabled={reading} aria-label={zh ? "拖入课程文件或点击上传" : "Drop a course file or click to upload"}
      className={`block w-full rounded-lg border-2 border-dashed p-5 text-center text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-50 ${dragging ? "border-primary bg-primary/10" : "border-muted-foreground/40 bg-muted/20 hover:bg-muted/40"}`}
      onClick={() => input.current?.click()}
      onDragEnter={(e) => { e.preventDefault(); if (!e.currentTarget.matches(":disabled") && !readingNow.current) { dragDepth.current++; setDragging(true); } }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.currentTarget.matches(":disabled") || readingNow.current ? "none" : "copy"; }}
      onDragLeave={(e) => { e.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault(); dragDepth.current = 0; setDragging(false);
        if (e.currentTarget.matches(":disabled") || readingNow.current) return;
        if (e.dataTransfer.files.length !== 1) { setPending(null); setNotice(zh ? "请一次拖入一个课程 JSON 文件。" : "Drop one course JSON file at a time."); return; }
        void read(e.dataTransfer.files[0]);
      }}>
      {reading ? (zh ? "读取中…" : "Reading…") : dragging ? (zh ? "松开以读取课程文件" : "Release to read the course file") : (zh ? "将课程 JSON 文件拖到这里，或点击选择（最大 2 MiB）" : "Drop a course JSON file here, or click to choose (up to 2 MiB)")}
    </button>
    <p className="text-sm text-muted-foreground">{zh ? "导出当前编辑内容，包含地图、参考答案、提示与教学解说，不包含学生记录。导入会创建新草稿；请先导出当前未保存的修改。" : "Exports current maps, reference answers, hints and teaching notes, without learner records. Import creates a new draft; export any unsaved changes first."}</p>
    {pending && <div className="space-y-2 rounded border p-3"><p>{pending.title} · {pending.levels.length} {zh ? "关" : "levels"} · {pending.language}</p><p className="text-sm">{zh ? "确认后将切换到导入的新草稿，当前未保存的修改将被替换。原课程不变；请手动验证参考答案后保存。" : "Confirming replaces the current unsaved editor content with a new draft. The original saved course stays intact. Run reference checks manually before saving."}</p>
      <Button type="button" onClick={() => { onImport(pending); setPending(null); setNotice(zh ? "已导入新草稿，请验证后保存。" : "New draft imported. Verify and save it."); }}>{zh ? "确认为新草稿" : "Confirm as new draft"}</Button>{" "}
      <Button type="button" variant="outline" onClick={() => setPending(null)}>{zh ? "取消" : "Cancel"}</Button>
    </div>}
    <p role="status" className="text-sm">{notice}</p>
  </section>;
}
