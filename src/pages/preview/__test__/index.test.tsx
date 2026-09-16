import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "@/stores/canvasStore";
import type { LineNode } from "@/types";

// 预览页只测页面自身的接线（状态、清除批注、翻页、工具传递），Leafer 渲染交给 useLeaferCanvas 单测，这里把它空置。
const useLeaferCanvas = vi.fn();
vi.mock("@/pages/home/hooks/useLeaferCanvas", () => ({
  useLeaferCanvas: (...args: unknown[]) => useLeaferCanvas(...args),
}));

// 缩略图由 page-thumbnail worker 异步绘制，属于渲染单测范畴，这里直接空置避免真实起 worker。
vi.mock("@/worker/page-thumbnail/usePageThumbnails", () => ({
  usePageThumbnails: () => ({}),
}));

const renderPreview = () =>
  render(
    <MemoryRouter>
      <PreviewPageWrapper />
    </MemoryRouter>,
  );

// 间接引入组件，确保上面的 vi.mock 先生效。
import PreviewPage from "../index";
const PreviewPageWrapper = PreviewPage;

// 仅用于在测试结束后还原被临时遮蔽的 console.error，见下方 beforeAll。
let origError: typeof console.error | undefined;

const BRUSH_LINE: Omit<LineNode, "id" | "name"> = {
  curve: 0.2,
  fill: "transparent",
  height: 0,
  kind: "line",
  points: [0, 0, 10, 0],
  rotation: 0,
  stroke: "#111827",
  strokeCap: "round",
  strokeStyle: "solid",
  strokeWidth: 8,
  transformOrigin: "top-left",
  width: 10,
  x: 0,
  y: 0,
};

beforeAll(() => {
  // React 19 已知误报：预览页卸载时 cleanup 调 clearPreviewNotes 更新 store，
  // zustand 的 useSyncExternalStore 会在一个已经卸载的组件上再排一次 re-render，
  // 该 re-render 落在 act 之外，触发 “not wrapped in act”。这里只屏蔽这一条良性提示，
  // 卸载本身已用 act 包裹，且断言验证的是 store 状态而非组件渲染，不影响测试有效性。
  const original = console.error;
  origError = original;
  console.error = (...args: unknown[]) => {
    // React 打印的是带 %s 占位符的格式串（"An update to %s inside a test was not wrapped in act(...)."），
    // 这里只屏蔽 PreviewPage 卸载时那条 React 19 + zustand useSyncExternalStore 的良性误报。
    const msg = String(args[0] ?? "");
    if (msg.includes("inside a test was not wrapped in act") && args[1] === "PreviewPage") {
      return;
    }
    original(...(args as []));
  };
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  Element.prototype.requestFullscreen ??= vi.fn();
  document.exitFullscreen ??= vi.fn();
});

afterAll(() => {
  // 还原 console.error，避免污染其它测试文件。
  if (origError) console.error = origError;
});

beforeEach(() => {
  useCanvasStore.getState().reset();
  useLeaferCanvas.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PreviewPage", () => {
  it("渲染预览演示页头与主要操作", () => {
    renderPreview();

    expect(screen.getByRole("heading", { name: "预览演示" })).toBeTruthy();
    expect(screen.getByText("播放动画")).toBeTruthy();
    expect(screen.getByText("演示设置")).toBeTruthy();
    expect(screen.getByText("返回制作")).toBeTruthy();
  });

  it("向 useLeaferCanvas 传递只读、隐藏标尺、只擦预览批注的配置", () => {
    useCanvasStore.getState().addDrawLine(BRUSH_LINE, "preview");
    useCanvasStore.getState().addNode("line", { x: 1, y: 1 });
    renderPreview();

    const options = useLeaferCanvas.mock.calls[0][0] as Record<string, unknown>;
    const erasableFilter = options.erasableFilter as (id: string) => boolean;

    expect(options.readOnly).toBe(true);
    expect(options.showRuler).toBe(false);

    const page = useCanvasStore.getState().activePage;
    const brushId = page.rootIds.find((id) => {
      const node = page.nodeMap[id];

      return node?.kind === "line" && node.source === "preview";
    })!;
    const materialLineId = page.rootIds.find((id) => {
      const node = page.nodeMap[id];

      return node?.kind === "line" && node.source !== "preview";
    })!;

    expect(erasableFilter(brushId)).toBe(true);
    expect(erasableFilter(materialLineId)).toBe(false);
  });

  it("一键清除笔记只删预览批注，保留制作内容", () => {
    useCanvasStore.getState().addDrawLine(BRUSH_LINE, "preview");
    const before = useCanvasStore.getState().activePage;
    const productionCount = before.rootIds.length - 1;

    renderPreview();
    fireEvent.click(screen.getByText("清除笔记"));

    const after = useCanvasStore.getState().activePage;
    expect(after.rootIds.length).toBe(productionCount);
    expect(
      after.rootIds.some((id) => {
        const node = after.nodeMap[id];

        return node?.kind === "line" && node.source === "preview";
      }),
    ).toBe(false);
  });

  it("退出预览页时清掉本轮预览批注，回到制作页不残留", async () => {
    const { unmount } = renderPreview();
    useCanvasStore.getState().addDrawLine(BRUSH_LINE, "preview");

    const active = useCanvasStore.getState().activePage;
    expect(
      active.rootIds.some((id) => {
        const node = active.nodeMap[id];

        return node?.kind === "line" && node.source === "preview";
      }),
    ).toBe(true);

    await act(async () => {
      unmount();
    });
    const after = useCanvasStore.getState().activePage;
    expect(
      after.rootIds.some((id) => {
        const node = after.nodeMap[id];

        return node?.kind === "line" && node.source === "preview";
      }),
    ).toBe(false);
  });

  it("点击页码点切到对应页面并播放动画", () => {
    const { pageIds } = useCanvasStore.getState();
    useCanvasStore.getState().duplicatePage(pageIds[0]);
    const ids = useCanvasStore.getState().pageIds;
    const secondId = ids[1];

    renderPreview();
    fireEvent.click(screen.getByTitle(useCanvasStore.getState().pages[secondId].name));

    expect(useCanvasStore.getState().activePageId).toBe(secondId);
  });
});
