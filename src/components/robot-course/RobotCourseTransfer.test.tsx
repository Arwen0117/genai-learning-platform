// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RobotCourseTransfer } from "./RobotCourseTransfer";
import { createRobotCourseDraft } from "@/lib/programming-game/robot-course";
import { exportRobotCourse, ROBOT_COURSE_FILE_LIMIT } from "@/lib/programming-game/course-transfer";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function setup(locale: "zh" | "en" = "zh") {
  const draft = createRobotCourseDraft("zh"), onImport = vi.fn();
  render(<RobotCourseTransfer draft={draft} locale={locale} onImport={onImport} />);
  return { draft, onImport };
}
function upload(text: string, size = text.length) {
  const file = { name: "robot-course.json", size, text: vi.fn(async () => text) };
  fireEvent.change(screen.getByLabelText("选择课程文件"), { target: { files: [file] } });
  return file;
}
describe("course transfer confirmation", () => {
  it("previews without importing, then confirms a fresh draft", async () => {
    const { draft, onImport } = setup(); upload(exportRobotCourse(draft));
    await screen.findByRole("button", { name: "确认为新草稿" });
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认为新草稿" }));
    expect(onImport).toHaveBeenCalledOnce();
    expect(onImport.mock.calls[0][0]).toMatchObject({ title: draft.title, status: "DRAFT" });
    expect(onImport.mock.calls[0][0].draftId).not.toBe(draft.draftId);
  });
  it("cancels without changing the editor", async () => {
    const { draft, onImport } = setup(); upload(exportRobotCourse(draft));
    fireEvent.click(await screen.findByRole("button", { name: "取消" }));
    expect(onImport).not.toHaveBeenCalled(); expect(screen.queryByText("确认为新草稿")).toBeNull();
  });
  it("rejects invalid files without modifying the current course", async () => {
    const { onImport } = setup(); upload("bad JSON");
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("无法导入"));
    expect(onImport).not.toHaveBeenCalled();
  });
  it("rejects oversized files before reading them", async () => {
    setup(); const file = upload("{}", ROBOT_COURSE_FILE_LIMIT + 1);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("无法导入"));
    expect(file.text).not.toHaveBeenCalled();
  });
  it("provides the English controls", () => {
    setup("en"); expect(screen.getByRole("button", { name: "Export course" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import course" })).toBeTruthy();
  });
});

describe("course file drag and drop", () => {
  const zone = () => screen.getByRole("button", { name: "拖入课程文件或点击上传" });
  const file = (text: string, name = "robot-course.json") => ({ name, size: text.length, text: vi.fn(async () => text) });
  it("highlights while dragging and uses the same confirmation flow", async () => {
    const { draft, onImport } = setup();
    fireEvent.dragEnter(zone()); expect(zone().textContent).toContain("松开");
    fireEvent.dragLeave(zone()); expect(zone().textContent).toContain("拖到这里");
    fireEvent.drop(zone(), { dataTransfer: { files: [file(exportRobotCourse(draft))] } });
    await screen.findByRole("button", { name: "确认为新草稿" });
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认为新草稿" }));
    expect(onImport).toHaveBeenCalledOnce();
  });
  it("rejects multiple files and non-JSON files before reading", async () => {
    setup(); const a = file("{}"), b = file("{}", "other.json");
    fireEvent.drop(zone(), { dataTransfer: { files: [a, b] } });
    expect(screen.getByRole("status").textContent).toContain("一次拖入一个"); expect(a.text).not.toHaveBeenCalled();
    const zip = file("bad", "course.zip"); fireEvent.drop(zone(), { dataTransfer: { files: [zip] } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("无法导入")); expect(zip.text).not.toHaveBeenCalled();
  });
  it("ignores another drop until the current read finishes", async () => {
    const { draft } = setup(); let release!: (text: string) => void;
    const slow = { name: "a.json", size: 100, text: () => new Promise<string>((resolve) => { release = resolve; }) };
    fireEvent.drop(zone(), { dataTransfer: { files: [slow] } });
    const other = file("bad"); fireEvent.drop(zone(), { dataTransfer: { files: [other] } });
    expect(other.text).not.toHaveBeenCalled(); release(exportRobotCourse(draft));
    await screen.findByRole("button", { name: "确认为新草稿" });
  });
  it("does not read dropped files while the parent editor is saving", () => {
    const draft = createRobotCourseDraft("zh"), dropped = file("{}");
    render(<fieldset disabled><RobotCourseTransfer draft={draft} locale="zh" onImport={vi.fn()} /></fieldset>);
    fireEvent.drop(zone(), { dataTransfer: { files: [dropped] } }); expect(dropped.text).not.toHaveBeenCalled();
  });
});
