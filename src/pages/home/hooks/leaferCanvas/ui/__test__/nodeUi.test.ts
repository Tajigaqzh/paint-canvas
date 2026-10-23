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
  it("creates the line Group using persisted dimensions", () => {
    createNodeUI(lineNode({ height: 30, width: 20 }));

    expect(vi.mocked(Group)).toHaveBeenCalledWith(
      expect.objectContaining({ height: 30, width: 20 }),
    );
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
