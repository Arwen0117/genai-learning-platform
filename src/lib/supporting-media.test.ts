import { describe, expect, it } from "vitest";

import {
  approveSupportingMedia,
  createSupportingMediaDraft,
  isLearnerVisibleSupportingMedia,
  moderateSupportingMediaDraft,
  rejectSupportingMedia,
} from "./supporting-media";

describe("supporting media lifecycle", () => {
  it("creates model-generated drafts as pending until instructor approval", async () => {
    const draft = await createSupportingMediaDraft({
      kind: "image",
      prompt: "Diagram of an API request flow",
      altText: "Request flow diagram",
    });

    expect(draft).toMatchObject({
      kind: "image",
      approvalStatus: "pending",
      moderationStatus: "passed",
      provenance: {
        source: "model-generated",
        model: "local-draft-v1",
      },
      altText: "Request flow diagram",
    });
    expect(isLearnerVisibleSupportingMedia(draft)).toBe(false);
  });

  it("rejects unsafe drafts in moderation and keeps them learner-invisible", async () => {
    expect(
      moderateSupportingMediaDraft({ prompt: "nsfw illustration" }).status,
    ).toBe("failed");

    const draft = await createSupportingMediaDraft({
      kind: "image",
      prompt: "weapon blueprint",
      decorative: true,
    });
    expect(draft.moderationStatus).toBe("failed");
    expect(() => approveSupportingMedia(draft)).toThrow(/moderation/i);
    expect(isLearnerVisibleSupportingMedia(rejectSupportingMedia(draft))).toBe(
      false,
    );
  });

  it("makes approved media learner-visible and caps animation drafts", async () => {
    const draft = await createSupportingMediaDraft({
      kind: "animation",
      prompt: "Short API handshake animation",
      altText: "Handshake animation",
      durationSeconds: 9,
    });
    expect(draft.kind).toBe("animation");
    if (draft.kind !== "animation") throw new Error("Expected animation");
    expect(draft.durationSeconds).toBe(5);

    const approved = approveSupportingMedia(draft);
    expect(isLearnerVisibleSupportingMedia(approved)).toBe(true);
  });
});
