import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PageThumbnailStrip from "../index";

describe("PageThumbnailStrip", () => {
  it("渲染新增页按钮", () => {
    render(
      <PageThumbnailStrip
        activePageId="p1"
        onAddPage={vi.fn()}
        onSelectPage={vi.fn()}
        pageIds={[]}
        pages={{}}
      />,
    );
    expect(document.querySelector(".page-thumbnail-strip")).toBeTruthy();
  });

  it("点击页面会 selectPage", () => {
    const onSelectPage = vi.fn();
    render(
      <PageThumbnailStrip
        activePageId="p1"
        onAddPage={vi.fn()}
        onSelectPage={onSelectPage}
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
});
