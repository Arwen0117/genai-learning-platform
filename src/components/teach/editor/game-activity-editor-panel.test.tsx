// @vitest-environment jsdom

import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

import en from "@/i18n/en.json";
import { I18nProvider } from "@/i18n/client";
import type { GameActivityContainer } from "@/lib/game-activity";
import { createGameActivity } from "./block-templates";
import { GameActivityEditorPanel } from "./game-activity-editor-panel";

const activity: GameActivityContainer = {
  id: "activity-1",
  title: "Practice",
  challenges: [
    {
      id: "challenge-1",
      type: "game",
      title: "Sort steps",
      payload: {
        variant: "sort",
        feedback: { correct: "Good", incorrect: "Try again" },
        items: [{ text: "First", order: 0 }],
      },
    },
    {
      id: "challenge-2",
      type: "game",
      title: "Match terms",
      payload: {
        variant: "match",
        feedback: { correct: "Good", incorrect: "Try again" },
        pairs: [{ left: "A", right: "B" }],
      },
    },
    {
      id: "challenge-3",
      type: "game",
      title: "Choose answer",
      payload: {
        variant: "choose",
        feedback: { correct: "Good", incorrect: "Try again" },
        prompt: "Pick one",
        options: [
          { text: "Correct", correct: true },
          { text: "Distractor", correct: false },
        ],
      },
    },
  ],
};

const generatedActivity = createGameActivity("en", {
  id: "generated-activity",
  title: "Generated practice",
});

function renderPanel(
  options: {
    onChange?: ReturnType<typeof vi.fn>;
    /** Pass explicitly (including `undefined`) to override the fixture activity. */
    activityValue?: GameActivityContainer | undefined;
    onGenerate?: () => Promise<
      | { ok: true; activity: GameActivityContainer }
      | { ok: false; error: string }
    >;
  } = {},
) {
  const onChange = options.onChange ?? vi.fn();
  const activityValue =
    "activityValue" in options ? options.activityValue : activity;

  return render(
    <I18nProvider locale="en" messages={en}>
      <GameActivityEditorPanel
        activity={activityValue}
        challengeIssues={{}}
        errors={[]}
        onChange={onChange}
        onGenerate={options.onGenerate}
        onSelectChallenge={vi.fn()}
        selectedChallengeId={null}
      />
    </I18nProvider>,
  );
}

describe("GameActivityEditorPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("edits the activity title and reorders Challenges through visible controls", () => {
    const onChange = vi.fn();
    const view = renderPanel({ onChange });

    fireEvent.change(view.getByRole("textbox", { name: "Game Activity title" }), {
      target: { value: "Updated practice" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...activity,
      title: "Updated practice",
    });

    fireEvent.click(
      within(view.getByTestId("challenge-2")).getByRole("button", {
        name: "Move Challenge 2 up",
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith({
      ...activity,
      challenges: [activity.challenges[1], activity.challenges[0], activity.challenges[2]],
    });
  });

  it("duplicates and removes a Challenge from the activity", () => {
    const onChange = vi.fn();
    const view = renderPanel({ onChange });

    fireEvent.click(
      within(view.getByTestId("challenge-1")).getByRole("button", {
        name: "Duplicate Challenge 1",
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        challenges: [
          activity.challenges[0],
          expect.objectContaining({
            id: expect.any(String),
            title: "Sort steps (copy)",
          }),
          activity.challenges[1],
          activity.challenges[2],
        ],
      }),
    );

    fireEvent.click(
      within(view.getByTestId("challenge-1")).getByRole("button", {
        name: "Delete Challenge 1",
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith({
      ...activity,
      challenges: activity.challenges.slice(1),
    });
  });

  it("generates a missing Game Activity without confirmation", async () => {
    const onChange = vi.fn();
    const onGenerate = vi.fn().mockResolvedValue({
      ok: true,
      activity: generatedActivity,
    });
    const confirmSpy = vi.spyOn(window, "confirm");
    const view = renderPanel({
      activityValue: undefined,
      onChange,
      onGenerate,
    });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(onGenerate).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith(generatedActivity);
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("skips confirm for template content and applies the generated activity", async () => {
    const onChange = vi.fn();
    const template = createGameActivity("en");
    const onGenerate = vi.fn().mockResolvedValue({
      ok: true,
      activity: generatedActivity,
    });
    const confirmSpy = vi.spyOn(window, "confirm");
    const view = renderPanel({
      activityValue: template,
      onChange,
      onGenerate,
    });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(generatedActivity);
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("confirms before replacing teacher-edited content", async () => {
    const onChange = vi.fn();
    const onGenerate = vi.fn().mockResolvedValue({
      ok: true,
      activity: generatedActivity,
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = renderPanel({ onChange, onGenerate });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect(onGenerate).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps prior content and shows an error when generate fails", async () => {
    const onChange = vi.fn();
    const onGenerate = vi.fn().mockResolvedValue({
      ok: false,
      error: "Generated activity needs review: bad payload",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const view = renderPanel({ onChange, onGenerate });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(
        view.getByText("Generated activity needs review: bad payload"),
      ).toBeTruthy();
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
