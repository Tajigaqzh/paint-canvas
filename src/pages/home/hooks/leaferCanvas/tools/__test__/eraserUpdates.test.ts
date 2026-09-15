import { describe, expect, it } from "vitest";
import type { IUI } from "leafer-ui";
import type { EraserEraseEvent } from "leafer-x-brush-eraser";
import type { CanvasNode, ManagedNodeUI } from "@/types";
import type { EraserMaps } from "../eraserUpdates";
import { getLineEraserUpdates, isErasableLineTarget } from "../eraserUpdates";

/** line 节点在 uiMap 里对应 group，命中项是 group 内部的图形子节点。 */
const createMaps = () => {
  const lineGroup = { name: "line-group" } as unknown as ManagedNodeUI;
  const rect = { name: "rect" } as unknown as ManagedNodeUI;
  const contentLine = { parent: lineGroup } as unknown as IUI;
  const uiMap = new Map<string, ManagedNodeUI>([
    ["line-1", lineGroup],
    ["rect-1", rect],
  ]);
  const uiKindMap = new Map<string, CanvasNode["kind"]>([
    ["line-1", "line"],
    ["rect-1", "rect"],
  ]);

  return { contentLine, lineGroup, maps: { uiKindMap, uiMap } as EraserMaps, rect };
};

const createStroke = (overrides: Partial<EraserEraseEvent> = {}): EraserEraseEvent => ({
  container: {} as IUI,
  offset: { x: 0, y: 0 },
  points: [10, 20, 30, 40],
  strokeWidth: 24,
  target: {} as IUI,
  ...overrides,
});

describe("isErasableLineTarget", () => {
  it("命中 line group 的子节点时可以擦", () => {
    const { contentLine, maps } = createMaps();

    expect(isErasableLineTarget(contentLine, maps)).toBe(true);
  });

  it("直接命中 line group 本身时也可以擦", () => {
    const { lineGroup, maps } = createMaps();

    expect(isErasableLineTarget(lineGroup as unknown as IUI, maps)).toBe(true);
  });

  it("矩形等非 line 节点不可擦", () => {
    const { maps, rect } = createMaps();

    expect(isErasableLineTarget(rect as unknown as IUI, maps)).toBe(false);
  });

  it("不在托管索引里的元素不可擦", () => {
    const { maps } = createMaps();

    expect(isErasableLineTarget({ parent: undefined } as unknown as IUI, maps)).toBe(false);
  });
});

describe("getLineEraserUpdates", () => {
  it("把轨迹按 group 反查成节点级 eraser 更新", () => {
    const { contentLine, lineGroup, maps } = createMaps();

    expect(
      getLineEraserUpdates(
        [createStroke({ container: lineGroup, points: [1, 2, 3, 4], target: contentLine })],
        maps,
      ),
    ).toEqual([{ id: "line-1", points: [1, 2, 3, 4], strokeWidth: 24 }]);
  });

  it("命中非 line 节点时被过滤掉", () => {
    const { maps, rect } = createMaps();

    expect(getLineEraserUpdates([createStroke({ container: rect, target: rect })], maps)).toEqual(
      [],
    );
  });

  it("多个目标各生成一条更新", () => {
    const { contentLine, lineGroup, maps } = createMaps();

    expect(
      getLineEraserUpdates(
        [
          createStroke({ container: lineGroup, points: [1, 2], target: contentLine }),
          createStroke({
            container: lineGroup,
            points: [3, 4],
            strokeWidth: 8,
            target: contentLine,
          }),
        ],
        maps,
      ),
    ).toEqual([
      { id: "line-1", points: [1, 2], strokeWidth: 24 },
      { id: "line-1", points: [3, 4], strokeWidth: 8 },
    ]);
  });

  it("空轨迹返回空数组", () => {
    const { maps } = createMaps();

    expect(getLineEraserUpdates([], maps)).toEqual([]);
  });
});
