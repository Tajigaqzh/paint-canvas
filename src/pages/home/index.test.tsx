import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./index";

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
    Line: MockUI,
    Polygon: MockUI,
    Rect: MockUI,
    Star: MockUI,
    Text: MockUI,
  };
});

describe("Home", () => {
  it("renders the canvas maker shell", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "Canvas 制作工具" })).toBeTruthy();
    expect(screen.getByText("素材")).toBeTruthy();
    expect(screen.getByText("画布区域")).toBeTruthy();
    expect(screen.getByText("属性")).toBeTruthy();
  });
});
