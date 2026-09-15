import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CanvasToolbar from "../index";

const props = {
  activeTool: "select" as const,
  brushSize: 8,
  canRedo: false,
  canUndo: false,
  eraserSize: 20,
  magnifierSize: 200,
  magnifierZoom: 3,
  onChangeBrushSize: vi.fn(),
  onChangeEraserSize: vi.fn(),
  onChangeMagnifierSize: vi.fn(),
  onChangeMagnifierZoom: vi.fn(),
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

  it("点击放大镜工具", () => {
    const onChangeTool = vi.fn();
    render(<CanvasToolbar {...props} onChangeTool={onChangeTool} />);
    fireEvent.click(screen.getByRole("img", { name: "zoom-in" }).closest("button")!);
    expect(onChangeTool).toHaveBeenCalledWith("magnifier");
  });

  it("非放大镜模式时镜片尺寸和倍率选择禁用", () => {
    render(<CanvasToolbar {...props} activeTool="eraser" />);
    const [, , magnifierSize, magnifierZoom] = screen.getAllByRole("combobox");
    expect(magnifierSize).toBeDisabled();
    expect(magnifierZoom).toBeDisabled();
  });

  it("放大镜模式下镜片尺寸和倍率选择可用", () => {
    render(<CanvasToolbar {...props} activeTool="magnifier" />);
    const [, , magnifierSize, magnifierZoom] = screen.getAllByRole("combobox");
    expect(magnifierSize).toBeEnabled();
    expect(magnifierZoom).toBeEnabled();
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
