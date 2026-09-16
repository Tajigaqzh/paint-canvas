import { describe, expect, it } from "vitest";
import type { CanvasPage } from "@/types";
import { collectDirtyPages } from "../dirtyPages";

const page = (id: string): CanvasPage => ({
  id,
  name: id,
  nodeMap: {},
  rootIds: [],
  selectedIds: [],
  viewport: { height: 1080, width: 1920 },
});

describe("collectDirtyPages", () => {
  it("页面引用都没变时应无脏页、无删除", () => {
    const p1 = page("p1");
    const p2 = page("p2");
    const prev = { p1, p2 };
    const next = { p1, p2 };

    const { dirtyIds, removedIds } = collectDirtyPages(prev, next, ["p1", "p2"], ["p1", "p2"]);

    expect(dirtyIds).toEqual([]);
    expect(removedIds).toEqual([]);
  });

  it("页面对象引用变化（如改了节点）应标记为脏页", () => {
    const p1a = page("p1");
    const p1b = { ...p1a, name: "页面 1 改名" };
    const p2 = page("p2");
    const prev = { p1: p1a, p2 };
    const next = { p1: p1b, p2 };

    const { dirtyIds } = collectDirtyPages(prev, next, ["p1", "p2"], ["p1", "p2"]);

    expect(dirtyIds).toEqual(["p1"]);
  });

  it("新增页面 id 应标记为脏页", () => {
    const p1 = page("p1");
    const p2 = page("p2");
    const prev = { p1 };
    const next = { p1, p2 };

    const { dirtyIds } = collectDirtyPages(prev, next, ["p1"], ["p1", "p2"]);

    expect(dirtyIds).toEqual(["p2"]);
  });

  it("删除页面 id 应进入 removedIds", () => {
    const p1 = page("p1");
    const p2 = page("p2");
    const prev = { p1, p2 };
    const next = { p1 };

    const { removedIds } = collectDirtyPages(prev, next, ["p1", "p2"], ["p1"]);

    expect(removedIds).toEqual(["p2"]);
  });

  it("同时有改动、新增、删除时应分别归类", () => {
    const p1a = page("p1");
    const p1b = { ...p1a, name: "新名" };
    const p2 = page("p2");
    const p3 = page("p3");
    const prev = { p1: p1a, p2, p3 };
    const next = { p1: p1b, p3 };

    const { dirtyIds, removedIds } = collectDirtyPages(
      prev,
      next,
      ["p1", "p2", "p3"],
      ["p1", "p3"],
    );

    expect(dirtyIds.sort()).toEqual(["p1"]);
    expect(removedIds).toEqual(["p2"]);
  });

  it("纯选中变化（页面引用随之变化）仍按引用判脏，仅对应页重绘", () => {
    const p1a = page("p1");
    const p1b = { ...p1a, selectedIds: ["x"] };
    const p2 = page("p2");
    const prev = { p1: p1a, p2 };
    const next = { p1: p1b, p2 };

    const { dirtyIds } = collectDirtyPages(prev, next, ["p1", "p2"], ["p1", "p2"]);

    expect(dirtyIds).toEqual(["p1"]);
  });
});
