import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/server/activities", () => ({ submitActivity: m.submit }));
import { POST } from "./route";
const body = {
  lessonId: "lesson",
  blockId: "block",
  submission: {
    attemptId: "ad77ae57-789a-4b3c-a723-717ffcd21c63",
    answer: { program: [] },
  },
};
function request(data: unknown = body, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/activities", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
beforeEach(() => vi.resetAllMocks());
describe("activity JSON transport", () => {
  it("returns the server result as uncached JSON", async () => {
    m.submit.mockResolvedValue({
      ok: true,
      id: "saved",
      grade: { completed: true },
    });
    const response = await POST(request());
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      ok: true,
      grade: { completed: true },
    });
    expect(m.submit).toHaveBeenCalledWith("lesson", "block", {
      ...body.submission,
      feedback: {},
    });
  });
  it("preserves a level-change rejection and never accepts a preview flag", async () => {
    m.submit.mockResolvedValue({
      ok: false,
      code: "LEVEL_CHANGED",
      error: "Updated",
    });
    expect(
      await (await POST(request({ ...body, preview: true }))).json(),
    ).toMatchObject({ ok: false, code: "LEVEL_CHANGED" });
    expect(m.submit.mock.calls[0]).toHaveLength(3);
  });
  it("rejects cross-origin and malformed requests before the service", async () => {
    expect((await POST(request(body, "https://other.example"))).status).toBe(
      403,
    );
    expect((await POST(request({ lessonId: "lesson" }))).status).toBe(400);
    expect(m.submit).not.toHaveBeenCalled();
  });
});
