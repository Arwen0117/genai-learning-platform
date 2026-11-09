// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ParallelProgrammingActivity } from "./ParallelProgrammingActivity";
import { createParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
import { postJson } from "@/lib/post-json";
vi.mock("@/i18n/client", () => ({ useI18n: () => ({ locale: "en" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/post-json", () => ({ postJson: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function activity(tutorial?: boolean, preview = true) {
  return <ParallelProgrammingActivity payload={{ ...createParallelProgrammingPayload("parallel-lanes", "en"), tutorial }} title="Example" lessonId="lesson" blockId="block" preview={preview} />;
}
it("preloads a tutorial answer, steps the actual map, and restores after editing", () => {
  const { container } = render(activity(true));
  expect(screen.getByRole("region", { name: "Tutorial demonstration" })).toBeTruthy();
  expect(container.querySelector('.pg-answer-list')?.closest('details')?.open).toBe(true);
  expect(screen.getByRole("button", { name: "Run" }).hasAttribute("disabled")).toBe(false);
  const step = screen.getByRole("button", { name: "World step" });
  // The real reducer/engine executes the preset and updates the map to a passed result.
  for (let i = 0; i < 20 && !step.hasAttribute("disabled"); i++) fireEvent.click(step);
  expect(screen.getByText("Goal reached", { exact: true })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear program" }));
  expect(screen.getByRole("button", { name: "Run" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Restore reference program" }));
  expect(screen.getByRole("button", { name: "Run" }).hasAttribute("disabled")).toBe(false);
  expect(screen.getByText("Editing", { exact: true })).toBeTruthy();
  expect(postJson).not.toHaveBeenCalled();
});
it("keeps ordinary challenges empty and their reference collapsed", () => {
  const { container } = render(activity());
  expect(screen.queryByRole("region", { name: "Tutorial demonstration" })).toBeNull();
  expect(screen.getByRole("button", { name: "Run" }).hasAttribute("disabled")).toBe(true);
  expect(container.querySelector('.pg-answer-list')?.closest('details')?.open).toBe(false);
});
it("retains explicit server submission in formal tutorial levels", () => {
  render(activity(true, false));
  const step = screen.getByRole("button", { name: "World step" });
  for (let i = 0; i < 20 && !step.hasAttribute("disabled"); i++) fireEvent.click(step);
  expect(screen.getByRole("button", { name: "Submit this run" })).toBeTruthy();
  expect(postJson).not.toHaveBeenCalled();
});
