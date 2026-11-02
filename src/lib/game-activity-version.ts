import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

import type { GameActivityContainer } from "@/lib/game-activity";

export function contentHashForGameActivity(
  activity: GameActivityContainer,
): string {
  return createHash("sha256")
    .update(JSON.stringify(activity))
    .digest("hex")
    .slice(0, 16);
}

type VersionClient = {
  findFirst: (args: unknown) => Promise<{
    id: string;
    version: number;
    contentHash: string;
  } | null>;
  create: (args: unknown) => Promise<{ id: string; version: number }>;
};

/**
 * Creates a new immutable published version when the Game Activity snapshot
 * changes. Historical Playthroughs keep pointing at the version they used.
 */
export async function ensurePublishedGameActivityVersion(input: {
  // Accept the Prisma transaction client without coupling to its full generics.
  tx: unknown;
  lessonId: string;
  activity: GameActivityContainer;
  contentHash: string;
}): Promise<{ id: string; version: number; contentHash: string } | null> {
  const client = (input.tx as { gameActivityVersion?: VersionClient })
    .gameActivityVersion;
  if (client === undefined) return null;

  const latest = await client.findFirst({
    where: {
      lessonId: input.lessonId,
      activityId: input.activity.id,
    },
    orderBy: [{ version: "desc" }, { id: "desc" }],
    select: { id: true, version: true, contentHash: true },
  });

  if (latest?.contentHash === input.contentHash) {
    return latest;
  }

  const created = await client.create({
    data: {
      lessonId: input.lessonId,
      activityId: input.activity.id,
      version: (latest?.version ?? 0) + 1,
      contentHash: input.contentHash,
      snapshot: JSON.parse(
        JSON.stringify(input.activity),
      ) as Prisma.InputJsonValue,
    },
  });

  return {
    id: created.id,
    version: created.version,
    contentHash: input.contentHash,
  };
}
