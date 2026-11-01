import {
  createExecution,
  stepExecution,
  type Execution,
  type Level,
  type Program,
} from "./engine";

/** UI control state is deliberately separate from deterministic execution. */
export type PlayerState = {
  program: Program;
  execution: Execution | null;
  playing: boolean;
  inputError: string | null;
};
export type PlayerAction =
  | { type: "edit"; program: Program }
  | { type: "run"; level: Level }
  | { type: "step"; level: Level }
  | { type: "continue" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "tick"; expected: Execution };

export function initialPlayer(): PlayerState {
  return { program: [], execution: null, playing: false, inputError: null };
}
export function isTerminal(execution: Execution | null): boolean {
  return execution !== null && !["ready", "paused"].includes(execution.status);
}
export function playerReducer(
  state: PlayerState,
  action: PlayerAction,
): PlayerState {
  switch (action.type) {
    case "edit":
      return {
        program: action.program,
        execution: null,
        playing: false,
        inputError: null,
      };
    case "pause":
      return state.playing
        ? {
            ...state,
            playing: false,
            execution: state.execution ? { ...state.execution } : null,
          }
        : state;
    case "reset":
      return { ...state, execution: null, playing: false, inputError: null };
    case "continue":
      return state.execution && !isTerminal(state.execution)
        ? { ...state, playing: true }
        : state;
    case "tick": {
      // An old timeout must never advance a reset, edited, or restarted run.
      if (!state.playing || state.execution !== action.expected) return state;
      const execution = stepExecution(action.expected);
      return { ...state, execution, playing: !isTerminal(execution) };
    }
    case "run":
    case "step": {
      if (
        action.type === "step" &&
        (state.playing || isTerminal(state.execution))
      )
        return state;
      try {
        const base =
          action.type === "run" || !state.execution
            ? createExecution(action.level, state.program)
            : state.execution;
        const execution = action.type === "step" ? stepExecution(base) : base;
        return {
          ...state,
          execution,
          playing: action.type === "run",
          inputError: null,
        };
      } catch (error) {
        return {
          ...state,
          execution: null,
          playing: false,
          inputError:
            error instanceof Error ? error.message : "INVALID_PROGRAM_SIZE",
        };
      }
    }
  }
}
