import {
  createParallelExecution, stepParallelExecution,
  type ParallelExecution, type ParallelLevel, type ParallelProgram,
} from "./parallel-engine";

/** Playback only. Selection never changes scheduling, budgets or world state. */
export type ParallelPlayerState = {
  program: ParallelProgram;
  execution: ParallelExecution | null;
  playing: boolean;
  selectedId: string;
  inputError: string | null;
};
export type ParallelPlayerAction =
  | { type: "edit"; program: ParallelProgram }
  | { type: "select"; id: string; level: ParallelLevel }
  | { type: "run" | "step"; level: ParallelLevel }
  | { type: "continue" | "pause" | "reset" }
  | { type: "tick"; expected: ParallelExecution };

export function initialParallelPlayer(level: ParallelLevel): ParallelPlayerState {
  return { program: [], execution: null, playing: false, selectedId: level.robots[0].id, inputError: null };
}
export function isParallelTerminal(execution: ParallelExecution | null): boolean {
  return execution !== null && execution.status !== "ready" && execution.status !== "paused";
}
export function parallelPlayerReducer(state: ParallelPlayerState, action: ParallelPlayerAction): ParallelPlayerState {
  switch (action.type) {
    case "edit":
      return { ...state, program: action.program, execution: null, playing: false, inputError: null };
    case "select":
      return action.level.robots.some((r) => r.id === action.id)
        ? { ...state, selectedId: action.id } : state;
    case "pause":
      // Replace snapshot identity so a callback queued before pause is invalid
      // even if the learner immediately presses Continue.
      return state.playing ? { ...state, playing: false, execution: state.execution ? { ...state.execution } : null } : state;
    case "continue":
      return state.execution && !isParallelTerminal(state.execution) ? { ...state, playing: true } : state;
    case "reset":
      return { ...state, execution: null, playing: false, inputError: null };
    case "tick": {
      if (!state.playing || state.execution !== action.expected) return state;
      const execution = stepParallelExecution(action.expected);
      return { ...state, execution, playing: !isParallelTerminal(execution) };
    }
    case "run":
    case "step": {
      if (action.type === "step" && (state.playing || isParallelTerminal(state.execution))) return state;
      try {
        const base = action.type === "run" || !state.execution
          ? createParallelExecution(action.level, state.program) : state.execution;
        const execution = action.type === "step" ? stepParallelExecution(base) : base;
        return { ...state, execution, playing: action.type === "run", inputError: null };
      } catch (error) {
        return { ...state, execution: null, playing: false, inputError: error instanceof Error ? error.message : "INVALID_PROGRAM_SIZE" };
      }
    }
  }
}
