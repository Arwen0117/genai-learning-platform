import { describe, expect, it, vi } from "vitest";

import { mockGameActivity } from "@/lib/llm/prompts/game-activity";
import {
  contentHashForGameActivity,
  ensurePublishedGameActivityVersion,
} from "./game-activity-version";

describe("published Game Activity versions", () => {
  it("creates a new version when the published snapshot changes", async () => {
    const activity = mockGameActivity("en");
    const hash = contentHashForGameActivity(activity);
    const findFirst = vi.fn().mockResolvedValue({
      id: "v1",
      version: 1,
      contentHash: "old-hash",
    });
    const create = vi.fn().mockResolvedValue({ id: "v2", version: 2 });

    const result = await ensurePublishedGameActivityVersion({
      tx: { gameActivityVersion: { findFirst, create } },
      lessonId: "lesson-1",
      activity,
      contentHash: hash,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lessonId: "lesson-1",
        activityId: activity.id,
        version: 2,
        contentHash: hash,
        snapshot: activity,
      }),
    });
    expect(result).toEqual({ id: "v2", version: 2, contentHash: hash });
  });

  it("reuses the latest version when the content hash is unchanged", async () => {
    const activity = mockGameActivity("en");
    const hash = contentHashForGameActivity(activity);
    const findFirst = vi.fn().mockResolvedValue({
      id: "v1",
      version: 1,
      contentHash: hash,
    });
    const create = vi.fn();

    const result = await ensurePublishedGameActivityVersion({
      tx: { gameActivityVersion: { findFirst, create } },
      lessonId: "lesson-1",
      activity,
      contentHash: hash,
    });

    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "v1", version: 1, contentHash: hash });
  });
});
