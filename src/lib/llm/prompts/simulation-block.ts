import { z } from "zod";

import { simulationBlockSchema, type SimulationBlock } from "@/lib/blocks/schema";
import {
  CONTENT_LANGUAGE_LABEL,
  contentLanguageLine,
  type ContentLanguage,
} from "@/lib/llm/language";
import { MOTION_PATTERN_IDS } from "@/lib/simulation-motion";
import { mockText } from "@/lib/llm/mock";

/**
 * Single Simulation Block for editor generate. Rejects Supporting media so the
 * model cannot invent URLs — instructors attach media in the editor.
 */
export const generatedSimulationBlockSchema = simulationBlockSchema.superRefine(
  (block, ctx) => {
    for (const [nodeId, node] of Object.entries(block.payload.nodes)) {
      if (node.supportingMedia !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["payload", "nodes", nodeId, "supportingMedia"],
          message:
            "Generated Simulations must not include Supporting media; instructors attach media in the editor.",
        });
      }
    }
  },
);

export type GeneratedSimulationBlock = z.infer<
  typeof generatedSimulationBlockSchema
>;

export function simulationBlockPrompt(input: {
  lessonTitle: string;
  objectives: string;
  sourceContent: string;
  language: ContentLanguage;
}): string {
  const motionList = MOTION_PATTERN_IDS.join(", ");

  return [
    "Create one Simulation Block for the lesson below.",
    "Return a single branching decision scenario the learner can walk through.",
    "`start` and `end` must be keys of `nodes`; every node except `end` needs at least",
    "one option; the `end` node must set \"options\": [] (empty array, required key).",
    "`score` is a whole number and may be negative.",
    "Include `payload.motion` with catalog pattern ids only",
    `(${motionList}).`,
    "Never invent Supporting media URLs, paths, or media objects — instructors",
    "attach materials in the editor. Do not include supportingMedia on any node.",
    `Write every learner-visible string in ${CONTENT_LANGUAGE_LABEL[input.language]}.`,
    contentLanguageLine(input.language),
    "",
    `Lesson title: ${input.lessonTitle}`,
    `Objectives: ${input.objectives}`,
    `Source content: ${input.sourceContent}`,
    "",
    "Reply with one JSON object of this exact shape:",
    '{"id": string, "title": string, "type": "simulation",',
    ' "payload": {"intro": string, "start": string, "end": string,',
    '   "motion": {"nodeEnter": "fade-up", "choiceSelected": "emphasis-pulse",',
    '     "feedbackReveal": "slide-feedback", "summaryEnter": "summary-rise"},',
    '   "nodes": {"<node id>": {"text": string,',
    '     "options": [{"label": string, "next": string, "feedback": string, "score": number}]},',
    '     "<end id>": {"text": string, "options": []}}}}',
    "Do not use placeholders.",
  ].join("\n");
}

/** Canned Simulation used when no API key is configured. */
export function mockSimulationBlock(language: ContentLanguage): SimulationBlock {
  const zh = language === "zh";

  return {
    id: "mock-simulation-block",
    type: "simulation",
    title: zh ? "处理一次生产告警" : "Handle a production alert",
    payload: {
      intro: mockText(
        zh
          ? "告警刚刚响起。请仔细选择下一步。"
          : "An alert just fired. Choose carefully.",
      ),
      start: "triage",
      end: "done",
      motion: {
        nodeEnter: "fade-up",
        choiceSelected: "emphasis-pulse",
        feedbackReveal: "slide-feedback",
        summaryEnter: "summary-rise",
      },
      nodes: {
        triage: {
          text: zh
            ? "凌晨两点，PagerDuty 在响。"
            : "PagerDuty is ringing at 2am.",
          options: [
            {
              label: zh ? "确认告警并查看仪表盘" : "Acknowledge and check dashboards",
              next: "done",
              feedback: zh
                ? "你在改任何东西之前先收集了证据。"
                : "You gather evidence before changing anything.",
              score: 2,
            },
            {
              label: zh ? "立刻重启服务" : "Restart the service immediately",
              next: "done",
              feedback: zh
                ? "没有证据就重启可能掩盖根因。"
                : "Restarting without evidence can hide the root cause.",
              score: -1,
            },
          ],
        },
        done: {
          text: zh
            ? "你安全地完成了这次处理。"
            : "You closed the loop safely.",
          options: [],
        },
      },
    },
  };
}
