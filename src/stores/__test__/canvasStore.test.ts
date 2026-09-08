import { beforeEach, describe, expect, it } from "vitest";
import { flattenCanvasNodes, useCanvasStore } from "../canvasStore";
import type { CanvasPage } from "@/types";

describe("flattenCanvasNodes", () => {
  it("空 rootIds 返回空数组", () => {
    const page: CanvasPage = {
      id: "p",
      name: "p",
      nodeMap: {},
      rootIds: [],
      selectedIds: [],
      viewport: { height: 1080, width: 1920 },
    };
    expect(flattenCanvasNodes(page)).toEqual([]);
  });

  it("跳过缺失节点", () => {
    const page: CanvasPage = {
      id: "p",
      name: "p",
      nodeMap: {},
      rootIds: ["gone"],
      selectedIds: [],
      viewport: { height: 1080, width: 1920 },
    };
    expect(flattenCanvasNodes(page)).toEqual([]);
  });

  it("group 不出现在扁平列表里，子节点会展开", () => {
    const page: CanvasPage = {
      id: "p",
      name: "p",
      nodeMap: {
        g: {
          childrenIds: ["r"],
          height: 10,
          id: "g",
          kind: "group",
          name: "组",
          rotation: 0,
          transformOrigin: "center",
          width: 10,
          x: 0,
          y: 0,
        },
        r: {
          animationList: [],
          fill: "#fff",
          height: 10,
          id: "r",
          kind: "rect",
          name: "矩形",
          rotation: 0,
          transformOrigin: "center",
          width: 10,
          x: 0,
          y: 0,
        },
      },
      rootIds: ["g"],
      selectedIds: [],
      viewport: { height: 1080, width: 1920 },
    };
    expect(flattenCanvasNodes(page).map((node) => node.id)).toEqual(["r"]);
  });
});

describe("useCanvasStore", () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it("reset 后至少有一页", () => {
    expect(useCanvasStore.getState().pageIds.length).toBeGreaterThan(0);
  });

  it("addPage 增加页面并切换 activePageId", () => {
    const before = useCanvasStore.getState().pageIds.length;
    useCanvasStore.getState().addPage();
    expect(useCanvasStore.getState().pageIds.length).toBe(before + 1);
    expect(useCanvasStore.getState().activePageId).toBe(useCanvasStore.getState().pageIds.at(-1));
  });

  it("selectPage 无效 id 不切换", () => {
    const current = useCanvasStore.getState().activePageId;
    useCanvasStore.getState().selectPage("missing");
    expect(useCanvasStore.getState().activePageId).toBe(current);
  });

  it("addNode 后选中新节点", () => {
    useCanvasStore.getState().addNode("rect");
    expect(useCanvasStore.getState().activePage.selectedIds.length).toBe(1);
  });

  it("selectNode 空 id 清空选区", () => {
    useCanvasStore.getState().addNode("rect");
    useCanvasStore.getState().selectNode();
    expect(useCanvasStore.getState().activePage.selectedIds).toEqual([]);
  });

  it("updateNode 不存在的 id 不抛错", () => {
    expect(() => useCanvasStore.getState().updateNode("missing", { x: 1 })).not.toThrow();
  });

  it("removeNode 不存在的 id 不抛错", () => {
    expect(() => useCanvasStore.getState().removeNode("missing")).not.toThrow();
  });

  it("addNode 后 undo 能撤销", () => {
    const count = Object.keys(useCanvasStore.getState().activePage.nodeMap).length;
    useCanvasStore.getState().addNode("ellipse");
    useCanvasStore.getState().undo();
    expect(Object.keys(useCanvasStore.getState().activePage.nodeMap).length).toBe(count);
  });

  it("undo 后再 redo 恢复节点", () => {
    useCanvasStore.getState().addNode("star");
    const afterAdd = Object.keys(useCanvasStore.getState().activePage.nodeMap).length;
    useCanvasStore.getState().undo();
    useCanvasStore.getState().redo();
    expect(Object.keys(useCanvasStore.getState().activePage.nodeMap).length).toBe(afterAdd);
  });
});
