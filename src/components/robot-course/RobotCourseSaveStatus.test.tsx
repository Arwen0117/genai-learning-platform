// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RobotCourseSaveStatus } from "./RobotCourseSaveStatus";
afterEach(cleanup);
it("lists other unverified levels and navigates to the selected one", () => {
 const onSelect=vi.fn();render(<RobotCourseSaveStatus locale="zh" pending={[{index:2,title:"配送",reason:"pending"}]} issues={[]} onSelect={onSelect}/>);
 expect(screen.getByText(/第 3 关 · 配送：尚未验证/)).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"前往验证"}));expect(onSelect).toHaveBeenCalledWith(2);
});
it("explains changed and failed references separately", () => {
 render(<RobotCourseSaveStatus locale="zh" pending={[{index:0,title:"A",reason:"changed"},{index:1,title:"B",reason:"failed"}]} issues={[]} onSelect={vi.fn()}/>);
 expect(screen.getByText(/地图或程序已修改/)).toBeTruthy();expect(screen.getByText(/第 2 关 · B：参考答案未通过/)).toBeTruthy();
});
it("shows field errors even when all references passed", () => {
 const onSelect=vi.fn();render(<RobotCourseSaveStatus locale="zh" pending={[]} issues={[{path:["title"],message:"Required"},{path:["levels",1,"title"],message:"Required"}]} onSelect={onSelect}/>);
 expect(screen.getByText(/第 2 关 · 名称：Required/)).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"前往修改"}));expect(onSelect).toHaveBeenCalledWith(1);expect(screen.queryByText(/整门课程检查通过/)).toBeNull();
});
it("reports readiness after every blocker is resolved", () => {
 const {rerender}=render(<RobotCourseSaveStatus locale="en" pending={[{index:1,title:"B",reason:"pending"}]} issues={[]} onSelect={vi.fn()}/>);
 expect(screen.getByRole("region",{name:"Save checks"})).toBeTruthy();rerender(<RobotCourseSaveStatus locale="en" pending={[]} issues={[]} onSelect={vi.fn()}/>);expect(screen.getByRole("status").textContent).toContain("All course checks passed");expect(screen.queryByRole("region")).toBeNull();
});
it("does not claim imported references passed before server validation", () => {
 render(<RobotCourseSaveStatus locale="zh" pending={[]} issues={[]} serverChecksPending onSelect={vi.fn()}/>);
 expect(screen.getByRole("status").textContent).toContain("无需逐关手动运行");expect(screen.getByRole("status").textContent).toContain("保存时将自动校验");expect(screen.queryByText(/整门课程检查通过/)).toBeNull();
});
