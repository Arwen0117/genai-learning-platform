"use client";

import { Loader2, Sparkles, Trash2, TriangleAlert } from "lucide-react";

import { useState } from "react";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import {
  blockSchema,
  type SimulationBlock,
} from "@/lib/blocks/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n, useT } from "@/i18n/client";
import { blockMetaFor } from "@/lib/blocks/meta";
import type { Block } from "@/lib/blocks/schema";
import type { GameActivityContainer } from "@/lib/game-activity";
import {
  isTemplateGameActivity,
  isTemplateSimulationBlock,
} from "./block-templates";
import { BlockForm } from "./block-form";

/**
 * Right column of the course editor (P5.1): the form of the selected block.
 *
 * The panel is keyed by block id (`BlockForm key` below), so switching blocks
 * resets the form-local state — the reading preview tab, the simulation JSON
 * textarea — instead of carrying one block's draft into another.
 *
 * Generate with AI appears here for Simulation Blocks and for Game Activity
 * Challenges (whole-activity refill), matching the selected-block editing flow.
 */

export type SimulationGenerateResult =
  | { ok: true; block: SimulationBlock }
  | { ok: false; error: string };

export type GameActivityGenerateResult =
  | { ok: true; activity: GameActivityContainer }
  | { ok: false; error: string };

export type BlockEditorPanelProps = {
  block: Block | null;
  errors: string[];
  onChange: (next: Block) => void;
  onProblem: (message: string | null) => void;
  onDelete: () => void;
  /** Lesson-scoped Simulation generate; only used when a Simulation is selected. */
  onGenerateSimulation?: () => Promise<SimulationGenerateResult>;
  /**
   * Current lesson Game Activity (for confirm-before-replace). Generate applies
   * the whole five-Challenge container via `onApplyGameActivity`.
   */
  gameActivity?: GameActivityContainer;
  onGenerateGameActivity?: () => Promise<GameActivityGenerateResult>;
  onApplyGameActivity?: (activity: GameActivityContainer) => void;
};

export function BlockEditorPanel(props: BlockEditorPanelProps) {
  const {
    block,
    errors,
    onChange,
    onProblem,
    onDelete,
    onGenerateSimulation,
    gameActivity,
    onGenerateGameActivity,
    onApplyGameActivity,
  } = props;
  const t = useT();
  const { locale } = useI18n();
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  if (block === null) {
    return (
      <aside className="self-start rounded-xl p-4 ring-1 ring-foreground/10">
        <p className="text-sm font-medium">{t("editor.blockEditor.nothing")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("editor.blockEditor.nothingHint")}
        </p>
      </aside>
    );
  }

  const meta = blockMetaFor(block.type);
  const canGenerateSimulation =
    block.type === "simulation" && onGenerateSimulation !== undefined;
  const canGenerateGameActivity =
    block.type === "game" &&
    onGenerateGameActivity !== undefined &&
    onApplyGameActivity !== undefined;
  const canGenerate = canGenerateSimulation || canGenerateGameActivity;

  async function handleGenerate(): Promise<void> {
    if (block === null || generating || !canGenerate) {
      return;
    }

    if (block.type === "simulation" && onGenerateSimulation !== undefined) {
      const needsConfirm = !isTemplateSimulationBlock(block, locale);
      if (needsConfirm && !window.confirm(t("editor.generate.confirmReplace"))) {
        return;
      }

      setGenerating(true);
      setGenerateError(null);
      try {
        const result = await onGenerateSimulation();
        if (result.ok) {
          onChange({ ...result.block, id: block.id });
          return;
        }
        setGenerateError(result.error);
      } finally {
        setGenerating(false);
      }
      return;
    }

    if (
      block.type === "game" &&
      onGenerateGameActivity !== undefined &&
      onApplyGameActivity !== undefined
    ) {
      const needsConfirm =
        gameActivity !== undefined &&
        !isTemplateGameActivity(gameActivity, locale);
      if (needsConfirm && !window.confirm(t("editor.generate.confirmReplace"))) {
        return;
      }

      setGenerating(true);
      setGenerateError(null);
      try {
        const result = await onGenerateGameActivity();
        if (result.ok) {
          onApplyGameActivity(result.activity);
          return;
        }
        setGenerateError(result.error);
      } finally {
        setGenerating(false);
      }
    }
  }

  return (
    <aside className="space-y-3 self-start rounded-xl p-3 ring-1 ring-foreground/10 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("editor.blockEditor.title")}
        </p>
        <div className="flex items-center gap-2">
          {canGenerate ? (
            <Button
              disabled={generating}
              onClick={() => {
                void handleGenerate();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {generating ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {generating
                ? t("editor.generate.busy")
                : t("editor.generate.withAi")}
            </Button>
          ) : null}
          <Badge variant="outline">{t(meta.labelKey)}</Badge>
        </div>
      </div>

      {errors.length === 0 ? null : (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-700">
          <p className="flex items-center gap-1 font-medium">
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            {t("editor.blockEditor.invalid")}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {generateError === null ? null : (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-700">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {generateError}
        </p>
      )}

      <Input
        aria-label={t("editor.blockEditor.titleAria")}
        onChange={(event) => {
          onChange({ ...block, title: event.target.value });
        }}
        placeholder={t("editor.blockEditor.titlePlaceholder")}
        value={block.title}
      />

      <BlockForm
        block={block}
        key={block.id}
        onChange={onChange}
        onProblem={onProblem}
      />

      <Button
        size="sm"
        variant="outline"
        onClick={() => setPreviewing((v) => !v)}
      >
        {t("activity.preview")}
      </Button>
      {previewing ? (
        blockSchema.safeParse(block).success ? (
          <BlockRenderer
            key={JSON.stringify(block)}
            block={block}
            courseId="preview"
            lessonId="preview"
            preview
          />
        ) : (
          <p className="text-xs text-destructive">
            {t("activity.previewInvalid")}
          </p>
        )
      ) : null}
      <div className="border-t pt-2">
        <Button onClick={onDelete} size="sm" variant="ghost">
          <Trash2 aria-hidden="true" />
          {t("editor.blockEditor.delete")}
        </Button>
      </div>
    </aside>
  );
}
