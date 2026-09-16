import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasPage } from "@/types";
import PreviewPageStrip from "../PreviewPageStrip";

// 缩略图位图由 page-thumbnail worker 异步产出，这里直接注入假位图，不真正起 worker。
const usePageThumbnails = vi.fn();
vi.mock("@/worker/page-thumbnail/usePageThumbnails", () => ({
  usePageThumbnails: (...args: unknown[]) => usePageThumbnails(...args),
}));

const makePage = (id: string, name: string): CanvasPage => ({
  id,
  name,
  nodeMap: {},
  rootIds: [],
  selectedIds: [],
  viewport: { height: 1080, width: 1920 },
});

const fakeBitmap = { height: 78, width: 138 } as unknown as ImageBitmap;

const baseProps = (override: Record<string, unknown> = {}) => ({
  activePageId: "p1",
  collapsed: false,
  onSelectPage: vi.fn(),
  onToggleCollapsed: vi.fn(),
  pageIds: ["p1", "p2", "p3"],
  pages: {
    p1: makePage("p1", "封面"),
    p2: makePage("p2", "内容"),
    p3: makePage("p3", "结尾"),
  },
  ...override,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PreviewPageStrip", () => {
  it("每页渲染一个缩略图按钮，标题为页面名", () => {
    usePageThumbnails.mockReturnValue({
      p1: { bitmap: fakeBitmap },
      p2: { bitmap: fakeBitmap },
      p3: { bitmap: fakeBitmap },
    });

    render(<PreviewPageStrip {...baseProps()} />);

    expect(document.querySelectorAll(".preview__page-thumb")).toHaveLength(3);
    expect(screen.getByTitle("封面")).toBeTruthy();
    expect(screen.getByTitle("内容")).toBeTruthy();
    expect(screen.getByTitle("结尾")).toBeTruthy();
  });

  it("点击缩略图调用 onSelectPage 并传入该页 id", () => {
    const onSelectPage = vi.fn();
    usePageThumbnails.mockReturnValue({});

    render(<PreviewPageStrip {...baseProps({ onSelectPage })} />);

    fireEvent.click(screen.getByTitle("结尾"));
    expect(onSelectPage).toHaveBeenCalledWith("p3");
  });

  it("激活页带 --active 高亮", () => {
    usePageThumbnails.mockReturnValue({});

    const { container } = render(<PreviewPageStrip {...baseProps({ activePageId: "p2" })} />);
    const active = container.querySelector(".preview__page-thumb--active");

    expect(active).toBeTruthy();
    expect(active?.getAttribute("title")).toBe("内容");
  });

  it("收起后只显示展开按钮", () => {
    usePageThumbnails.mockReturnValue({});

    render(<PreviewPageStrip {...baseProps({ collapsed: true })} />);

    expect(document.querySelectorAll(".preview__page-thumb")).toHaveLength(0);
    // 收起态整条只有一个按钮（展开按钮）。
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("收起态点击展开按钮调用 onToggleCollapsed", () => {
    const onToggleCollapsed = vi.fn();
    usePageThumbnails.mockReturnValue({});

    render(<PreviewPageStrip {...baseProps({ collapsed: true, onToggleCollapsed })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggleCollapsed).toHaveBeenCalled();
  });

  it("上一切切换按钮在第一页时循环到最后一页", () => {
    const onSelectPage = vi.fn();
    usePageThumbnails.mockReturnValue({});

    render(<PreviewPageStrip {...baseProps({ activePageId: "p1", onSelectPage })} />);
    // 展开条按钮顺序：左箭头、右箭头、收起。左箭头是第一个。
    fireEvent.click(document.querySelectorAll(".preview__strip > button")[0]);
    expect(onSelectPage).toHaveBeenCalledWith("p3");
  });

  it("下一切切换按钮在最后一页时循环到第一页", () => {
    const onSelectPage = vi.fn();
    usePageThumbnails.mockReturnValue({});

    render(<PreviewPageStrip {...baseProps({ activePageId: "p3", onSelectPage })} />);
    const rightButton = document.querySelectorAll(".preview__strip > button")[1];
    fireEvent.click(rightButton);
    expect(onSelectPage).toHaveBeenCalledWith("p1");
  });

  it("展开态点击收起按钮调用 onToggleCollapsed", () => {
    const onToggleCollapsed = vi.fn();
    usePageThumbnails.mockReturnValue({});

    render(<PreviewPageStrip {...baseProps({ onToggleCollapsed })} />);
    // 收起按钮是展开条的最后一个按钮。
    fireEvent.click(document.querySelectorAll(".preview__strip > button")[2]);
    expect(onToggleCollapsed).toHaveBeenCalled();
  });

  it("缩略图渲染失败时显示渲染失败", () => {
    usePageThumbnails.mockReturnValue({
      p1: { error: "boom" },
      p2: {},
      p3: {},
    });

    render(<PreviewPageStrip {...baseProps({ activePageId: "p1" })} />);
    expect(screen.getByText("渲染失败")).toBeTruthy();
  });
});
