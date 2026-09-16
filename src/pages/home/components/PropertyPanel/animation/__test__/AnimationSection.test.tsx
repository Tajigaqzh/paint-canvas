import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CanvasAnimationItem } from "@/types";
import AnimationSection from "../AnimationSection";

const makeItem = (overrides: Partial<CanvasAnimationItem> = {}): CanvasAnimationItem => ({
  id: "a",
  name: "淡入动画",
  preset: "fadeIn",
  duration: 600,
  delay: 0,
  loop: 0,
  animation: { keyframes: [] },
  ...overrides,
});

describe("AnimationSection", () => {
  it("渲染标题、提示与添加按钮", () => {
    render(<AnimationSection animationList={[]} commitAnimationList={vi.fn()} />);

    expect(screen.getByText("动画")).toBeTruthy();
    expect(screen.getByText("添加")).toBeTruthy();
    expect(screen.getByText(/淡入最先播放/)).toBeTruthy();
  });

  it("空列表显示暂无动画", () => {
    render(<AnimationSection animationList={[]} commitAnimationList={vi.fn()} />);

    expect(screen.getByText("暂无动画")).toBeTruthy();
  });

  it("渲染已有动画项的名称", () => {
    render(
      <AnimationSection
        animationList={[makeItem({ name: "我的动画" })]}
        commitAnimationList={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("我的动画")).toBeTruthy();
  });

  it("点击添加会提交一条新动画", () => {
    const commit = vi.fn();
    render(<AnimationSection animationList={[]} commitAnimationList={commit} />);

    fireEvent.click(screen.getByText("添加"));

    expect(commit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0][0] as CanvasAnimationItem[];
    expect(next).toHaveLength(1);
    expect(next[0].animation).toBeTruthy();
  });

  it("点击删除会提交过滤掉该项的列表", () => {
    const commit = vi.fn();
    render(
      <AnimationSection animationList={[makeItem({ id: "x" })]} commitAnimationList={commit} />,
    );

    fireEvent.click(screen.getByTitle("删除动画"));

    expect(commit).toHaveBeenCalledWith([]);
  });

  it("折叠后隐藏动画表单，再展开恢复", () => {
    render(<AnimationSection animationList={[makeItem()]} commitAnimationList={vi.fn()} />);

    expect(screen.getByText("类型")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("折叠动画"));
    expect(screen.queryByText("类型")).toBeNull();
    fireEvent.click(screen.getByLabelText("展开动画"));
    expect(screen.getByText("类型")).toBeTruthy();
  });

  it("修改名称会提交带新名称的列表", () => {
    const commit = vi.fn();
    render(
      <AnimationSection animationList={[makeItem({ id: "x" })]} commitAnimationList={commit} />,
    );

    fireEvent.change(screen.getByDisplayValue("淡入动画"), { target: { value: "重命名" } });

    const next = commit.mock.calls[0][0] as CanvasAnimationItem[];
    expect(next[0].name).toBe("重命名");
  });
});
