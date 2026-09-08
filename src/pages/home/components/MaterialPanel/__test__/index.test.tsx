import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MATERIAL_DRAG_MIME,
  getDraggingMaterialKind,
  setDraggingMaterialKind,
} from "../../../materialDrop";
import MaterialPanel from "../index";

const createDataTransfer = () => ({
  effectAllowed: "none",
  setData: vi.fn(),
});

describe("MaterialPanel", () => {
  afterEach(() => {
    setDraggingMaterialKind(undefined);
  });

  it("展开时显示素材标题", () => {
    render(<MaterialPanel collapsed={false} onAddNode={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.getByText("素材")).toBeTruthy();
  });

  it("收起时不显示素材标题", () => {
    render(<MaterialPanel collapsed onAddNode={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.queryByText("素材")).toBeNull();
  });

  it("点击矩形素材会 addNode rect", () => {
    const onAddNode = vi.fn();
    render(<MaterialPanel collapsed={false} onAddNode={onAddNode} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByTitle("矩形"));
    expect(onAddNode).toHaveBeenCalledWith("rect");
  });

  it("拖拽矩形开始时记录素材类型", () => {
    render(<MaterialPanel collapsed={false} onAddNode={vi.fn()} onToggle={vi.fn()} />);
    fireEvent.dragStart(screen.getByTitle("矩形"), { dataTransfer: createDataTransfer() });
    expect(getDraggingMaterialKind()).toBe("rect");
  });

  it("拖拽矩形开始时写入自定义 MIME", () => {
    const dataTransfer = createDataTransfer();
    render(<MaterialPanel collapsed={false} onAddNode={vi.fn()} onToggle={vi.fn()} />);
    fireEvent.dragStart(screen.getByTitle("矩形"), { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith(MATERIAL_DRAG_MIME, "rect");
  });

  it("拖拽结束清空素材类型", () => {
    render(<MaterialPanel collapsed={false} onAddNode={vi.fn()} onToggle={vi.fn()} />);
    fireEvent.dragStart(screen.getByTitle("圆形"), { dataTransfer: createDataTransfer() });
    fireEvent.dragEnd(screen.getByTitle("圆形"));
    expect(getDraggingMaterialKind()).toBeUndefined();
  });

  it("上传图片按钮不可拖拽", () => {
    render(<MaterialPanel collapsed={false} onAddNode={vi.fn()} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /图片素材/ }));
    expect(screen.getByTitle("上传图片").getAttribute("draggable")).toBe("false");
  });
});
