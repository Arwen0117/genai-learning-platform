// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/en.json";
import { I18nProvider } from "@/i18n/client";
import type { SimulationBlock } from "@/lib/blocks/schema";
import { mockSimulationBlock } from "@/lib/llm/prompts/simulation-block";
import { createBlock } from "./block-templates";

vi.mock("@/components/blocks/BlockRenderer", () => ({
  BlockRenderer: () => null,
}));

import { BlockEditorPanel } from "./block-editor-panel";

const templateSimulation = createBlock("simulation", "en") as SimulationBlock;
const generated = mockSimulationBlock("en");

function renderSimulationPanel({
  block = templateSimulation,
  onChange = vi.fn(),
  onGenerateSimulation,
}: {
  block?: SimulationBlock;
  onChange?: ReturnType<typeof vi.fn>;
  onGenerateSimulation?: () => Promise<
    { ok: true; block: SimulationBlock } | { ok: false; error: string }
  >;
} = {}) {
  return render(
    <I18nProvider locale="en" messages={en}>
      <BlockEditorPanel
        block={block}
        errors={[]}
        onChange={onChange}
        onDelete={vi.fn()}
        onGenerateSimulation={onGenerateSimulation}
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
      block: generated,
    });
    const confirmSpy = vi.spyOn(window, "confirm");
    const view = renderSimulationPanel({ onChange, onGenerateSimulation });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(onGenerateSimulation).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith({
        ...generated,
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
      block: generated,
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = renderSimulationPanel({
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
    const view = renderSimulationPanel({ onChange, onGenerateSimulation });

    fireEvent.click(view.getByRole("button", { name: "Generate with AI" }));

    await waitFor(() => {
      expect(
        view.getByText("The lesson came back in the wrong format."),
      ).toBeTruthy();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not show Generate with AI for non-Simulation blocks", () => {
    const view = render(
      <I18nProvider locale="en" messages={en}>
        <BlockEditorPanel
          block={createBlock("reading", "en")}
          errors={[]}
          onChange={vi.fn()}
          onDelete={vi.fn()}
          onGenerateSimulation={vi.fn()}
          onProblem={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(view.queryByRole("button", { name: "Generate with AI" })).toBeNull();
  });
});
