// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRobotCourseDraft } from "@/lib/programming-game/robot-course";
import { RobotLevelManagement } from "./RobotLevelManagement";
afterEach(cleanup);
function setup(active = 0, count = 3, locale: "zh" | "en" = "zh") {
  const levels = createRobotCourseDraft("zh").levels.slice(0, count), onMove = vi.fn(), onDelete = vi.fn();
  render(<RobotLevelManagement levels={levels} active={active} locale={locale} onMove={onMove} onDelete={onDelete} />);
  return { levels, onMove, onDelete };
}
describe("robot level management controls", () => {
  it("disables moving beyond the first position", () => { setup(); expect((screen.getByRole("button", { name: "上移关卡" }) as HTMLButtonElement).disabled).toBe(true); });
  it("moves up, down and to a chosen position", () => {
    const { onMove } = setup(1);
    fireEvent.click(screen.getByRole("button", { name: "上移关卡" })); expect(onMove).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "下移关卡" })); expect(onMove).toHaveBeenLastCalledWith(2);
    fireEvent.change(screen.getByLabelText("移到第几关"), { target: { value: "0" } }); expect(onMove).toHaveBeenLastCalledWith(0);
  });
  it("asks before deleting and allows cancellation", () => {
    const { onDelete } = setup(); fireEvent.click(screen.getByRole("button", { name: "删除当前关卡" })); expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消删除" })); expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "删除当前关卡" })); fireEvent.click(screen.getByRole("button", { name: "确认删除" })); expect(onDelete).toHaveBeenCalledOnce();
  });
  it("keeps at least one level", () => { setup(0, 1); expect((screen.getByRole("button", { name: "删除当前关卡" }) as HTMLButtonElement).disabled).toBe(true); expect((screen.getByRole("button", { name: "下移关卡" }) as HTMLButtonElement).disabled).toBe(true); });
  it("has English labels", () => { setup(0, 3, "en"); expect(screen.getByRole("button", { name: "Delete current level" })).toBeTruthy(); });
});
