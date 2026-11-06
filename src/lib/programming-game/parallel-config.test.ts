import { describe, expect, it } from "vitest";
import { createParallelProgrammingPayload, parallelProgrammingLevel, parallelProgrammingPayloadSchema, parallelProgrammingVersion } from "./parallel-config";
import { PARALLEL_TEMPLATES } from "./parallel-levels";
import { executeParallelProgram } from "./parallel-engine";
import { createProgrammingPayload, programmingVersion } from "./config";

describe("C2 explicit v2 configuration foundation", () => {
  for (const t of PARALLEL_TEMPLATES) for (const n of [1, 2, 3, 4]) it(`${t.id} supports a bounded ${n}-robot course payload`, () => {
    const p = createParallelProgrammingPayload(t.id, "zh", n), level = parallelProgrammingLevel(p);
    expect(p.rulesVersion).toBe(2); expect(level.robots).toHaveLength(n);
    expect(executeParallelProgram(level, t.reference).status).toBe("passed");
  });
  it.each([{ rulesVersion: 1 }, { rulesVersion: 3 }, { rulesVersion: undefined }, { templateRevision: 2 }, { robotCount: 0 }, { robotCount: 5 }, { robotCount: 1.5 }, { templateId: "first-route" }, { allowed: ["right", "right", "repeat"] }, { allowed: ["right"] }, { allowed: ["right", "repeat", "if"] }, { task: " " }, { passed: true }])("rejects ambiguous/unsafe configuration %j", (overrides) => {
    expect(parallelProgrammingPayloadSchema.safeParse({ ...createParallelProgrammingPayload("parallel-lanes", "en"), ...overrides }).success).toBe(false);
  });
  it("rejects unknown runtime fields and executable answers in teacher payloads", () => {
    expect(parallelProgrammingPayloadSchema.safeParse({ ...createParallelProgrammingPayload("parallel-lanes", "en"), program: [{ op: "right" }] }).success).toBe(false);
  });
  it("gives a stable hash regardless of allowed-command ordering", async () => {
    const p = createParallelProgrammingPayload("parallel-lanes", "en"), hash = await parallelProgrammingVersion(p);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(await parallelProgrammingVersion({ ...p, allowed: [...p.allowed].reverse() })).toBe(hash);
  });
  it("binds robot count, text, hints, knowledge and allowed commands to the version", async () => {
    const p = createParallelProgrammingPayload("parallel-lanes", "en"), hash = await parallelProgrammingVersion(p);
    for (const change of [{ robotCount: 1 }, { task: "A different task" }, { hints: ["Different hint"] }, { knowledge: [{ title: "Concept", body: "Explanation" }] }, { allowed: p.allowed.filter((op) => op !== "end") }])
      expect(await parallelProgrammingVersion({ ...p, ...change })).not.toBe(hash);
  });
  it("does not mutate the caller while hashing or constructing the level", async () => {
    const p = createParallelProgrammingPayload("parallel-jump-route", "en"), before = JSON.stringify(p);
    const level = parallelProgrammingLevel(p); level.robots[0].start.x = 4;
    await parallelProgrammingVersion(p); expect(JSON.stringify(p)).toBe(before);
    expect(parallelProgrammingLevel(p).robots[0].start.x).toBe(0);
  });
  it("keeps v1 configuration and hash generation isolated from v2", async () => {
    const p = createProgrammingPayload("first-route", "en"), before = await programmingVersion(p);
    await parallelProgrammingVersion(createParallelProgrammingPayload("parallel-lanes", "en"));
    expect(await programmingVersion(p)).toBe(before);
    expect(parallelProgrammingPayloadSchema.safeParse(p).success).toBe(false);
  });
});
