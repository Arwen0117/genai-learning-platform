import { z } from "zod";
import { parseParallelProgram, type ParallelCondition, type ParallelLevel, type ParallelProgram } from "./parallel-engine";

export const PROGRAMMING_TEACHING_LIMITS = { concepts: 2000, pseudocode: 12000 } as const;
export const programmingTeachingSchema = z.object({
  version: z.literal(1),
  concepts: z.string().max(PROGRAMMING_TEACHING_LIMITS.concepts),
  pseudocode: z.string().max(PROGRAMMING_TEACHING_LIMITS.pseudocode),
}).strict();
export type ProgrammingTeaching = z.infer<typeof programmingTeachingSchema>;
export const TEACHING_MESSAGES = {
  en: { concepts: "What this level teaches", code: "Reference program · pseudocode", note: "This is a reading guide to the teacher's reference program, not executable Python, Java or C++. Every robot runs the same program concurrently; this is not a loop that runs one robot after another.", edit: "Level teaching notes", generate: "Generate teaching notes with AI", generating: "Generating teaching notes…", apply: "Apply generated teaching notes", reset: "Use notes derived from the program", draft: "Generated preview · review before applying", failed: "Teaching note generation failed. Your existing text has been kept.", changed: "The level, program or text changed. Generate again to avoid overwriting newer edits.", invalid: "Complete a valid map and reference program before generating notes.", guidance: "Edit these notes yourself or generate a preview with AI. If you change the reference program afterwards, review saved notes again. Empty text hides that section; use program-derived notes to restore it.", mock: "[MOCK] Local fallback; no real model was called.", codeLabel: "Reference pseudocode", sourceNote: "Based on the teacher's reference answer; your program may use another valid solution." },
  zh: { concepts: "本题考点", code: "参考程序 · 伪代码", note: "这是教师参考程序的阅读对照，不是可直接运行的Python、Java或C++。所有机器人并行执行同一份程序，不是先执行完一个机器人再执行下一个。", edit: "本关教学解说", generate: "AI生成考点与伪代码", generating: "正在生成教学解说…", apply: "应用生成的教学解说", reset: "使用按程序生成的解说", draft: "生成预览 · 审阅后再应用", failed: "教学解说生成失败，原有文字已保留。", changed: "关卡、程序或文字已经变化，请重新生成，避免覆盖新修改。", invalid: "请先补齐合法的地图和参考程序，再生成解说。", guidance: "可以直接手写，也可以用AI生成预览。之后若修改参考程序，请重新检查已保存的解说。清空文字会隐藏对应部分，可用“按程序生成”恢复。", mock: "[MOCK] 本地备用内容，未调用真实模型。", codeLabel: "参考伪代码", sourceNote: "根据教师参考答案编写；你的程序也可以采用其他正确解法。" },
};

/** Reading notation only: never evaluates code or changes the executable AST. */
export function buildProgrammingTeaching(level: ParallelLevel, input: ParallelProgram, locale: "en" | "zh"): ProgrammingTeaching {
  const program = parseParallelProgram(input, level), zh = locale === "zh";
  const actions = zh ? { up: "向上移动一格", down: "向下移动一格", left: "向左移动一格", right: "向右移动一格", wait: "等待一个tick", end: "结束当前机器人的程序", pickup: "拾取当前格的物品", drop: "放下手中物品到当前格" } : { up: "MOVE UP one cell", down: "MOVE DOWN one cell", left: "MOVE LEFT one cell", right: "MOVE RIGHT one cell", wait: "WAIT one tick", end: "END this robot's program", pickup: "PICK UP the parcel in this cell", drop: "PUT DOWN the carried parcel in this cell" };
  const directions = zh ? { up: "上方相邻格", down: "下方相邻格", left: "左方相邻格", right: "右方相邻格" } : { up: "cell above", down: "cell below", left: "cell to the left", right: "cell to the right" };
  const operators = { eq: "=", ne: "≠", lt: "<", lte: "≤", gt: ">", gte: "≥" };
  const kinds = new Set<string>();
  function condition(c: ParallelCondition): string {
    const cell = "direction" in c && c.direction ? directions[c.direction] : zh ? "当前格" : "this cell";
    const text = c.kind === "value" ? `${c.source === "holding" ? zh ? "手中物品数值" : "carried parcel value" : zh ? `${cell}的物品数值` : `parcel value in ${cell}`} ${operators[c.operator]} ${c.value}`
      : c.kind === "holding" ? zh ? "自己正在携带物品" : "this robot is carrying a parcel"
      : c.kind === "goal" ? zh ? `${cell}是机器人目标格` : `${cell} is a robot goal`
      : c.kind === "delivery" ? zh ? `${cell}是物品配送区` : `${cell} is a parcel delivery zone`
      : c.kind === "item" ? zh ? `${cell}有地上物品` : `${cell} has a ground parcel`
      : c.kind === "wall" ? zh ? `${cell}有障碍` : `${cell} has a wall`
      : c.kind === "boundary" ? zh ? `${cell}在地图外` : `${cell} is outside the map`
      : zh ? `${cell}有机器人` : `${cell} has a robot`;
    return c.not ? `NOT (${text})` : text;
  }
  function lines(list: ParallelProgram, indent = ""): string[] {
    return list.flatMap((c): string[] => {
      kinds.add(c.op); if (c.op === "if") kinds.add(c.condition.kind);
      if (c.op === "repeat") return [`${indent}${zh ? "重复" : "REPEAT"} ${c.count} ${zh ? "次:" : "TIMES:"}`, ...lines(c.body, indent + "    "), `${indent}${zh ? "结束重复" : "END REPEAT"}`];
      if (c.op === "if") return [`${indent}${zh ? "如果" : "IF"} ${condition(c.condition)}:`, ...lines(c.then, indent + "    "), ...(c.else.length ? [`${indent}${zh ? "否则:" : "ELSE:"}`, ...lines(c.else, indent + "    ")] : []), `${indent}${zh ? "结束如果" : "END IF"}`];
      if (c.op === "label") return [`${indent}${zh ? "标记" : "LABEL"} ${c.id}:`];
      if (c.op === "jump") return [`${indent}${zh ? "跳转到标记" : "GO TO LABEL"} ${c.target}`];
      return [`${indent}${actions[c.op]}`];
    });
  }
  const body = lines(program), concepts = [zh ? "顺序与并行：所有机器人同时执行同一份程序，按指令顺序推进；每个机器人有自己的位置和执行进度。" : "Sequence and concurrency: robots run the same program at the same time, each with its own position and instruction progress."];
  if (kinds.has("repeat")) concepts.push(zh ? "循环（loop）：重复块会把里面的指令执行指定次数，减少重复书写。先理解一次循环做什么，再检查重复次数。" : "Loops: REPEAT executes its body the chosen number of times. Understand one iteration, then check the repeat count.");
  if (kinds.has("if")) concepts.push(zh ? "条件分支（if）：每个机器人根据自己观察到的情况选一个分支。判断读取tick开始时的快照并占一个tick，分支动作从后续tick开始；判断为假且没有否则时继续后面的程序。" : "Conditionals: each robot chooses a branch from its own observation. IF reads the tick-start snapshot and takes one tick; branch actions start on later ticks. With no ELSE, a false test continues after END IF.");
  if (kinds.has("label") || kinds.has("jump")) concepts.push(zh ? "标记与跳转：跳转会把执行位置移到指定标记，可能形成循环。标记可放在IF分支里，跳转到该标记会直接进入分支，不重新判断IF条件；正常顺序执行仍只走选中的分支。标记不能放在重复内部。标记和跳转也各占一个tick；需要能到达结束条件，避免一直跳转。" : "Labels and jumps: GO TO transfers execution to a named label and can form a loop. Labels may be inside IF branches; GO TO enters directly at the label without evaluating that IF. Normal fall-through still follows only the selected arm. Labels cannot be inside REPEAT. LABEL and GO TO each take one tick. Ensure the program can eventually finish.");
  if (kinds.has("pickup") || kinds.has("drop") || kinds.has("holding") || kinds.has("item") || kinds.has("value")) concepts.push(zh ? "物品状态：拾取与放下只操作当前格，每人最多携带一件。观察地上物品与观察手中物品是两种不同判断。" : "Parcel state: pickup and drop act on this cell, and each robot holds at most one parcel. Ground observations and carried observations are different.");
  if (kinds.has("value")) concepts.push(zh ? "数值比较：区分<与≤、>与≥以及=与≠，特别检查等于阈值和数值0。没有物品时所有数值比较都为假，NOT再对最终真假取反。" : "Numeric comparison: distinguish strict and inclusive inequalities, equality and inequality. Check equality at the threshold and zero. Without a parcel, every numeric comparison is false; NOT reverses the final result.");
  const preamble = zh ? "所有机器人并行执行以下同一份程序：" : "ALL ROBOTS RUN THIS SAME PROGRAM CONCURRENTLY:";
  const end = zh ? "程序自然结束（仅当未跳转回前面、且未提前结束）" : "Program finishes naturally if it reaches this point without jumping back or ending earlier.";
  return programmingTeachingSchema.parse({ version: 1, concepts: concepts.join("\n\n"), pseudocode: `${preamble}\n\n${body.join("\n")}\n\n${end}` });
}
