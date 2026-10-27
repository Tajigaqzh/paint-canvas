import { describe, expect, it, vi } from "vitest";
import { Group } from "leafer-ui";
import type { LineNode } from "@/types";
import { createNodeUI, getNodePatchFromUI, getNodeUIInput, hasNodePatchChange } from "../nodeUi";

vi.mock("leafer-ui", () => {
  const MockUI = vi.fn(
    class {
      add = vi.fn();

      set = vi.fn();

      constructor(input: Record<string, unknown>) {
        Object.assign(this, input);
      }
    },
  );

  return {
    Ellipse: MockUI,
    Group: MockUI,
    Image: MockUI,
    Polygon: MockUI,
    Rect: MockUI,
    Star: MockUI,
    Text: MockUI,
  };
});

vi.mock("../lineUi", () => ({
  getLineClassPrefix: () => "brush",
  syncLineGroupContent: vi.fn(),
}));

vi.mock("leafer-x-richTextPlus", () => ({
  RichTextPlus: class {
    constructor(input: Record<string, unknown>) {
      Object.assign(this, input);
    }
  },
}));

const lineNode = (overrides: Partial<LineNode> = {}): LineNode => ({
  height: 10,
  id: "line-1",
  kind: "line",
  name: "line",
  points: [0, 0, 10, 10],
  rotation: 0,
  strokeWidth: 4,
  transformOrigin: "top-left",
  width: 10,
  x: 0,
  y: 0,
  ...overrides,
});

describe("getNodeUIInput", () => {
  it("maps persisted dimensions to the line Group", () => {
    expect(getNodeUIInput(lineNode({ height: 30, width: 20 }))).toMatchObject({
      height: 30,
      width: 20,
    });
  });
});

describe("getNodePatchFromUI", () => {
  it("persists text scaling so it survives page changes", () => {
    const node = {
      animationList: [],
      fill: "#111827",
      fontSize: 28,
      id: "text-1",
      kind: "text",
      name: "text",
      text: "A",
      x: 0,
      y: 0,
    } as const;
    const patch = getNodePatchFromUI(
      {
        fontSize: 50,
        lineHeight: 60,
        rotation: 0,
        scaleX: 1.8,
        scaleY: 1.4,
        styleRanges: [{ start: 0, end: 1, fill: "#ff0000" }],
        x: 10,
        y: 20,
      } as never,
      node as never,
    );

    expect(patch).toMatchObject({
      fontSize: 50,
      lineHeight: 60,
      scaleX: 1.8,
      scaleY: 1.4,
      styleRanges: [{ start: 0, end: 1, fill: "#ff0000" }],
      x: 10,
      y: 20,
    });
  });

  it("persists resized child geometry and dimensions", () => {
    const node = lineNode();
    const patch = getNodePatchFromUI(
      {
        __eraserContent: [],
        __lineContent: { points: [0, 0, 20, 30], strokeWidth: 4 },
        height: 30,
        rotation: 0,
        width: 20,
        x: 40,
        y: 50,
      } as never,
      node,
    );

    expect(patch).toMatchObject({ height: 30, points: [0, 0, 20, 30], width: 20, x: 40, y: 50 });
  });

  it("does not rewrite unchanged line geometry while dragging", () => {
    const node = lineNode();
    const patch = getNodePatchFromUI(
      {
        __eraserContent: [],
        __lineContent: { points: [...(node.points ?? [])], strokeWidth: node.strokeWidth },
        height: 10,
        rotation: 0,
        width: 10,
        x: 20,
        y: 30,
      } as never,
      node,
    );

    expect(patch).toMatchObject({ x: 20, y: 30 });
    expect("points" in patch).toBe(false);
  });
});

describe("createNodeUI", () => {
  it("creates text nodes with RichTextPlus and persisted character styles", () => {
    const styleRanges = [{ start: 0, end: 1, fill: "#ff0000" }];
    const ui = createNodeUI({
      animationList: [],
      fill: "#111827",
      fontSize: 28,
      id: "text-1",
      kind: "text",
      name: "text",
      styleRanges,
      lineHeight: 34,
      text: "A",
      transformOrigin: "center",
      x: 10,
      y: 20,
    });

    expect(ui).toMatchObject({ lineHeight: 34, text: "A", styleRanges });
  });

  it("creates the line Group using persisted dimensions", () => {
    createNodeUI(lineNode({ height: 30, width: 20 }));

    expect(vi.mocked(Group)).toHaveBeenCalledWith(
      expect.objectContaining({ height: 30, width: 20 }),
    );
  });

  it("restores persisted text scales when rebuilding its UI", () => {
    const input = getNodeUIInput({
      animationList: [],
      fill: "#111827",
      fontSize: 28,
      id: "text-1",
      kind: "text",
      name: "text",
      scaleX: 1.8,
      scaleY: 1.4,
      text: "A",
      x: 10,
      y: 20,
    } as never);

    expect(input).toMatchObject({ scaleX: 1.8, scaleY: 1.4 });
  });

  it("maps persisted text path data to RichTextPlus", () => {
    const input = getNodeUIInput({
      animationList: [],
      fill: "#111827",
      fontSize: 28,
      id: "text-path-1",
      kind: "text",
      name: "path text",
      pathAlign: "center",
      pathDirection: "reverse",
      pathRadius: 140,
      pathSide: "inner",
      text: "Path",
      textPath: "circle",
      x: 10,
      y: 20,
    } as never);

    expect(input).toMatchObject({
      pathAlign: "center",
      pathDirection: "reverse",
      pathRadius: 140,
      pathSide: "inner",
      textPath: "circle",
    });
  });
});

describe("hasNodePatchChange", () => {
  it("returns false when a field is unchanged", () => {
    expect(hasNodePatchChange(lineNode(), { x: 0 })).toBe(false);
  });

  it("detects dimension changes", () => {
    expect(hasNodePatchChange(lineNode(), { width: 20 })).toBe(true);
  });
});
