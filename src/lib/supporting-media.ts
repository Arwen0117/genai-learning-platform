import type { SupportingMedia } from "@/lib/blocks/schema";
import {
  CHALLENGE_MAX_ANIMATION_SECONDS,
  clampAnimationDuration,
} from "@/lib/supporting-media-duration";

export type SupportingMediaDraftInput = {
  kind: "image" | "animation";
  prompt: string;
  decorative?: boolean;
  altText?: string;
  durationSeconds?: number;
  /** Context max for animation drafts; Challenge default is 5s. */
  maxDurationSeconds?: number;
};

export type SupportingMediaProvider = {
  /** Generate a draft asset URL for instructor review. */
  generateDraft: (input: SupportingMediaDraftInput) => Promise<{
    url: string;
    model: string;
  }>;
};

/** Local/dev provider that stores drafts under a public media path. */
export const localSupportingMediaProvider: SupportingMediaProvider = {
  async generateDraft(input) {
    const slug = input.prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 48);
    const extension = input.kind === "animation" ? "mp4" : "png";
    return {
      url: `/media/drafts/${slug || "supporting-media"}.${extension}`,
      model: "local-draft-v1",
    };
  },
};

const unsafePatterns =
  /\b(?:nude|nsfw|gore|self-harm|weapon|exploit|phishing)\b/iu;

/**
 * Lightweight safety gate for model-generated drafts. Rejected media stays
 * pending/failed and cannot be published to learners.
 */
export function moderateSupportingMediaDraft(input: {
  prompt: string;
  altText?: string;
}): { status: "passed" | "failed"; reasons: string[] } {
  const haystack = `${input.prompt}\n${input.altText ?? ""}`;
  if (unsafePatterns.test(haystack)) {
    return {
      status: "failed",
      reasons: ["Supporting media failed safety moderation."],
    };
  }
  return { status: "passed", reasons: [] };
}

export async function createSupportingMediaDraft(
  input: SupportingMediaDraftInput,
  provider: SupportingMediaProvider = localSupportingMediaProvider,
): Promise<SupportingMedia> {
  const moderation = moderateSupportingMediaDraft({
    prompt: input.prompt,
    altText: input.altText,
  });
  const draft = await provider.generateDraft(input);
  const base = {
    url: draft.url,
    approvalStatus: "pending" as const,
    moderationStatus: moderation.status,
    provenance: {
      source: "model-generated" as const,
      model: draft.model,
      generatedAt: new Date().toISOString(),
    },
    decorative: input.decorative === true,
    ...(input.decorative === true || input.altText === undefined
      ? {}
      : { altText: input.altText }),
  };

  if (input.kind === "animation") {
    const maxDurationSeconds =
      input.maxDurationSeconds ?? CHALLENGE_MAX_ANIMATION_SECONDS;
    return {
      ...base,
      kind: "animation",
      durationSeconds: clampAnimationDuration(
        input.durationSeconds,
        maxDurationSeconds,
      ),
    };
  }

  return { ...base, kind: "image" };
}

export function approveSupportingMedia(
  media: SupportingMedia,
): SupportingMedia {
  if (media.moderationStatus !== "passed") {
    throw new Error("Supporting media must pass moderation before approval.");
  }
  if (!media.decorative && media.altText === undefined) {
    throw new Error(
      "Supporting media needs editable alt text or a decorative designation.",
    );
  }
  return { ...media, approvalStatus: "approved" };
}

export function rejectSupportingMedia(media: SupportingMedia): SupportingMedia {
  return { ...media, approvalStatus: "rejected" };
}

/** Learner-facing gate: only approved, moderated media is visible. */
export function isLearnerVisibleSupportingMedia(
  media: SupportingMedia | undefined,
): media is SupportingMedia {
  return (
    media !== undefined &&
    media.approvalStatus === "approved" &&
    media.moderationStatus === "passed"
  );
}
