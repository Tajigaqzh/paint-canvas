import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CanvasContextMenu from "../index";

const props = {
  canGroup: false,
  canUngroup: false,
  onBringForward: vi.fn(),
  onClose: vi.fn(),
  onGroup: vi.fn(),
  onRemove: vi.fn(),
  onSendBackward: vi.fn(),
  onUngroup: vi.fn(),
  open: true,
  selectedCount: 1,
  x: 10,
  y: 20,
};

describe("CanvasContextMenu", () => {
  it("open 为 false 时不渲染", () => {
    const { container } = render(<CanvasContextMenu {...props} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("open 时显示菜单项", () => {
    render(<CanvasContextMenu {...props} />);
    expect(screen.getByText("打组")).toBeTruthy();
    expect(screen.getByText("删除")).toBeTruthy();
  });

  it("不能打组时按钮 disabled", () => {
    render(<CanvasContextMenu {...props} canGroup={false} />);
    expect(screen.getByText("打组")).toBeDisabled();
  });

  it("selectedCount 为 0 时删除 disabled", () => {
    render(<CanvasContextMenu {...props} selectedCount={0} />);
    expect(screen.getByText("删除")).toBeDisabled();
  });

  it("点击删除会回调", () => {
    const onRemove = vi.fn();
    render(<CanvasContextMenu {...props} onRemove={onRemove} selectedCount={1} />);
    fireEvent.click(screen.getByText("删除"));
    expect(onRemove).toHaveBeenCalled();
  });
});
