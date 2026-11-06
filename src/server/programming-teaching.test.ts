import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { course: { findUnique: m.find } } }));
vi.mock("@/lib/llm/provider", () => ({ generateJson: m.generate, isMockMode: () => true }));
import { generateProgrammingTeaching } from "./programming-teaching";
import { POST } from "@/app/api/teach/programming-teaching/route";
import { createParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
import { createNumericDeliveryPayload } from "@/lib/programming-game/numeric-delivery";
import { mockProgrammingTeaching } from "@/lib/llm/prompts/programming-teaching";
function input() { return { locale: "en", payload: createParallelProgrammingPayload("parallel-lanes", "en") }; }
beforeEach(() => {
 vi.resetAllMocks(); m.auth.mockResolvedValue({ user: { id: "teacher", role: "INSTRUCTOR" } }); m.find.mockResolvedValue({ createdById: "teacher" });
 m.generate.mockImplementation(async (_schema, prompt) => mockProgrammingTeaching(prompt));
});
describe("teacher teaching-note generation", () => {
 it("uses the shared provider with teacher identity and mock mode", async () => {
  const r = await generateProgrammingTeaching(input()); expect(r).toMatchObject({ ok: true, mock: true, teaching: { version: 1 } });
  expect(m.generate.mock.calls[0][2]).toMatchObject({ usage: "programming-teaching", userId: "teacher", temperature: 0.2 }); expect(m.find).not.toHaveBeenCalled();
 });
 it.each([null, { user: { id: "student", role: "LEARNER" } }])("denies unauthenticated/learner callers before generation", async (session) => {
  m.auth.mockResolvedValue(session); expect(await generateProgrammingTeaching(input())).toMatchObject({ ok: false }); expect(m.generate).not.toHaveBeenCalled();
 });
 it.each([null, { createdById: "other" }])("requires supplied course ownership %j", async (course) => {
  m.find.mockResolvedValue(course); expect(await generateProgrammingTeaching({ ...input(), courseId: "other-course" })).toMatchObject({ ok: false }); expect(m.generate).not.toHaveBeenCalled();
 });
 it("allows the owner and audited admin generation", async () => {
  m.auth.mockResolvedValue({ user: { id: "teacher", role: "ADMIN" } }); expect(await generateProgrammingTeaching({ ...input(), courseId: "mine" })).toMatchObject({ ok: true }); expect(m.generate.mock.calls[0][2]).toMatchObject({ courseId: "mine", userId: "teacher" });
 });
 it("rejects malformed reference programs before contacting a model", async () => {
  const p = createNumericDeliveryPayload("en"); p.referenceProgram = [{ op: "jump", target: "MISSING" }];
  expect(await generateProgrammingTeaching({ locale: "en", payload: p })).toMatchObject({ ok: false }); expect(m.generate).not.toHaveBeenCalled();
 });
 it("explains syntactically valid drafts without running them or certifying passage", async () => {
  const p = createNumericDeliveryPayload("en"); p.referenceProgram = [{ op: "wait" }];
  expect(await generateProgrammingTeaching({ locale: "en", payload: p })).toMatchObject({ ok: true }); expect(m.generate).toHaveBeenCalledOnce();
 });
 it.each([{ concepts: "", pseudocode: "x" }, { concepts: "x", pseudocode: "x".repeat(12001) }])("rejects invalid provider result %j", async (value) => {
  m.generate.mockResolvedValue(value); expect(await generateProgrammingTeaching(input())).toMatchObject({ ok: false });
 });
 it("reports provider failure without mutating the supplied draft", async () => {
  const p = input(), before = JSON.stringify(p); m.generate.mockRejectedValue(new Error("Provider unavailable")); expect(await generateProgrammingTeaching(p)).toEqual({ ok: false, error: "Provider unavailable" }); expect(JSON.stringify(p)).toBe(before);
 });
 it("serves JSON generation with no-store", async () => {
  const request = new Request("http://localhost:3000/api/teach/programming-teaching", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(input()) });
  const response = await POST(request); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store"); expect(await response.json()).toMatchObject({ ok: true });
 });
 it.each([
  { origin: "https://evil.example", type: "application/json", body: "{}", status: 403 },
  { origin: "http://localhost:3000", type: "text/plain", body: "{}", status: 415 },
  { origin: "http://localhost:3000", type: "application/json", body: "{", status: 400 },
  { origin: "http://localhost:3000", type: "application/json", body: "x".repeat(250001), status: 413 },
 ])("rejects invalid transport with $status", async ({ origin, type, body, status }) => {
  const response = await POST(new Request("http://localhost:3000/api/teach/programming-teaching", { method: "POST", headers: { origin, "content-type": type }, body })); expect(response.status).toBe(status); expect(m.generate).not.toHaveBeenCalled();
 });
});
