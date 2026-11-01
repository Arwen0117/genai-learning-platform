// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
          score: { raw: 1, max: 1, normalized: 1 },
        },
      },
    ],
    nextCursor: null,
  })),
}));

describe("AttemptHistory learner behavior", () => {
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
});
