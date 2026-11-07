// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CompactParallelEditor } from "./CompactParallelEditor";
import type { ParallelLevel, ParallelProgram } from "@/lib/programming-game/parallel-engine";
afterEach(cleanup);
const level: ParallelLevel = { id: "ui", rulesVersion: 2, width: 3, height: 1, walls: [], goals: [{ x: 2, y: 0 }], robots: [{ id: "a", start: { x: 0, y: 0 } }], allowed: ["if", "repeat", "right", "label", "jump"] };
const program: ParallelProgram = [{ op: "label", id: "A" }, { op: "if", condition: { kind: "goal", not: true }, then: [], else: [{ op: "wait" }] }];
it.each([0, 1])("adds repeat and jump from IF branch %s menu", arm => {
  const onEdit = vi.fn(); const { container } = render(<CompactParallelEditor level={level} program={program} focus={null} onEdit={onEdit} locale="zh" />);
  const menu = container.querySelectorAll<HTMLSelectElement>(".pg-compact-add")[arm];
  expect([...menu.options].map(o => o.value)).toContain("repeat");
  fireEvent.change(menu, { target: { value: "repeat" } });
  expect(onEdit.mock.lastCall?.[0][1][arm === 0 ? "then" : "else"][arm === 0 ? 0 : 1].op).toBe("repeat");
  fireEvent.change(menu, { target: { value: "jump" } });
  expect(onEdit.mock.lastCall?.[0][1][arm === 0 ? "then" : "else"][arm === 0 ? 0 : 1]).toEqual({ op: "jump", target: "A" });
});
it("keeps jump available in a branch repeat while excluding another repeat", () => {
  const nested: ParallelProgram = [{ ...program[1], then: [{ op: "repeat", count: 2, body: [] }] } as ParallelProgram[number]];
  const { container } = render(<CompactParallelEditor level={level} program={nested} focus={null} onEdit={vi.fn()} locale="en" />);
  const values = [...container.querySelector<HTMLSelectElement>(".pg-compact-add")!.options].map(o => o.value);
  expect(values).toContain("jump"); expect(values).not.toContain("repeat");
});
it.each([0, 1])("adds a unique marker inside IF branch %s", arm => {
  const onEdit = vi.fn(); const { container } = render(<CompactParallelEditor level={level} program={program} focus={null} onEdit={onEdit} locale="zh" />);
  fireEvent.change(container.querySelectorAll<HTMLSelectElement>(".pg-compact-add")[arm], { target: { value: "label" } });
  expect(onEdit.mock.lastCall?.[0][1][arm === 0 ? "then" : "else"][arm === 0 ? 0 : 1]).toEqual({ op: "label", id: "B" });
});
it("lists IF branch markers as jump destinations", () => {
  const nested: ParallelProgram = [{ op: "if", condition: { kind: "goal", not: true }, then: [{ op: "label", id: "NESTED" }], else: [] }, { op: "jump", target: "NESTED" }];
  const { container } = render(<CompactParallelEditor level={level} program={nested} focus={null} onEdit={vi.fn()} locale="en" />);
  expect(container.querySelector('select option[value="NESTED"]')).toBeTruthy();
});
it("offers delivery zones only on parcel levels and preserves the arrow when selected", async () => {
  const { createDeliveryPayload } = await import("@/lib/programming-game/delivery-level");
  const onEdit = vi.fn(); const p: ParallelProgram = [{ op:"if",condition:{kind:"wall",direction:"down",not:true},then:[],else:[] }];
  const { container, rerender } = render(<CompactParallelEditor level={createDeliveryPayload("zh",1).customLevel!} program={p} focus={null} onEdit={onEdit} locale="zh" />);
  const select=container.querySelector<HTMLSelectElement>(".pg-condition-select")!;
  expect(select.querySelector('option[value="delivery"]')?.textContent).toBe("配送区");
  fireEvent.change(select,{target:{value:"delivery"}});
  expect(onEdit.mock.lastCall?.[0][0].condition).toEqual({kind:"delivery",direction:"down",not:true});
  rerender(<CompactParallelEditor level={level} program={p} focus={null} onEdit={onEdit} locale="zh" />);
  expect(container.querySelector('.pg-condition-select option[value="delivery"]')).toBeNull();
});
