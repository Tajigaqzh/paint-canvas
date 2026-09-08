import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "@/stores/canvasStore";
import Home from "../index";
import { setDraggingMaterialKind } from "../materialDrop";

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
  beforeEach(() => {
    useCanvasStore.getState().reset();
    setDraggingMaterialKind(undefined);
  });

  afterEach(() => {
    setDraggingMaterialKind(undefined);
  });

  it("renders the canvas maker shell", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "Canvas 制作工具" })).toBeTruthy();
    expect(screen.getByText("素材")).toBeTruthy();
    expect(screen.getByText("画布区域")).toBeTruthy();
    expect(screen.getByText("属性")).toBeTruthy();
  });

  it("未开始拖素材时 drop 不新增节点", () => {
    render(<Home />);
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
    render(<Home />);
    mockCanvasRect();
    setDraggingMaterialKind("rect");
    const canvas = document.querySelector(".canvas-maker__canvas") as HTMLElement;
    const dropEvent = new MouseEvent("drop", {
      bubbles: true,
      cancelable: true,
      clientX: 480,
      clientY: 270,
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
