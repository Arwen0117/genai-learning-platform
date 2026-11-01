import { describe, expect, it } from "vitest";
import { createExecution, type Execution, type Program } from "./engine";
import { getTemplate } from "./levels";
import {
  initialPlayer,
  isTerminal,
  playerReducer,
  type PlayerState,
} from "./player";

const template = getTemplate("first-route");
function prepared(program: Program = template.reference) {
  return playerReducer(initialPlayer(), { type: "edit", program });
}
function tick(state: PlayerState) {
  return playerReducer(state, { type: "tick", expected: state.execution! });
}

describe("programming game player controls", () => {
  it("starts empty without moving the robot", () => {
    expect(initialPlayer()).toEqual({
      program: [],
      execution: null,
      playing: false,
      inputError: null,
    });
    expect(prepared().execution).toBeNull();
  });
  it("run creates an initial execution and waits for the first scheduled step", () => {
    const state = playerReducer(prepared(), {
      type: "run",
      level: template.level,
    });
    expect(state.playing).toBe(true);
    expect(state.execution?.robot).toEqual(template.level.start);
    expect(state.execution?.steps).toBe(0);
    expect(tick(state).execution?.robot).toEqual({ x: 1, y: 0 });
  });
  it("pause blocks pending ticks and continue resumes without repeating steps", () => {
    const started = tick(
      playerReducer(prepared(), { type: "run", level: template.level }),
    );
    const paused = playerReducer(started, { type: "pause" });
    expect(tick(paused)).toBe(paused);
    const resumed = playerReducer(paused, { type: "continue" });
    const next = tick(resumed);
    expect(next.execution?.steps).toBe(2);
    expect(next.execution?.robot).toEqual({ x: 2, y: 0 });
  });
  it("single-step starts a new run and executes exactly one action", () => {
    const state = playerReducer(prepared(), {
      type: "step",
      level: template.level,
    });
    expect(state.playing).toBe(false);
    expect(state.execution?.steps).toBe(1);
    expect(state.execution?.status).toBe("paused");
  });
  it("a timeout queued before pause cannot advance a resumed run", () => {
    const old = playerReducer(prepared(), {
      type: "run",
      level: template.level,
    });
    const paused = playerReducer(old, { type: "pause" });
    const resumed = playerReducer(paused, { type: "continue" });
    expect(
      playerReducer(resumed, { type: "tick", expected: old.execution! }),
    ).toBe(resumed);
    expect(tick(resumed).execution?.steps).toBe(1);
  });
  it("cannot step while continuous execution is running", () => {
    const state = playerReducer(prepared(), {
      type: "run",
      level: template.level,
    });
    expect(playerReducer(state, { type: "step", level: template.level })).toBe(
      state,
    );
  });
  it("stops the scheduler when the program passes", () => {
    let state = playerReducer(prepared(), {
      type: "run",
      level: template.level,
    });
    for (let i = 0; i < 3; i++) state = tick(state);
    expect(state.execution?.status).toBe("passed");
    expect(state.playing).toBe(false);
    expect(tick(state)).toBe(state);
    expect(playerReducer(state, { type: "continue" })).toBe(state);
    expect(playerReducer(state, { type: "step", level: template.level })).toBe(
      state,
    );
  });
  it("a one-action program can pass with one single step", () => {
    const level = {
      ...template.level,
      goal: { ...template.level.goal, at: { x: 1, y: 0 } },
    };
    const state = playerReducer(prepared([{ op: "right" }]), {
      type: "step",
      level,
    });
    expect(state.execution?.status).toBe("passed");
    expect(state.playing).toBe(false);
  });
  it("distinguishes a valid incomplete run", () => {
    const state = tick(
      playerReducer(prepared([{ op: "right" }]), {
        type: "run",
        level: template.level,
      }),
    );
    expect(state.execution?.status).toBe("incomplete");
    expect(state.execution?.error).toBeNull();
    expect(state.playing).toBe(false);
  });
  it("stops on collision and retains the error for display", () => {
    const state = tick(
      playerReducer(prepared([{ op: "down" }]), {
        type: "run",
        level: template.level,
      }),
    );
    expect(state.execution?.error?.code).toBe("WALL");
    expect(state.playing).toBe(false);
  });
  it("reset keeps the program and rejects an old pending timeout", () => {
    const state = playerReducer(prepared(), {
      type: "run",
      level: template.level,
    });
    const reset = playerReducer(state, { type: "reset" });
    expect(reset.execution).toBeNull();
    expect(reset.program).toEqual(template.reference);
    expect(
      playerReducer(reset, { type: "tick", expected: state.execution! }),
    ).toBe(reset);
  });
  it("editing discards old results and invalidates queued callbacks", () => {
    const state = tick(
      playerReducer(prepared(), { type: "run", level: template.level }),
    );
    const changed = playerReducer(state, {
      type: "edit",
      program: [{ op: "left" }],
    });
    expect(changed.execution).toBeNull();
    expect(changed.playing).toBe(false);
    expect(
      playerReducer(changed, { type: "tick", expected: state.execution! }),
    ).toBe(changed);
  });
  it("an old timeout cannot advance a newer run", () => {
    const old = playerReducer(prepared(), {
      type: "run",
      level: template.level,
    });
    const restarted = playerReducer(tick(old), {
      type: "run",
      level: template.level,
    });
    expect(restarted.execution?.steps).toBe(0);
    expect(restarted.execution).not.toBe(old.execution);
    expect(
      playerReducer(restarted, { type: "tick", expected: old.execution! }),
    ).toBe(restarted);
  });
  it("one execution snapshot can be consumed by a timeout only once", () => {
    const state = playerReducer(prepared(), {
      type: "run",
      level: template.level,
    });
    const next = tick(state);
    expect(
      playerReducer(next, { type: "tick", expected: state.execution! }),
    ).toBe(next);
  });
  it.each(["run", "step"] as const)(
    "%s shows a validation error for an empty loop",
    (type) => {
      const state = playerReducer(
        prepared([{ op: "repeat", count: 2, body: [] }]),
        {
          type,
          level: {
            ...template.level,
            allowed: [...template.level.allowed, "repeat"],
          },
        },
      );
      expect(state.inputError).toBe("INVALID_LOOP_BODY");
      expect(state.execution).toBeNull();
      expect(state.playing).toBe(false);
    },
  );
  it("editing after validation failure clears the input error", () => {
    const invalid = playerReducer(initialPlayer(), {
      type: "run",
      level: template.level,
    });
    expect(invalid.inputError).toBe("INVALID_PROGRAM_SIZE");
    expect(
      playerReducer(invalid, { type: "edit", program: template.reference })
        .inputError,
    ).toBeNull();
  });
  it("pause and continue do nothing before execution exists", () => {
    const state = initialPlayer();
    expect(playerReducer(state, { type: "pause" })).toBe(state);
    expect(playerReducer(state, { type: "continue" })).toBe(state);
  });
  it("terminal detection matches every engine state", () => {
    const base = createExecution(template.level, template.reference);
    expect(isTerminal(null)).toBe(false);
    for (const status of [
      "ready",
      "paused",
      "passed",
      "incomplete",
      "error",
    ] as const)
      expect(isTerminal({ ...base, status } as Execution)).toBe(
        ["passed", "incomplete", "error"].includes(status),
      );
  });
});
