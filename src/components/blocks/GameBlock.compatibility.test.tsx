// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import en from "@/i18n/en.json";
import { createParallelProgrammingPayload } from "@/lib/programming-game/parallel-config";
import type { GameBlock as GameData } from "@/lib/blocks/schema";
import { GameBlock } from "./GameBlock";
const m = vi.hoisted(() => ({ load: vi.fn(async () => ({ ok: true, attempts: [], playthroughId: null })) }));
vi.mock("@/server/activities", () => ({ loadLatestGamePlaythrough: m.load }));
vi.mock("./programming-game/ProgrammingActivity", () => ({ ProgrammingActivity: () => <p>Robot course dispatcher</p> }));
vi.mock("./SupportingMediaView", () => ({ SupportingMediaView: () => null }));
vi.mock("./SortGame", () => ({ SortGame: () => <p>Sort Challenge dispatcher</p> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function display(block: GameData) { return render(<I18nProvider locale="en" messages={en}><GameBlock block={block} completed={false} onComplete={() => {}} context={{ courseId: "c", lessonId: "l" }} /></I18nProvider>); }
describe("game dispatcher compatibility", () => {
 it("routes programming directly without requesting upstream Playthrough recovery", () => {
  display({ id: "robot", type: "game", title: "Robots", payload: createParallelProgrammingPayload("parallel-lanes", "en") });
  expect(screen.getByText("Robot course dispatcher")).toBeTruthy(); expect(m.load).not.toHaveBeenCalled();
 });
 it("retains Playthrough recovery for upstream Challenges", async () => {
  display({ id: "sort", type: "game", title: "Sort", payload: { variant: "sort", items: [{ text: "A", order: 0 }, { text: "B", order: 1 }] } });
  await waitFor(() => expect(screen.getByText("Sort Challenge dispatcher")).toBeTruthy()); expect(m.load).toHaveBeenCalledWith("l", "sort");
 });
});
