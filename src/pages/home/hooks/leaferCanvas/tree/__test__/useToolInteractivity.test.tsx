import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CanvasPage, CanvasToolMode, ManagedNodeUI, UseLeaferCanvasOptions } from "@/types";
import { useToolInteractivity } from "../useToolInteractivity";

const renderInteractivity = (mode: CanvasToolMode) => {
  const ui = { set: vi.fn() } as unknown as ManagedNodeUI;
  const uiMapRef = { current: new Map([["node-1", ui]]) };

  renderHook(() =>
    useToolInteractivity({
      nodeMap: {} as CanvasPage["nodeMap"],
      rootIds: ["node-1"],
      tool: {
        brushSize: 8,
        eraserSize: 24,
        magnifierSize: 200,
        magnifierZoom: 3,
        mode,
      } satisfies UseLeaferCanvasOptions["tool"],
      uiMapRef,
    }),
  );

  return ui;
};

describe("useToolInteractivity", () => {
  it("select 模式下恢复节点可编辑和可拖拽", () => {
    const ui = renderInteractivity("select");

    expect(ui.set).toHaveBeenCalledWith({ draggable: true, editable: true });
  });

  it("brush 模式下关闭节点可编辑和可拖拽", () => {
    const ui = renderInteractivity("brush");

    expect(ui.set).toHaveBeenCalledWith({ draggable: false, editable: false });
  });

  it("eraser 模式下关闭节点可编辑和可拖拽", () => {
    const ui = renderInteractivity("eraser");

    expect(ui.set).toHaveBeenCalledWith({ draggable: false, editable: false });
  });

  it("magnifier 模式下关闭节点可编辑和可拖拽，避免放大时误拖节点", () => {
    const ui = renderInteractivity("magnifier");

    expect(ui.set).toHaveBeenCalledWith({ draggable: false, editable: false });
  });
});
