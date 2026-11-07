import { beforeEach, describe, expect, it, vi } from "vitest";
const save = vi.hoisted(() => vi.fn());
vi.mock("@/server/robot-courses", () => ({ saveRobotCourse: save }));
import { POST } from "./route";
const levelId = "00000000-0000-4000-8000-000000000001";
const request = (body: unknown) => new Request("http://localhost/api/teach/robot-courses", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { save.mockReset(); save.mockResolvedValue({ ok: true }); });
describe("robot course removal request", () => {
  it("passes explicit removed IDs to the authenticated save handler", async () => {
    const body = { courseId: "course", draft: { title: "test" }, removedLessonIds: [levelId] };
    expect((await POST(request(body))).status).toBe(200);
    expect(save).toHaveBeenCalledWith(body.courseId, body.draft, [levelId]);
  });
  it("keeps existing clients without removal declarations compatible", async () => {
    await POST(request({ courseId: null, draft: {} })); expect(save).toHaveBeenCalledWith(null, {}, undefined);
  });
  it("rejects malformed removal identities before saving", async () => {
    expect((await POST(request({ courseId: "course", draft: {}, removedLessonIds: ["bad-id"] }))).status).toBe(400); expect(save).not.toHaveBeenCalled();
  });
});
