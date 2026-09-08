import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CanvasToolbar from "../index";

const props = {
  activeTool: "select" as const,
  brushSize: 8,
  canRedo: false,
  canUndo: false,
  eraserSize: 20,
  onChangeBrushSize: vi.fn(),
  onChangeEraserSize: vi.fn(),
  onChangeTool: vi.fn(),
  onRedo: vi.fn(),
  onSave: vi.fn(),
  onUndo: vi.fn(),
};

describe("CanvasToolbar", () => {
  it("渲染保存按钮", () => {
    render(<CanvasToolbar {...props} />);
    expect(screen.getByText("保存")).toBeTruthy();
  });

  it("点击选择工具", () => {
    const onChangeTool = vi.fn();
    render(<CanvasToolbar {...props} onChangeTool={onChangeTool} />);
    fireEvent.click(screen.getByRole("img", { name: "select" }).closest("button")!);
    expect(onChangeTool).toHaveBeenCalledWith("select");
  });

  it("无法撤销时撤销按钮 disabled", () => {
    render(<CanvasToolbar {...props} canUndo={false} />);
    expect(screen.getByRole("img", { name: "undo" }).closest("button")).toBeDisabled();
  });

  it("点击保存", () => {
    const onSave = vi.fn();
    render(<CanvasToolbar {...props} onSave={onSave} />);
    fireEvent.click(screen.getByText("保存"));
    expect(onSave).toHaveBeenCalled();
  });
});
