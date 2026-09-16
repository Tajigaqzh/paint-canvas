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

  it("addNode 不传 position 时按根节点数量错位", () => {
    const index = useCanvasStore.getState().activePage.rootIds.length;
    useCanvasStore.getState().addNode("rect");
    const id = useCanvasStore.getState().activePage.activeId;
    const node = useCanvasStore.getState().activePage.nodeMap[id!];
    expect(node.x).toBe(180 + index * 24);
  });

  it("addNode 传入 position 时 x/y 为落点", () => {
    useCanvasStore.getState().addNode("rect", { x: 500, y: 400 });
    const id = useCanvasStore.getState().activePage.activeId;
    const node = useCanvasStore.getState().activePage.nodeMap[id!];
    expect(node).toMatchObject({ x: 500, y: 400 });
  });

  it("addNode 传入原点 position 时 x/y 为 0", () => {
    useCanvasStore.getState().addNode("text", { x: 0, y: 0 });
    const id = useCanvasStore.getState().activePage.activeId;
    const node = useCanvasStore.getState().activePage.nodeMap[id!];
    expect(node).toMatchObject({ x: 0, y: 0 });
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

  it("insertBlankPage 不传位置追加到末尾并切换", () => {
    const before = useCanvasStore.getState().pageIds.length;
    useCanvasStore.getState().insertBlankPage();
    const state = useCanvasStore.getState();
    expect(state.pageIds.length).toBe(before + 1);
    expect(state.activePageId).toBe(state.pageIds.at(-1));
  });

  it("insertBlankPage 传入 afterPageId 时插到其后", () => {
    const ids = useCanvasStore.getState().pageIds;
    const target = ids[0];
    const after = ids[1];
    useCanvasStore.getState().insertBlankPage(target);
    const newIds = useCanvasStore.getState().pageIds;
    expect(newIds[newIds.indexOf(target) + 1]).toBe(newIds.at(-1));
    expect(newIds.at(-1)).not.toBe(after);
  });

  it("duplicatePage 复制出内容相同但 ID 全新的页，并插到原页之后", () => {
    const state = useCanvasStore.getState();
    const sourceId = state.activePageId;
    const sourceNodeCount = Object.keys(state.activePage.nodeMap).length;

    useCanvasStore.getState().duplicatePage(sourceId);
    const next = useCanvasStore.getState();
    const newId = next.activePageId;
    expect(newId).not.toBe(sourceId);
    expect(next.pages[newId].nodeMap).not.toBe(next.pages[sourceId].nodeMap);
    expect(Object.keys(next.pages[newId].nodeMap).length).toBe(sourceNodeCount);
    // 复制页的节点 ID 与原页不共享。
    const sourceNodeIds = new Set(Object.keys(next.pages[sourceId].nodeMap));
    const newPageNodeIds = Object.keys(next.pages[newId].nodeMap);
    expect(newPageNodeIds.some((id) => sourceNodeIds.has(id))).toBe(false);
    // 复制页紧跟原页之后。
    expect(next.pageIds[next.pageIds.indexOf(sourceId) + 1]).toBe(newId);
  });

  it("duplicatePage 会同步修正 group 的 childrenIds 引用", () => {
    const pageId = useCanvasStore.getState().activePageId;
    // 先放两个 rect 并选中，再打组，构造 group 包 rect 的页面来复制。
    useCanvasStore.getState().addNode("rect");
    const rectId = useCanvasStore.getState().activePage.activeId!;
    useCanvasStore.getState().addNode("rect");
    const rectId2 = useCanvasStore.getState().activePage.activeId!;
    useCanvasStore.getState().selectNodes([rectId, rectId2]);
    useCanvasStore.getState().groupSelected();
    const groupId = useCanvasStore.getState().activePage.activeId!;

    useCanvasStore.getState().duplicatePage(pageId);
    const next = useCanvasStore.getState();
    const dupPage = next.pages[next.activePageId];
    const dupGroup = Object.values(dupPage.nodeMap).find((node) => node.kind === "group")!;
    expect(dupGroup.id).not.toBe(groupId);
    // 复制页里 group 的 childrenIds 应指向全新的子节点，且子节点 parentId 回指新 group。
    expect(dupGroup.childrenIds.length).toBe(2);
    dupGroup.childrenIds.forEach((childId) => {
      const child = dupPage.nodeMap[childId];
      expect(child).toBeTruthy();
      expect(child.parentId).toBe(dupGroup.id);
      expect(child.kind).toBe("rect");
    });
    // 复制页的子节点 ID 与原页不共享。
    expect(dupGroup.childrenIds).not.toContain(rectId);
    expect(dupGroup.childrenIds).not.toContain(rectId2);
  });

  it("removePage 删除指定页并切到相邻页", () => {
    useCanvasStore.getState().addPage();
    const state = useCanvasStore.getState();
    const target = state.pageIds[0];
    const neighbor = state.pageIds[1];
    useCanvasStore.getState().removePage(target);
    const next = useCanvasStore.getState();
    expect(next.pageIds).not.toContain(target);
    expect(next.activePageId).toBe(neighbor);
  });

  it("removePage 对最后一页无效", () => {
    const state = useCanvasStore.getState();
    const onlyId = state.pageIds[0];
    useCanvasStore.getState().removePage(onlyId);
    expect(useCanvasStore.getState().pageIds.length).toBe(1);
  });

  it("removePage 对不存在的 id 不抛错", () => {
    expect(() => useCanvasStore.getState().removePage("missing")).not.toThrow();
  });
});
