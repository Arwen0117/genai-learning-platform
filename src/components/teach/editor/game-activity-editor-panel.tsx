"use client";

import { ArrowDown, ArrowUp, Copy, Trash2, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GameActivityContainer } from "@/lib/game-activity";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { swapItems } from "./editor-utils";

export type GameActivityEditorPanelProps = {
  activity: GameActivityContainer | undefined;
  challengeIssues: Record<string, string[]>;
  errors: string[];
  selectedChallengeId: string | null;
  onChange: (activity: GameActivityContainer) => void;
  onSelectChallenge: (challengeId: string) => void;
};

export function GameActivityEditorPanel({
  activity,
  errors,
  selectedChallengeId,
  challengeIssues,
  onChange,
  onSelectChallenge,
}: GameActivityEditorPanelProps) {
  const t = useT();

  if (activity === undefined) return null;
  const currentActivity = activity;

  function update(patch: Partial<GameActivityContainer>): void {
    onChange({ ...currentActivity, ...patch });
  }

  return (
    <section className="space-y-3 rounded-xl p-3 ring-1 ring-primary/30">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {t("editor.gameActivity.title")}
        </p>
        <Badge variant="secondary">
          {t("editor.gameActivity.count", { count: activity.challenges.length })}
        </Badge>
      </div>

      <Input
        aria-label={t("editor.gameActivity.titleAria")}
        onChange={(event) => {
          update({ title: event.target.value });
        }}
        placeholder={t("editor.gameActivity.titlePlaceholder")}
        value={activity.title}
      />

      {errors.map((error) => (
        <p
          className="flex items-start gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-700"
          key={error}
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ))}

      <ul className="space-y-1.5">
        {activity.challenges.map((challenge, index) => (
          <li key={challenge.id}>
            <div
              className={cn(
                "rounded-lg px-2 py-1.5 ring-1 transition-colors",
                selectedChallengeId === challenge.id
                  ? "bg-primary/5 ring-primary/50"
                  : "ring-foreground/10 hover:bg-muted/40",
              )}
              data-testid={`challenge-${index + 1}`}
            >
              <div className="flex items-start gap-1.5">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    onSelectChallenge(challenge.id);
                  }}
                  type="button"
                >
                  <span className="block truncate text-xs font-medium">
                    {challenge.title}
                  </span>
                  <span className="block text-[10px] capitalize text-muted-foreground">
                    {challenge.payload.variant}
                  </span>
                </button>
                <div className="flex shrink-0 items-center">
                  <Button
                    aria-label={t("editor.gameActivity.moveUp", { index: index + 1 })}
                    disabled={index === 0}
                    onClick={() => {
                      update({ challenges: swapItems(activity.challenges, index, -1) });
                    }}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    aria-label={t("editor.gameActivity.moveDown", { index: index + 1 })}
                    disabled={index === activity.challenges.length - 1}
                    onClick={() => {
                      update({ challenges: swapItems(activity.challenges, index, 1) });
                    }}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    aria-label={t("editor.gameActivity.duplicate", { index: index + 1 })}
                    onClick={() => {
                      const copy = structuredClone(challenge);
                      copy.id = crypto.randomUUID();
                      copy.title = `${challenge.title}${t("editor.gameActivity.copySuffix")}`;
                      update({
                        challenges: [
                          ...activity.challenges.slice(0, index + 1),
                          copy,
                          ...activity.challenges.slice(index + 1),
                        ],
                      });
                    }}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <Copy aria-hidden="true" />
                  </Button>
                  <Button
                    aria-label={t("editor.gameActivity.delete", { index: index + 1 })}
                    onClick={() => {
                      update({
                        challenges: activity.challenges.filter(
                          (entry) => entry.id !== challenge.id,
                        ),
                      });
                    }}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                {(challengeIssues[challenge.id] ?? []).map((error) => (
                  <p className="mt-1 text-[10px] text-red-600" key={error}>
                    {error}
                  </p>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
