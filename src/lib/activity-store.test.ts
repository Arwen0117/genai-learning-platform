import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({
  transaction: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  progress: vi.fn(),
  upsert: vi.fn(),
  list: vi.fn(),
  event: vi.fn(),
  count: vi.fn(),
  enrollment: vi.fn(),
  playthroughFind: vi.fn(),
  playthroughCreate: vi.fn(),
  playthroughUpdate: vi.fn(),
  versionFind: vi.fn(),
  versionUnique: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }));
import { contentVersionForBlock, persistActivity } from "./activity-store";
import type { Block } from "./blocks/schema";
const block: Block = {
  id: "g",
  title: "Game",
  type: "game",
  payload: {
    variant: "sort",
    items: [
      { text: "A", order: 0 },
      { text: "B", order: 1 },
    ],
  },
};
const input = {
  userId: "u",
  courseId: "c",
  lessonId: "l",
  block,
  blocks: [block],
  activityBlocks: [block],
  activityId: "activity-1",
  attemptId: "attempt",
  answer: { order: [0, 1] },
  grade: {
    completed: true,
    passed: true,
    verification: "server" as const,
    feedback: {},
    score: { raw: 2, min: 0, max: 2, normalized: 1 },
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation((fn) =>
    fn({
      activityAttempt: {
        findUnique: m.find,
        create: m.create,
        findMany: m.list,
      },
      lessonProgress: { findUnique: m.progress, upsert: m.upsert },
      engagementEvent: { create: m.event },
      lesson: { count: m.count },
      enrollment: { updateMany: m.enrollment },
      playthrough: {
        findFirst: m.playthroughFind,
        create: m.playthroughCreate,
        update: m.playthroughUpdate,
      },
      gameActivityVersion: {
        findFirst: m.versionFind,
        findUnique: m.versionUnique,
      },
    }),
  );
  m.find.mockResolvedValue(null);
  m.create.mockResolvedValue({ id: "saved" });
  m.progress.mockResolvedValue(null);
  m.list.mockResolvedValue([
    { blockId: "g", result: { score: { normalized: 1 } } },
  ]);
  m.count.mockResolvedValue(0);
  m.playthroughFind.mockResolvedValue(null);
  m.playthroughCreate.mockResolvedValue({
    id: "server-playthrough-1",
    publishedVersionId: "version-1",
  });
  m.versionFind.mockResolvedValue({
    id: "version-1",
    contentHash: "activity-hash",
    snapshot: {
      id: "activity-1",
      title: "Practice",
      challenges: [block],
    },
  });
  m.versionUnique.mockResolvedValue({
    id: "version-1",
    contentHash: "activity-hash",
    snapshot: {
      id: "activity-1",
      title: "Practice",
      challenges: [block],
    },
  });
});
describe("atomic activity persistence", () => {
  it("saves answer, feedback and snapshot; uses game events rather than quiz events", async () => {
    await persistActivity(input);
    expect(m.create.mock.calls[0][0].data.result).toMatchObject({
      version: 1,
      answer: input.answer,
      activitySnapshot: block,
      activityId: "activity-1",
      attempted: true,
      score: { normalized: 1 },
      contentVersion: expect.stringMatching(/^[a-f0-9]{16}$/),
      firstPass: true,
    });
    expect(m.event.mock.calls[0][0].data.payload).toMatchObject({
      activityId: "activity-1",
    });
    expect(m.playthroughCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activityId: "activity-1",
        publishedVersionId: "version-1",
        contentHash: "activity-hash",
      }),
    });
    expect(m.create.mock.calls[0][0].data.playthroughId).toBe(
      "server-playthrough-1",
    );
    expect(m.create.mock.calls[0][0].data.result.playthroughId).toBe(
      "server-playthrough-1",
    );
    expect(m.event.mock.calls.map((c) => c[0].data.type)).toEqual([
      "GAME_FINISH",
      "BLOCK_COMPLETE",
    ]);
    expect(m.enrollment).toHaveBeenCalledOnce();
  });
  it("deduplicates retries without duplicate completions or events", async () => {
    m.find.mockResolvedValue({ id: "previous" });
    expect(await persistActivity(input)).toEqual({ id: "previous" });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.event).not.toHaveBeenCalled();
  });
  it("preserves previous completed blocks and emits BLOCK_COMPLETE only once", async () => {
    m.progress.mockResolvedValue({ completedBlocks: ["other", "g"] });
    await persistActivity(input);
    expect(m.upsert.mock.calls[0][0].update.completedBlocks).toEqual([
      "other",
      "g",
    ]);
    expect(m.event.mock.calls.map((c) => c[0].data.type)).toEqual([
      "GAME_FINISH",
    ]);
  });
  it("completes a Playthrough from its Challenges, not unrelated lesson blocks", async () => {
    const reading = {
      id: "reading",
      title: "Reading",
      type: "reading" as const,
      payload: { markdown: "Read this first." },
    };

    await persistActivity({
      ...input,
      blocks: [reading, block],
      activityBlocks: [block],
    });
    expect(m.playthroughUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "COMPLETED", completedAt: expect.any(Date) },
      }),
    );
  });
  it("completes a multi-Challenge Playthrough from all current-version Challenges", async () => {
    const secondChallenge = { ...block, id: "second-challenge" };
    m.list
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          blockId: "g",
          result: {
            playthroughId: "server-playthrough-1",
            completed: true,
            contentVersion: contentVersionForBlock(block),
          },
        },
        {
          blockId: "second-challenge",
          result: {
            playthroughId: "server-playthrough-1",
            completed: true,
            contentVersion: contentVersionForBlock(secondChallenge),
          },
        },
      ]);

    await persistActivity({
      ...input,
      activityBlocks: [block, secondChallenge],
    });

    expect(m.playthroughUpdate).toHaveBeenCalled();
  });
  it("keeps a replay Playthrough in progress despite cumulative lesson completion", async () => {
    m.playthroughCreate
      .mockResolvedValueOnce({ id: "original-playthrough" })
      .mockResolvedValueOnce({ id: "replay-playthrough" });
    m.list.mockResolvedValue([
      {
        blockId: "g",
        result: {
          playthroughId: "original-playthrough",
          completed: true,
        },
      },
    ]);

    await persistActivity({
      ...input,
      answer: { kind: "replay", playthroughId: "client-replay" },
    });

    expect(m.playthroughUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "replay-playthrough" },
      }),
    );
  });
  it("aggregates latest normalized score per activity, rather than overwriting with the last submission", async () => {
    m.list.mockResolvedValue([
      { blockId: "g", result: { score: { normalized: 0.5 } } },
      { blockId: "other", result: { score: { normalized: 1 } } },
      { blockId: "g", result: { score: { normalized: 0 } } },
    ]);
    await persistActivity({
      ...input,
      blocks: [block, { ...block, id: "other" }],
    });
    expect(m.upsert.mock.calls[0][0].update.score).toBe(0.75);
  });
  it("retries serialization conflicts within a bounded transaction loop", async () => {
    m.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("conflict", {
        code: "P2034",
        clientVersion: "6",
      }),
    );
    await persistActivity(input);
    expect(m.transaction).toHaveBeenCalledTimes(2);
    expect(m.transaction.mock.calls[1][1].isolationLevel).toBe("Serializable");
  });
  it("propagates failed writes so the learner can retry", async () => {
    m.create.mockRejectedValue(new Error("offline"));
    await expect(persistActivity(input)).rejects.toThrow("offline");
    expect(m.event).not.toHaveBeenCalled();
  });

  it("keeps a different content version separate from earlier history", async () => {
    await persistActivity({
      ...input,
      answer: { ...input.answer, playthroughId: "run-1" },
    });
    const firstVersion = m.create.mock.calls[0][0].data.result.contentVersion;
    m.create.mockClear();
    m.list.mockResolvedValue([]);

    await persistActivity({
      ...input,
      block: { ...block, title: "Revised game" },
      answer: { ...input.answer, playthroughId: "run-2" },
    });

    expect(m.create.mock.calls[0][0].data.result.contentVersion).not.toBe(
      firstVersion,
    );
    expect(m.create.mock.calls[0][0].data.result.activitySnapshot.title).toBe(
      "Revised game",
    );
  });

  it("keeps the first substantive submission first-pass after a replay marker", async () => {
    m.list.mockResolvedValue([
      {
        blockId: "g",
        result: {
          contentVersion: contentVersionForBlock(block),
          playthroughId: "server-playthrough-1",
          answer: { kind: "replay" },
        },
      },
    ]);

    await persistActivity({
      ...input,
      answer: {
        ...input.answer,
        playthroughId: "run-2",
      },
    });

    expect(m.create.mock.calls[0][0].data.result).toMatchObject({
      firstPass: true,
      attemptNumber: 2,
    });
  });

  it("does not mark hints as substantive attempts", async () => {
    await persistActivity({
      ...input,
      answer: { kind: "hint" },
      grade: {
        ...input.grade,
        completed: false,
        passed: null,
        verification: "ungraded",
        feedback: { kind: "hint" },
      },
    });

    expect(m.create.mock.calls[0][0].data.result).toMatchObject({
      attempted: false,
      firstPass: false,
      attemptNumber: 1,
    });
  });

  it("uses the persisted attempted flag for hints with a normal answer payload", async () => {
    m.list.mockResolvedValue([
      {
        blockId: "g",
        result: {
          attempted: false,
          answer: { variant: "choose", option: 0 },
        },
      },
    ]);

    await persistActivity({
      ...input,
      answer: { variant: "choose", option: 0 },
      grade: {
        ...input.grade,
        feedback: { kind: "hint" },
      },
    });

    m.create.mockClear();
    await persistActivity({
      ...input,
      answer: { variant: "choose", option: 0 },
      attemptId: "second-attempt",
    });

    expect(m.create.mock.calls[0][0].data.result.firstPass).toBe(true);
  });
});

// New variant must keep the same atomic completion and event guarantees.
describe("programming attempt events", () => {
  it("records an unsuccessful programming run without completing its block", async () => {
    const { createProgrammingPayload } = await import("./programming-game/config");
    const game: Block = { ...block, type: "game", payload: createProgrammingPayload("first-route", "en") };
    m.list.mockResolvedValue([{ blockId: "g", result: { score: { normalized: 0 } } }]);
    await persistActivity({ ...input, block: game, blocks: [game], grade: {
      ...input.grade, completed: false, passed: false,
      score: { raw: 0, min: 0, max: 100, normalized: 0 }, feedback: { variant: "programming", status: "error" },
    } });
    expect(m.upsert.mock.calls[0][0].update.completedBlocks).toEqual([]);
    expect(m.event.mock.calls.map((c) => c[0].data.type)).toEqual(["GAME_ATTEMPT"]);
    expect(m.event.mock.calls[0][0].data.payload.variant).toBe("programming");
  });
  it("keeps an earlier completion when a later programming run fails", async () => {
    const { createProgrammingPayload } = await import("./programming-game/config");
    const game: Block = { ...block, type: "game", payload: createProgrammingPayload("first-route", "en") };
    m.progress.mockResolvedValue({ completedBlocks: ["g"] });
    m.list.mockResolvedValue([{ blockId: "g", result: { score: { normalized: 0 } } }]);
    await persistActivity({ ...input, block: game, blocks: [game], grade: { ...input.grade, completed: false, passed: false, feedback: { variant: "programming" } } });
    expect(m.upsert.mock.calls[0][0].update.completedBlocks).toEqual(["g"]);
    expect(m.event.mock.calls.map((c) => c[0].data.type)).toEqual(["GAME_ATTEMPT"]);
  });
});

describe("v2 persistence boundary", () => {
  it("deduplicates simultaneous same-ID attempts after a unique-constraint retry", async () => {
    const { createParallelProgrammingPayload } = await import("./programming-game/parallel-config");
    const { gradeActivity } = await import("./blocks/activity-result");
    const game: Block = { ...block, payload: createParallelProgrammingPayload("parallel-lanes", "en") };
    const answer = { program: [{ op: "repeat", count: 4, body: [{ op: "right" }] }] };
    const request = { ...input, block: game, blocks: [game], answer, grade: gradeActivity(game, answer) };
    let saved: { id: string; result: unknown } | null = null;
    m.find.mockImplementation(async () => saved);
    m.create.mockImplementation(async ({ data }) => {
      if (saved) throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" });
      saved = { id: "v2-winner", result: data.result }; return saved;
    });
    const results = await Promise.all([persistActivity(request), persistActivity(request)]);
    expect(results.map((r) => r.id)).toEqual(["v2-winner", "v2-winner"]);
    expect(m.upsert).toHaveBeenCalledOnce();
    expect(m.event.mock.calls.map((c) => c[0].data.type)).toEqual(["GAME_FINISH", "BLOCK_COMPLETE"]);
    expect(m.create.mock.calls[0][0].data.result).toMatchObject({ version: 1, feedback: { feedbackVersion: 2 }, activitySnapshot: game });
  });
  it("does not revoke an earlier v2 completion after a new failed attempt", async () => {
    const { createParallelProgrammingPayload } = await import("./programming-game/parallel-config");
    const { gradeActivity } = await import("./blocks/activity-result");
    const game: Block = { ...block, payload: createParallelProgrammingPayload("parallel-lanes", "en") };
    const answer = { program: [{ op: "left" }] };
    m.progress.mockResolvedValue({ completedBlocks: ["g"] });
    m.list.mockResolvedValue([{ blockId: "g", result: { score: { normalized: 0 } } }]);
    await persistActivity({ ...input, block: game, blocks: [game], answer, grade: gradeActivity(game, answer) });
    expect(m.upsert.mock.calls[0][0].update.completedBlocks).toEqual(["g"]);
    expect(m.upsert.mock.calls[0][0].update.score).toBe(0);
    expect(m.event.mock.calls.map((c) => c[0].data.type)).toEqual(["GAME_ATTEMPT"]);
  });
});
