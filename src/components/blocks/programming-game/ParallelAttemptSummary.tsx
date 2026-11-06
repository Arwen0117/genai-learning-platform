"use client";
import { useI18n } from "@/i18n/client";
import { readParallelHistory } from "@/lib/programming-game/parallel-history";
import type { ParallelProgram } from "@/lib/programming-game/parallel-engine";
import { parallelConditionLabel } from "@/lib/programming-game/parallel-condition";
import { GAME_MESSAGES } from "./messages";
import { PARALLEL_MESSAGES } from "./parallel-messages";

export function UnavailableProgrammingHistory({ result }: { result: unknown }) {
  const { locale } = useI18n();
  return <div className="space-y-2 pt-3 text-sm"><p>{locale === "zh" ? "此记录的版本暂不支持，或记录不完整。以下保留原始记录，不重新计算成绩。" : "This record has an unsupported version or is incomplete. The stored record is preserved; its grade has not been recalculated."}</p><details><summary>{GAME_MESSAGES[locale].rawRecord}</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(result, null, 2)}</pre></details></div>;
}
export function ParallelAttemptSummary({ result }: { result: unknown }) {
  const { locale } = useI18n(), m = GAME_MESSAGES[locale], p = PARALLEL_MESSAGES[locale];
  const record = readParallelHistory(result);
  if (!record) return <UnavailableProgrammingHistory result={result} />;
  const f = record.feedback;
  function lines(program: ParallelProgram, indent = ""): string[] {
    return program.flatMap((c, i) => {
      const start = `${indent}${i + 1}. `;
      if (c.op === "repeat") return [`${start}${m.repeat} × ${c.count}`, ...lines(c.body, indent + "    ")];
      if (c.op === "if") return [`${start}${p.if} ${parallelConditionLabel(c.condition, { ...m.actions, current: p.currentCell, self: p.self }, p.shortConditions, { item: p.itemValue, holding: p.holdingValue })}`, `${indent}  ${p.then}`, ...lines(c.then, indent + "    "), ...(c.else.length ? [`${indent}  ${p.else}`, ...lines(c.else, indent + "    ")] : [])];
      return [`${start}${c.op === "jump" ? `${p.jump} → ${c.target}` : c.op === "label" ? `${p.label} ${c.id}` : c.op === "wait" ? p.wait : c.op === "end" ? p.end : m.actions[c.op]}`];
    });
  }
  function at(path: number[]) {
    const parts: string[] = []; let list = record!.program;
    for (let i = 0; i < path.length; i++) {
      const c = list[path[i]]; parts.push(String(path[i] + 1));
      if (c?.op === "repeat") list = c.body;
      else if (c?.op === "if" && i + 1 < path.length) {
        const branch = path[++i]; parts.push(branch === 0 ? p.then : p.else); list = branch === 0 ? c.then : c.else;
      }
    }
    return parts.join(".");
  }
  return <div className="space-y-2 pt-3 text-sm">
    <p>{m[f.status]} · {p.ticks}: {f.worldTicks} · {p.attempts}: {f.instructionAttempts} · {p.moves}: {f.successfulMoves} · {m.nodes}: {f.nodeCount}</p>
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-3">{lines(record.program).join("\n")}</pre>
    {f.failure && <p>{p.failure[f.failure.code]} · {p.tick} {f.failure.tick}</p>}
    {f.errors.map((e, i) => <p key={i}>{m.robot} {e.robotId}: {p.errors[e.code]} · {p.tick} {e.tick} · {m.at} {at(e.at.path)}{e.at.iteration === null ? "" : ` · ${m.iteration} ${e.at.iteration}`}</p>)}
    <ul className="space-y-1">{f.robots.map((r) => <li key={r.id}>{m.robot} {r.id} · {m.position} ({r.position.x},{r.position.y}) · {p.robotStatus[r.status]} · {p.perAttempts}: {r.attempts}{r.blocked ? ` · ${p.blocking[r.blocked.reason]}` : ""}</li>)}</ul>
    {record.level.delivery && <div><p>{p.itemHelp}</p>{record.level.delivery.numbers && <p>{p.numericHelp}</p>}<ul>{f.items?.map((i) => <li key={i.id}>{p.item} {i.id}{record.level.delivery?.numbers ? ` [${record.level.delivery.items.find((v) => v.id === i.id)?.value}]` : ""}: {i.position ? `(${i.position.x},${i.position.y})` : `${p.holding}: ${f.robots.find((r) => r.holding === i.id)?.id}`}</li>)}</ul>{!!f.undeliveredItemIds?.length && <p>{p.undelivered}: {f.undeliveredItemIds.join(", ")}</p>}</div>}
    {f.unmetRobotIds.length > 0 && <p>{p.unmet}: {f.unmetRobotIds.join(", ")}</p>}
    <p className="break-all text-xs text-muted-foreground">rulesVersion: 2 · SHA-256: {f.levelVersion}</p>
    <details><summary>{m.rawRecord}</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(result, null, 2)}</pre></details>
  </div>;
}
