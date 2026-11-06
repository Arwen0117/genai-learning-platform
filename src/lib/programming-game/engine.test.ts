import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  GameInputError,
  createExecution,
  executeProgram,
  parseLevel,
  resetExecution,
  stepExecution,
  type Level,
  type Program,
} from "./engine";
import { TEMPLATES, getTemplate, validateTemplateAllowed } from "./levels";

function level(overrides: Partial<Level> = {}): Level {
  return {
    id: "test",
    rulesVersion: 1,
    width: 4,
    height: 3,
    start: { x: 1, y: 1 },
    walls: [],
    item: null,
    goal: { kind: "reach", at: { x: 2, y: 1 }, requireLoop: false },
    allowed: [...ACTIONS, "repeat"],
    ...overrides,
  };
}
function fails(input: unknown, expected: string) {
  expect(() => executeProgram(level(), input)).toThrow(expected);
}
const walk: Program = [{ op: "right" }];

describe("programming game rules", () => {
  for (const template of TEMPLATES)
    it(`solves template ${template.id}`, () => {
      const result = executeProgram(template.level, template.reference);
      expect(result.status).toBe("passed");
      expect(result.error).toBeNull();
    });

  it.each([
    ["up", { x: 1, y: 0 }],
    ["down", { x: 1, y: 2 }],
    ["left", { x: 0, y: 1 }],
    ["right", { x: 2, y: 1 }],
  ] as const)("moves %s one cell", (op, at) => {
    const result = executeProgram(
      level({ goal: { kind: "reach", at, requireLoop: false } }),
      [{ op }],
    );
    expect(result.status).toBe("passed");
    expect(result.robot).toEqual(at);
    expect(result.steps).toBe(1);
  });

  it("distinguishes a normal incomplete run from an execution error", () => {
    const result = executeProgram(level(), [{ op: "up" }]);
    expect(result.status).toBe("incomplete");
    expect(result.unmet).toEqual(["POSITION"]);
    expect(result.error).toBeNull();
  });

  it("does not move on a wall collision and stops remaining commands", () => {
    const result = executeProgram(
      level({
        walls: [{ x: 2, y: 1 }],
        goal: { kind: "reach", at: { x: 3, y: 1 }, requireLoop: false },
      }),
      [{ op: "right" }, { op: "down" }],
    );
    expect(result.status).toBe("error");
    expect(result.robot).toEqual({ x: 1, y: 1 });
    expect(result.steps).toBe(1);
    expect(result.error).toEqual({
      code: "WALL",
      op: "right",
      at: { path: [0], iteration: null },
    });
  });

  it("does not move beyond the map", () => {
    const result = executeProgram(level({ start: { x: 0, y: 0 } }), [
      { op: "left" },
    ]);
    expect(result.error?.code).toBe("OUT_OF_BOUNDS");
    expect(result.robot).toEqual({ x: 0, y: 0 });
  });

  it("preserves the pickup precondition failure state", () => {
    const result = executeProgram(level(), [{ op: "pickup" }]);
    expect(result.error?.code).toBe("NO_ITEM");
    expect(result.holding).toBe(false);
    expect(result.item).toBeNull();
  });

  it("rejects picking up while carrying an item", () => {
    const result = executeProgram(level({ item: { x: 1, y: 1 } }), [
      { op: "pickup" },
      { op: "pickup" },
    ]);
    expect(result.error?.code).toBe("HANDS_FULL");
    expect(result.holding).toBe(true);
    expect(result.item).toBeNull();
    expect(result.steps).toBe(2);
  });

  it("reports dropping with empty hands", () => {
    expect(executeProgram(level(), [{ op: "drop" }]).error?.code).toBe(
      "HANDS_EMPTY",
    );
  });

  it("allows temporary placement, then pickup and delivery", () => {
    const result = executeProgram(
      level({
        item: { x: 1, y: 1 },
        goal: { kind: "deliver", at: { x: 2, y: 1 }, requireLoop: false },
      }),
      [
        { op: "pickup" },
        { op: "drop" },
        { op: "pickup" },
        { op: "right" },
        { op: "drop" },
      ],
    );
    expect(result.status).toBe("passed");
    expect(result.item).toEqual({ x: 2, y: 1 });
    expect(result.holding).toBe(false);
  });

  it("carrying an item over the target is not delivery", () => {
    const result = executeProgram(
      level({
        item: { x: 1, y: 1 },
        goal: { kind: "deliver", at: { x: 2, y: 1 }, requireLoop: false },
      }),
      [{ op: "pickup" }, { op: "right" }],
    );
    expect(result.status).toBe("incomplete");
    expect(result.unmet).toEqual(["DELIVERY"]);
  });

  it("reaching a goal early does not hide later errors", () => {
    const t = getTemplate("repeat-route");
    expect(
      executeProgram(t.level, [
        { op: "repeat", count: 5, body: [{ op: "right" }] },
      ]).error?.code,
    ).toBe("OUT_OF_BOUNDS");
  });

  it("requires an executed loop in the loop lesson", () => {
    const t = getTemplate("repeat-route");
    const result = executeProgram(
      t.level,
      Array.from({ length: 4 }, () => ({ op: "right" })),
    );
    expect(result.status).toBe("incomplete");
    expect(result.unmet).toEqual(["LOOP_REQUIRED"]);
  });

  it("single-steps through loop iterations and produces the same final result", () => {
    const t = getTemplate("repeat-route");
    let state = createExecution(t.level, t.reference);
    const original = JSON.stringify(state);
    const first = stepExecution(state);
    expect(JSON.stringify(state)).toBe(original);
    expect(first.robot).toEqual({ x: 1, y: 0 });
    expect(first.status).toBe("paused");
    expect(first.last).toEqual({ path: [0, 0], iteration: 1 });
    state = first;
    for (let n = 0; n < 3; n++) state = stepExecution(state);
    expect(state).toEqual(executeProgram(t.level, t.reference));
    expect(state.loopIterations).toBe(4);
    expect(state.nodeCount).toBe(2);
    expect(stepExecution(state)).toBe(state);
  });

  it("reports the exact loop child and iteration that failed", () => {
    const result = executeProgram(level(), [
      { op: "repeat", count: 3, body: [{ op: "right" }] },
    ]);
    expect(result.error?.at).toEqual({ path: [0, 0], iteration: 3 });
    expect(result.steps).toBe(3);
    expect(result.robot).toEqual({ x: 3, y: 1 });
  });

  it("reset retains the program but restores all runtime state", () => {
    const state = executeProgram(level(), walk);
    const reset = resetExecution(state);
    expect(reset).toEqual(createExecution(level(), walk));
    expect(reset.program).toEqual(walk);
    expect(state.status).toBe("passed");
  });

  it("does not mutate or retain mutable input objects", () => {
    const t = getTemplate("parcel-delivery");
    const before = JSON.stringify(t);
    const state = createExecution(t.level, t.reference);
    executeProgram(t.level, t.reference);
    expect(JSON.stringify(t)).toBe(before);
    t.level.start.x = 2;
    t.reference[0] = { op: "up" };
    expect(state.level.start.x).toBe(0);
    expect(state.program[0]).toEqual({ op: "right" });
  });

  // 20 * 24 + 20 = 500 safe movements; map ends at its initial position.
  function longProgram(extra = false): Program {
    return [
      {
        op: "repeat",
        count: 20,
        body: Array.from({ length: 24 }, (_, n) => ({
          op: n % 2 ? "left" : "right",
        })),
      },
      {
        op: "repeat",
        count: 20,
        body: [{ op: "right" }, ...(extra ? [{ op: "left" } as const] : [])],
      },
    ];
  }
  it("permits exactly 500 steps and normal completion", () => {
    // Keep the last 20 operations within bounds by alternating them outside a loop.
    const program: Program = [
      longProgram()[0],
      ...Array.from({ length: 20 }, (_, n) => ({
        op: n % 2 ? "left" : "right",
      })),
    ] as Program;
    const l = level({
      goal: { kind: "reach", at: { x: 1, y: 1 }, requireLoop: true },
    });
    const result = executeProgram(l, program);
    expect(result.steps).toBe(500);
    expect(result.status).toBe("passed");
  });
  it("stops before instruction 501 even if the robot is on target", () => {
    const result = executeProgram(
      level({
        goal: { kind: "reach", at: { x: 1, y: 1 }, requireLoop: false },
      }),
      longProgram(true),
    );
    expect(result.steps).toBe(500);
    expect(result.error?.code).toBe("STEP_LIMIT");
    expect(result.cursor).toBe(500);
    expect(result.robot).toEqual({ x: 1, y: 1 });
    expect(result.status).toBe("error");
  });
});

describe("untrusted program validation", () => {
  it.each([null, {}, [], "right", [null], ["right"]])(
    "rejects invalid program %j",
    (input) => {
      expect(() => executeProgram(level(), input)).toThrow(GameInputError);
    },
  );
  it("rejects unknown and nested instructions without recursively traversing them", () => {
    fails([{ op: "teleport" }], "INVALID_ACTION");
    fails(
      [
        {
          op: "repeat",
          count: 1,
          body: [{ op: "repeat", count: 1, body: [] }],
        },
      ],
      "INVALID_ACTION",
    );
  });
  it.each([0, -1, 21, 1.5, "2", Infinity, NaN])(
    "rejects invalid repeat count %s",
    (count) => {
      fails(
        [{ op: "repeat", count, body: [{ op: "right" }] }],
        "INVALID_REPEAT_COUNT",
      );
    },
  );
  it("rejects empty loops", () => {
    fails([{ op: "repeat", count: 2, body: [] }], "INVALID_LOOP_BODY");
  });
  it("counts loop containers and body nodes toward the 50-node limit", () => {
    fails(
      [
        {
          op: "repeat",
          count: 1,
          body: Array.from({ length: 50 }, () => ({ op: "right" })),
        },
      ],
      "TOO_MANY_NODES",
    );
    fails(
      Array.from({ length: 51 }, () => ({ op: "right" })),
      "INVALID_PROGRAM_SIZE",
    );
    const program = Array.from({ length: 25 }, () => [
      { op: "right" },
      { op: "left" },
    ]).flat();
    expect(executeProgram(level(), program).nodeCount).toBe(50);
  });
  it("checks allowed actions including the loop body", () => {
    const l = level({ allowed: ["repeat", "left"] });
    expect(() => executeProgram(l, walk)).toThrow("DISALLOWED_ACTION");
    expect(() =>
      executeProgram(l, [{ op: "repeat", count: 2, body: walk }]),
    ).toThrow("DISALLOWED_ACTION");
    expect(() =>
      executeProgram(level({ allowed: ["right"] }), [
        { op: "repeat", count: 2, body: walk },
      ]),
    ).toThrow("DISALLOWED_REPEAT");
  });
  it("ignores forged scores and runtime claims", () => {
    expect(
      executeProgram(level(), [{ op: "up", completed: true, score: 100 }])
        .status,
    ).toBe("incomplete");
  });
});

describe("level and template validation", () => {
  it.each([
    { width: 0 },
    { height: 13 },
    { rulesVersion: 2 },
    { id: "" },
    { start: { x: -1, y: 1 } },
    { item: { x: 4, y: 0 } },
    { walls: [{ x: 1, y: 1 }] },
    { walls: [{ x: 2, y: 1 }] },
    {
      walls: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
    },
    { allowed: ["right", "right"] },
    { allowed: [] },
    { allowed: ["teleport"] },
    { goal: { kind: "deliver", at: { x: 1, y: 1 }, requireLoop: false } },
    { goal: { kind: "reach", at: { x: 1, y: 1 }, requireLoop: "yes" } },
  ])("rejects invalid level %j", (override) => {
    expect(() => parseLevel({ ...level(), ...override })).toThrow(
      GameInputError,
    );
  });
  it("rejects an item initially inside a wall", () => {
    expect(() =>
      parseLevel(level({ walls: [{ x: 0, y: 0 }], item: { x: 0, y: 0 } })),
    ).toThrow("BLOCKED_INITIAL_STATE");
  });
  it("checks reference compatibility when the teacher changes allowed commands", () => {
    expect(
      validateTemplateAllowed("first-route", ["right", "down"]).allowed,
    ).toEqual(["right", "down"]);
    expect(() => validateTemplateAllowed("first-route", ["right"])).toThrow(
      "DISALLOWED_ACTION",
    );
    expect(() => validateTemplateAllowed("repeat-route", ["right"])).toThrow(
      "DISALLOWED_REPEAT",
    );
  });
  it("template retrieval returns independent copies", () => {
    const a = getTemplate("first-route");
    a.level.start.x = 2;
    expect(getTemplate("first-route").level.start.x).toBe(0);
  });
});
