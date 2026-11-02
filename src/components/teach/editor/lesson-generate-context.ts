import type { Block } from "@/lib/blocks/schema";

/** Shared lesson-scoped payload for Game Activity / Simulation editor generate. */
export type LessonGenerateContext = {
  lessonTitle: string;
  objectives: string;
  sourceContent: string;
};

/** Prefer reading markdown as a summary stand-in; fall back to the lesson title. */
function objectivesFromBlocks(title: string, blocks: Block[]): string {
  const reading = blocks.find((block) => block.type === "reading");
  if (reading?.type === "reading") {
    const markdown = reading.payload.markdown.trim();
    if (markdown.length > 0) {
      return markdown.slice(0, 1200);
    }
  }

  const titles = blocks
    .map((block) => block.title.trim())
    .filter((entry) => entry.length > 0);
  if (titles.length > 0) {
    return `${title}: ${titles.join("; ")}`.slice(0, 1200);
  }

  return title;
}

/**
 * Builds lesson-scoped input for editor AI generate actions.
 *
 * Derives objectives/summary from reading content (or block titles) when the
 * editor has no separate summary field, and truncates other blocks' JSON as
 * source content.
 */
export function lessonGenerateContext(lesson: {
  title: string;
  blocks: Block[];
}): LessonGenerateContext {
  const sourceContent = JSON.stringify({
    title: lesson.title,
    blocks: lesson.blocks,
  }).slice(0, 20_000);

  return {
    lessonTitle: lesson.title,
    objectives: objectivesFromBlocks(lesson.title, lesson.blocks),
    sourceContent:
      sourceContent.length >= 20
        ? sourceContent
        : `${lesson.title}\n\nLesson blocks for practice generation.`,
  };
}
