"use client";

import { useEffect, useState } from "react";

import type {
  BlockRenderProps,
  GameBlock as GameBlockData,
  GameChallengeBlock,
} from "@/lib/blocks/schema";
import { useT } from "@/i18n/client";
import { CHALLENGE_MAX_ANIMATION_SECONDS } from "@/lib/supporting-media-duration";
import { loadLatestGamePlaythrough } from "@/server/activities";
import { ChooseGame } from "./ChooseGame";
import { MatchGame } from "./MatchGame";
import { SortGame } from "./SortGame";
import { ProgrammingActivity } from "./programming-game/ProgrammingActivity";
import { SupportingMediaView } from "./SupportingMediaView";

export type GameRecovery = {
  attempts: Array<{ answer: Record<string, unknown>; completed: boolean }>;
  playthroughId?: string | null;
};

/**
 * Game Activity Challenge dispatcher for the supported interaction formats.
 *
 * It owns the two things the games should not know about — which lesson they
 * belong to and how a finished run is recorded — and hands the puzzle itself
 * down as plain data.
 */
export function GameBlock(props: BlockRenderProps<GameBlockData>) {
  const { block, context } = props;
  if (block.payload.variant === "programming") return <ProgrammingActivity payload={block.payload} title={block.title} blockId={block.id} lessonId={context.lessonId} preview={context.preview === true} />;
  return <ChallengeGameBlock {...props} block={{ ...block, payload: block.payload }} />;
}

function ChallengeGameBlock({
  block,
  completed,
  onAttempt,
  onComplete,
  context,
}: BlockRenderProps<GameChallengeBlock>) {
  const { payload } = block;
  const t = useT();
  const [recoveryReady, setRecoveryReady] = useState(context.preview === true);
  const [recovery, setRecovery] = useState<GameRecovery>();

  useEffect(() => {
    if (context.preview) return;
    void loadLatestGamePlaythrough(context.lessonId, block.id).then((result) => {
      if (result.ok && (result.attempts.length > 0 || result.playthroughId))
        setRecovery({
          attempts: result.attempts,
          playthroughId: result.playthroughId,
        });
      setRecoveryReady(true);
    });
  }, [block.id, context.lessonId, context.preview]);

  if (!recoveryReady) {
    return <p className="text-sm text-muted-foreground">{t("block.renderer.saving")}</p>;
  }

  const supportingMedia = payload.supportingMedia;

  function handleFinish(stats: Record<string, unknown>): void {
    onAttempt?.({
      answer: stats,
      feedback:
        stats.kind === "hint"
          ? { kind: "hint", playthrough: stats.playthrough }
          : {},
    });
  }

  if (payload.variant === "sort") {
    return (
      <>
        <SupportingMediaView
          maxDurationSeconds={CHALLENGE_MAX_ANIMATION_SECONDS}
          media={supportingMedia}
        />
        <SortGame
          completed={completed}
          feedback={payload.feedback}
          hint={payload.hint}
          items={payload.items}
          onComplete={() => {
            onComplete(block.id);
          }}
          onFinish={handleFinish}
          recovery={recovery}
        />
      </>
    );
  }

  if (payload.variant === "choose") {
    return (
      <>
        <SupportingMediaView
          maxDurationSeconds={CHALLENGE_MAX_ANIMATION_SECONDS}
          media={supportingMedia}
        />
        <ChooseGame
          completed={completed}
          onComplete={() => {
            onComplete(block.id);
          }}
          onFinish={handleFinish}
          options={payload.options}
          prompt={payload.prompt}
          feedback={payload.feedback}
          hint={payload.hint}
          recovery={recovery}
        />
      </>
    );
  }

  return (
    <>
      <SupportingMediaView
        maxDurationSeconds={CHALLENGE_MAX_ANIMATION_SECONDS}
        media={supportingMedia}
      />
      <MatchGame
        completed={completed}
        onComplete={() => {
          onComplete(block.id);
        }}
        onFinish={handleFinish}
        pairs={payload.pairs}
        feedback={payload.feedback}
        hint={payload.hint}
        recovery={recovery}
      />
    </>
  );
}
