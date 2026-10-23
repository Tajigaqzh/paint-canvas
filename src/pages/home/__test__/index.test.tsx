import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "@/stores/canvasStore";
import Home from "../index";
import { setDraggingMaterialKind } from "../materialDrop";

const { mockDocumentsApi } = vi.hoisted(() => ({
  mockDocumentsApi: {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/api/documents", () => ({ documentsApi: mockDocumentsApi }));
vi.mock("@/hooks/useAppMessage", () => ({
  useAppMessage: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@leafer-in/animate", () => ({}));
vi.mock("@leafer-in/editor", () => ({
  EditorEvent: {
    SELECT: "editor.select",
  },
  InnerEditorEvent: {
    CLOSE: "innerEditor.close",
  },
}));
vi.mock("@leafer-in/text-editor", () => ({}));

// 吸附插件构造时会校验 App 实例，页面用例里的 MockApp 不满足，这里只保留可调用的空壳。
vi.mock("leafer-x-easy-snap", () => ({
  Snap: class {
    enable() {}
  },
}));

// 标尺插件会往 app 上加 Leafer 层，MockApp 没有 addLeafer，这里同样只留空壳。
vi.mock("leafer-x-ruler", () => ({
  Ruler: class {
    dispose() {}
    enabled = true;
    rulerLeafer = { canvas: { hittable: true } };
  },
}));

vi.mock("leafer-ui", () => {
  class MockUI {
    x = 0;
    y = 0;
    width = 0;
    height = 0;

    constructor(data: Record<string, unknown>) {
      Object.assign(this, data);
    }

    add() {}

    destroy() {}

    on() {}

    set(data: Record<string, unknown>) {
      Object.assign(this, data);
    }
  }

  class MockApp {
    editor = {
      cancel: vi.fn(),
      on: vi.fn(),
      select: vi.fn(),
    };

    tree = {
      add: vi.fn(),
      clear: vi.fn(),
      set: vi.fn(),
    };

    destroy() {}
  }

  return {
    App: MockApp,
    DragEvent: {
      END: "drag.end",
    },
    Ellipse: MockUI,
    Frame: MockUI,
    Group: MockUI,
    Image: MockUI,
    Line: MockUI,
    Polygon: MockUI,
    Rect: MockUI,
    Star: MockUI,
    Text: MockUI,
  };
});

const mockCanvasRect = () => {
  const canvas = document.querySelector(".canvas-maker__canvas") as HTMLElement;

  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    bottom: 540,
    height: 540,
    left: 0,
    right: 960,
    top: 0,
    toJSON: () => ({}),
    width: 960,
    x: 0,
    y: 0,
  } as DOMRect);
};

describe("Home", () => {
  const renderEditor = (path = "/editor/new") =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Home />} path="/editor/:documentId" />
        </Routes>
      </MemoryRouter>,
    );

  beforeEach(() => {
    useCanvasStore.getState().reset();
    setDraggingMaterialKind(undefined);
    mockDocumentsApi.create.mockReset();
    mockDocumentsApi.get.mockReset();
    mockDocumentsApi.list.mockReset();
    mockDocumentsApi.update.mockReset();
    mockDocumentsApi.list.mockResolvedValue({ items: [], limit: 100, offset: 0 });
  });

  afterEach(() => {
    setDraggingMaterialKind(undefined);
  });

  it("renders the canvas maker shell", () => {
    renderEditor();

    expect(screen.getByRole("heading", { name: "画布制作工具" })).toBeTruthy();
    expect(screen.getByText("素材")).toBeTruthy();
    expect(screen.getByText("画布区域")).toBeTruthy();
    expect(screen.getByText("属性")).toBeTruthy();
  });

  it("默认画布尺寸为 1920 x 1080 并可调整宽度", async () => {
    renderEditor();
    const widthInput = screen.getByRole("spinbutton", { name: "画布宽度" });

    expect(widthInput).toHaveValue("1920");
    fireEvent.change(widthInput, { target: { value: "1280" } });

    await waitFor(() => expect(useCanvasStore.getState().activePage.viewport.width).toBe(1280));
  });

  it("首次保存创建后端文档，后续保存携带最新 revision 更新", async () => {
    const saved = {
      id: "doc-1",
      name: "Page 1",
      revision: 1,
      data: useCanvasStore.getState(),
      createdAt: "2026-10-23T00:00:00Z",
      updatedAt: "2026-10-23T00:00:00Z",
    };
    mockDocumentsApi.create.mockResolvedValue(saved);
    mockDocumentsApi.update.mockResolvedValue({ ...saved, revision: 2 });
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => expect(mockDocumentsApi.create).toHaveBeenCalledTimes(1));
    const saveButton = screen.getByRole("button", { name: /保存/ });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);
    await waitFor(() =>
      expect(mockDocumentsApi.update).toHaveBeenCalledWith(
        "doc-1",
        expect.objectContaining({ revision: 1 }),
      ),
    );
  });

  it("进入作品路由后从后端加载文档替换当前画布", async () => {
    const loadedDocument = {
      activePageId: "loaded-page",
      pageIds: ["loaded-page"],
      pages: {
        "loaded-page": {
          id: "loaded-page",
          name: "Loaded page",
          nodeMap: {},
          rootIds: [],
          selectedIds: [],
          viewport: { width: 1920, height: 1080 },
        },
      },
    };
    mockDocumentsApi.get.mockResolvedValue({
      id: "doc-1",
      name: "Remote document",
      revision: 1,
      data: loadedDocument,
    });
    renderEditor("/editor/doc-1");

    await waitFor(() => expect(useCanvasStore.getState().activePage.name).toBe("Loaded page"));
    await waitFor(() => expect(screen.getByRole("button", { name: /保存/ })).toBeEnabled());
    expect(mockDocumentsApi.get).toHaveBeenCalledWith("doc-1");
  });

  it("未开始拖素材时 drop 不新增节点", () => {
    renderEditor();
    mockCanvasRect();
    const before = useCanvasStore.getState().activePage.rootIds.length;
    fireEvent.drop(document.querySelector(".canvas-maker__canvas") as HTMLElement, {
      clientX: 480,
      clientY: 270,
      dataTransfer: { dropEffect: "none" },
    });
    expect(useCanvasStore.getState().activePage.rootIds.length).toBe(before);
  });

  it("拖矩形放到画布中心会按落点创建节点", () => {
    renderEditor();
    mockCanvasRect();
    setDraggingMaterialKind("rect");
    const canvas = document.querySelector(".canvas-maker__canvas") as HTMLElement;
    // 白板要给左上角标尺刻度条让位，所以白板中心不等于视图中心。
    const dropEvent = new MouseEvent("drop", {
      bubbles: true,
      cancelable: true,
      clientX: 490,
      clientY: 280,
    });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { dropEffect: "copy" },
    });
    fireEvent(canvas, dropEvent);
    const id = useCanvasStore.getState().activePage.activeId;
    const node = useCanvasStore.getState().activePage.nodeMap[id!];
    expect(node).toMatchObject({ kind: "rect", x: 960, y: 540 });
  });
});
