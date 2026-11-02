// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/en.json";
import { I18nProvider } from "@/i18n/client";
import type { GameBlock, SimulationBlock } from "@/lib/blocks/schema";
import type { GameActivityContainer } from "@/lib/game-activity";
import { mockSimulationBlock } from "@/lib/llm/prompts/simulation-block";
import { createBlock, createGameActivity } from "./block-templates";

vi.mock("@/components/blocks/BlockRenderer", () => ({
  BlockRenderer: () => null,
}));

import { BlockEditorPanel } from "./block-editor-panel";

const templateSimulation = createBlock("simulation", "en") as SimulationBlock;
const generatedSimulation = mockSimulationBlock("en");
const templateActivity = createGameActivity("en");
const generatedActivity = createGameActivity("en", {
  id: "generated-activity",
  title: "Generated practice",
});
const templateChallenge = templateActivity.challenges[0] as GameBlock;

function renderPanel(
  options: {
    block?: GameBlock | SimulationBlock | ReturnType<typeof createBlock>;
    onChange?: ReturnType<typeof vi.fn>;
    onGenerateSimulation?: () => Promise<
      { ok: true; block: SimulationBlock } | { ok: false; error: string }
    >;
    gameActivity?: GameActivityContainer;
    onGenerateGameActivity?: () => Promise<
      | { ok: true; activity: GameActivityContainer }
      | { ok: false; error: string }
    >;
    onApplyGameActivity?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return render(
    <I18nProvider locale="en" messages={en}>
      <BlockEditorPanel
        block={options.block ?? templateSimulation}
        errors={[]}
        gameActivity={options.gameActivity}
        onApplyGameActivity={options.onApplyGameActivity}
        onChange={options.onChange ?? vi.fn()}
        onDelete={vi.fn()}
        onGenerateGameActivity={options.onGenerateGameActivity}
        onGenerateSimulation={options.onGenerateSimulation}
        onProblem={vi.fn()}
      />
    </I18nProvider>,
  );
}

describe("BlockEditorPanel Simulation generate", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("skips confirm for template content and applies via onChange", async () => {
    const onChange = vi.fn();
    const onGenerateSimulation = vi.fn().mockResolvedValue({
      ok: true,
      block: generatedSimulation,
    });
    const confirmSpy = vi.spyOn(window, "confirm");
    const view = renderPanel({ onChange, onGenerateSimulation });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(onGenerateSimulation).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith({
        ...generatedSimulation,
        id: templateSimulation.id,
      });
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("confirms before replacing teacher-edited Simulation content", async () => {
    const edited: SimulationBlock = {
      ...templateSimulation,
      title: "Teacher scenario",
      payload: {
        ...templateSimulation.payload,
        intro: "A rewritten intro.",
      },
    };
    const onChange = vi.fn();
    const onGenerateSimulation = vi.fn().mockResolvedValue({
      ok: true,
      block: generatedSimulation,
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = renderPanel({
      block: edited,
      onChange,
      onGenerateSimulation,
    });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect(onGenerateSimulation).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps prior content and shows an error when generate fails", async () => {
    const onChange = vi.fn();
    const onGenerateSimulation = vi.fn().mockResolvedValue({
      ok: false,
      error: "The lesson came back in the wrong format.",
    });
    const view = renderPanel({ onChange, onGenerateSimulation });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(
        view.getByText("The lesson came back in the wrong format."),
      ).toBeTruthy();
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("BlockEditorPanel Game Activity generate", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows Generate with AI when a Challenge is selected", () => {
    const view = renderPanel({
      block: templateChallenge,
      gameActivity: templateActivity,
      onGenerateGameActivity: vi.fn(),
      onApplyGameActivity: vi.fn(),
    });

    expect(view.getByRole("button", { name: "Generate with AI" })).toBeTruthy();
  });

  it("skips confirm for template Game Activity and applies via onApplyGameActivity", async () => {
    const onApplyGameActivity = vi.fn();
    const onGenerateGameActivity = vi.fn().mockResolvedValue({
      ok: true,
      activity: generatedActivity,
    });
    const confirmSpy = vi.spyOn(window, "confirm");
    const view = renderPanel({
      block: templateChallenge,
      gameActivity: templateActivity,
      onGenerateGameActivity,
      onApplyGameActivity,
    });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(onGenerateGameActivity).toHaveBeenCalledOnce();
      expect(onApplyGameActivity).toHaveBeenCalledWith(generatedActivity);
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("confirms before replacing teacher-edited Game Activity content", async () => {
    const edited: GameActivityContainer = {
      ...templateActivity,
      title: "Teacher practice",
    };
    const onApplyGameActivity = vi.fn();
    const onGenerateGameActivity = vi.fn().mockResolvedValue({
      ok: true,
      activity: generatedActivity,
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = renderPanel({
      block: templateChallenge,
      gameActivity: edited,
      onGenerateGameActivity,
      onApplyGameActivity,
    });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect(onGenerateGameActivity).not.toHaveBeenCalled();
    expect(onApplyGameActivity).not.toHaveBeenCalled();
  });

  it("keeps prior content and shows an error when Game Activity generate fails", async () => {
    const onApplyGameActivity = vi.fn();
    const onGenerateGameActivity = vi.fn().mockResolvedValue({
      ok: false,
      error: "Generated activity needs review: bad payload",
    });
    const view = renderPanel({
      block: templateChallenge,
      gameActivity: templateActivity,
      onGenerateGameActivity,
      onApplyGameActivity,
    });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(
        view.getByText("Generated activity needs review: bad payload"),
      ).toBeTruthy();
    });
    expect(onApplyGameActivity).not.toHaveBeenCalled();
  });

  it("does not show Generate with AI for non-Simulation, non-Challenge blocks", () => {
    const view = renderPanel({
      block: createBlock("reading", "en"),
      onGenerateSimulation: vi.fn(),
      onGenerateGameActivity: vi.fn(),
      onApplyGameActivity: vi.fn(),
      gameActivity: templateActivity,
    });

    expect(view.queryByRole("button", { name: "Generate with AI" })).toBeNull();
  });
});
