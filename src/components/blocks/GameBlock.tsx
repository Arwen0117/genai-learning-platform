"use client";

import type {
  BlockRenderProps,
  GameBlock as GameBlockData,
} from "@/lib/blocks/schema";
import { MatchGame } from "./MatchGame";
import { SortGame } from "./SortGame";
import { ProgrammingActivity } from "./programming-game/ProgrammingActivity";

/**
 * Game block: a thin dispatcher over sorting, matching and programming games.
 *
 * It owns the two things the games should not know about — which lesson they
 * belong to and how a finished run is recorded — and hands the puzzle itself
 * down as plain data.
 */
export function GameBlock({
  block,
  completed,
  onAttempt,
  onComplete,
  context,
}: BlockRenderProps<GameBlockData>) {
  const { payload } = block;

  function handleFinish(stats: Record<string, unknown>): void {
    onAttempt?.({ answer: stats });
  }

  if (payload.variant === "programming") {
    return <ProgrammingActivity payload={payload} title={block.title}
      blockId={block.id} lessonId={context.lessonId} preview={context.preview === true} />;
  }
  if (payload.variant === "sort") {
    return (
      <SortGame
        completed={completed}
        items={payload.items}
        onComplete={() => {
          onComplete(block.id);
        }}
        onFinish={handleFinish}
      />
    );
  }

  return (
    <MatchGame
      completed={completed}
      onComplete={() => {
        onComplete(block.id);
      }}
      onFinish={handleFinish}
      pairs={payload.pairs}
    />
  );
}
