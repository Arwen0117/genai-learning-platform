// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/en.json";
import { I18nProvider } from "@/i18n/client";
import { AttemptHistory } from "./attempt-history";

vi.mock("@/server/activities", () => ({
  loadActivityAttempts: vi.fn(async () => ({
    ok: true,
    attempts: [
      {
        id: "attempt",
        createdAt: "2026-01-01T00:00:00.000Z",
        result: {
          activityType: "game",
          completed: true,
          attemptNumber: 1,
          score: { raw: 1, max: 1, normalized: 1 },
        },
      },
    ],
    nextCursor: null,
  })),
}));

describe("AttemptHistory learner behavior", () => {
  afterEach(() => cleanup());

  it("does not expose numeric scores for Game Activity attempts", async () => {
    render(
      <I18nProvider locale="en" messages={en}>
        <AttemptHistory lessonId="lesson" blockId="game" />
      </I18nProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /submission history/i }),
    );
    await waitFor(() => expect(screen.getByText(/Completed/)).toBeTruthy());

    const summary = screen.getByText(/Completed/);
    expect(summary.textContent).not.toContain("100%");
    expect(summary.textContent).not.toContain("(1/1)");
  });

  it("shows qualitative progress, Correction, and Hint state", async () => {
    const { loadActivityAttempts } = await import("@/server/activities");
    vi.mocked(loadActivityAttempts).mockResolvedValueOnce({
      ok: true,
      attempts: [
        {
          id: "hint",
          createdAt: "2026-01-01T00:00:00.000Z",
          result: {
            activityType: "game",
            completed: true,
            attemptNumber: 2,
            answer: { kind: "hint" },
            feedback: { kind: "hint" },
          },
        },
        {
          id: "incorrect",
          createdAt: "2026-01-01T00:00:00.000Z",
          result: {
            activityType: "game",
            completed: true,
            attemptNumber: 1,
            answer: { kind: "submission" },
            feedback: { correction: { answer: "Correct answer" } },
          },
        },
      ],
      nextCursor: null,
    });

    render(
      <I18nProvider locale="en" messages={en}>
        <AttemptHistory lessonId="lesson" blockId="game" />
      </I18nProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /submission history/i }),
    );

    await waitFor(() =>
      expect(screen.getByText("Hint used; correctness is unchanged.")).toBeTruthy(),
    );
    expect(screen.getByText("Correction recorded.")).toBeTruthy();
    expect(screen.getByText("Playthrough response 2")).toBeTruthy();
  });
});

describe("robot history compatibility", () => {
 afterEach(() => cleanup());
 it("keeps robot numeric scores and structured history alongside qualitative Game Activity history", async () => {
  const { createParallelProgrammingPayload, parallelProgrammingLevel, parallelProgrammingReference } = await import("@/lib/programming-game/parallel-config");
  const { gradeParallelProgramming } = await import("@/lib/programming-game/parallel-grade");
  const { loadActivityAttempts } = await import("@/server/activities");
  const payload = createParallelProgrammingPayload("parallel-lanes", "en"), program = parallelProgrammingReference(payload);
  const grade = gradeParallelProgramming(payload, { program });
  vi.mocked(loadActivityAttempts).mockResolvedValueOnce({ ok: true, attempts: [{ id: "robot-attempt", createdAt: "2026-01-01T00:00:00.000Z", result: { version: 1, activityType: "game", answer: { program }, ...grade, feedback: { ...grade.feedback, levelVersion: "0".repeat(64), levelSnapshot: parallelProgrammingLevel(payload) } } }], nextCursor: null });
  render(<I18nProvider locale="en" messages={en}><AttemptHistory lessonId="l" blockId="robot" /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: /submission history/i }));
  await waitFor(() => expect(screen.getByText(/100% \(100\/100\)/)).toBeTruthy());
  expect(screen.getByText(/SHA-256/)).toBeTruthy();
 });
});
