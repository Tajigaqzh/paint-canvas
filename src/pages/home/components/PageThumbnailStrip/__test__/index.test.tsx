import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PageThumbnailStrip from "../index";

describe("PageThumbnailStrip", () => {
  const baseProps = {
    onAddPage: vi.fn(),
    onDuplicatePage: vi.fn(),
    onInsertBlankPage: vi.fn(),
    onRemovePage: vi.fn(),
    onSelectPage: vi.fn(),
  };

  it("渲染新增页按钮", () => {
    render(
      <PageThumbnailStrip {...baseProps} activePageId="p1" pageIds={[]} pages={{}} />,
    );
    expect(document.querySelector(".page-thumbnail-strip")).toBeTruthy();
  });

  it("点击页面会 selectPage", () => {
    const onSelectPage = vi.fn();
    render(
      <PageThumbnailStrip
        {...baseProps}
        onSelectPage={onSelectPage}
        activePageId="p1"
        pageIds={["p1"]}
        pages={{
          p1: {
            id: "p1",
            name: "页面 1",
            nodeMap: {},
            rootIds: [],
            selectedIds: [],
            viewport: { height: 1080, width: 1920 },
          },
        }}
      />,
    );
    fireEvent.click(screen.getByText("页面 1"));
    expect(onSelectPage).toHaveBeenCalledWith("p1");
  });

  it("右键菜单点击复制当前页会调用 onDuplicatePage，并传入被右键的页 id", () => {
    const onDuplicatePage = vi.fn();
    render(
      <PageThumbnailStrip
        {...baseProps}
        onDuplicatePage={onDuplicatePage}
        activePageId="p1"
        pageIds={["p1"]}
        pages={{
          p1: {
            id: "p1",
            name: "页面 1",
            nodeMap: {},
            rootIds: [],
            selectedIds: [],
            viewport: { height: 1080, width: 1920 },
          },
        }}
      />,
    );
    fireEvent.contextMenu(screen.getByText("页面 1"));
    fireEvent.click(screen.getByText("复制当前页"));
    expect(onDuplicatePage).toHaveBeenCalledWith("p1");
  });

  it("只有一页时删除菜单项禁用", () => {
    render(
      <PageThumbnailStrip {...baseProps} activePageId="p1" pageIds={["p1"]} pages={{
        p1: {
          id: "p1",
          name: "页面 1",
          nodeMap: {},
          rootIds: [],
          selectedIds: [],
          viewport: { height: 1080, width: 1920 },
        },
      }} />,
    );
    fireEvent.contextMenu(screen.getByText("页面 1"));
    const deleteItem = screen.getByText("删除当前页").closest("li");
    expect(deleteItem).toHaveAttribute("aria-disabled", "true");
  });
});
