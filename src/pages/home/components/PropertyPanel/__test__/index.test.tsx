import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PropertyPanel from "../index";

describe("PropertyPanel", () => {
  it("收起时不显示属性标题", () => {
    render(
      <PropertyPanel
        canUngroup={false}
        collapsed
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={vi.fn()}
      />,
    );
    expect(screen.queryByText("属性")).toBeNull();
  });

  it("展开且无节点时显示空状态", () => {
    render(
      <PropertyPanel
        canUngroup={false}
        collapsed={false}
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={vi.fn()}
      />,
    );
    expect(screen.getByText("属性")).toBeTruthy();
  });
});
