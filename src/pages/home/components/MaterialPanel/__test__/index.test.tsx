import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MaterialPanel from "../index";

describe("MaterialPanel", () => {
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
});
