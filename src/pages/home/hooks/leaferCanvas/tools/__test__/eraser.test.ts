import { describe, expect, it, vi } from "vitest";
import type { LineEraserPreview, ToolDrawingState } from "@/types";
import { getLineEraserUpdates } from "../eraser";

vi.mock("leafer-ui", () => ({
  Line: vi.fn(),
}));

describe("getLineEraserUpdates", () => {
  it("过滤掉不足一个点对的路径，并带上 eraser 宽度", () => {
    const drawing = {
      erasedIds: new Set<string>(),
      lineErasers: new Map<string, LineEraserPreview>([
        [
          "keep",
          {
            nodeX: 0,
            nodeY: 0,
            parentOffset: { x: 0, y: 0 },
            path: [1, 2, 3, 4],
            tempLine: { destroy: vi.fn(), set: vi.fn() } as never,
          },
        ],
        [
          "drop",
          {
            nodeX: 0,
            nodeY: 0,
            parentOffset: { x: 0, y: 0 },
            path: [1],
            tempLine: { destroy: vi.fn(), set: vi.fn() } as never,
          },
        ],
      ]),
      pointerId: 1,
      points: [],
    } satisfies ToolDrawingState;

    expect(getLineEraserUpdates(drawing, 12)).toEqual([
      { id: "keep", points: [1, 2, 3, 4], strokeWidth: 12 },
    ]);
  });
});
