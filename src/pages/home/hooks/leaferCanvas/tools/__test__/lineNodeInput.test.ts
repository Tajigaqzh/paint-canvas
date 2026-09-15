import { describe, expect, it } from "vitest";
import { getLineNodeInput } from "../lineNodeInput";

const createEvent = (overrides: Partial<Parameters<typeof getLineNodeInput>[0]> = {}) => ({
  height: 40,
  points: [0, 0, 30, 40],
  stroke: "#111827",
  strokeWidth: 4,
  width: 30,
  x: 10,
  y: 20,
  ...overrides,
});

describe("getLineNodeInput", () => {
  it("把插件事件补成完整的 line 节点输入", () => {
    expect(getLineNodeInput(createEvent())).toEqual({
      animationList: [],
      curve: 0.2,
      fill: "transparent",
      height: 40,
      kind: "line",
      points: [0, 0, 30, 40],
      rotation: 0,
      stroke: "#111827",
      strokeCap: "round",
      strokeStyle: "solid",
      strokeWidth: 4,
      transformOrigin: "top-left",
      width: 30,
      x: 10,
      y: 20,
    });
  });

  it("描边颜色和粗细直接取自插件事件", () => {
    const input = getLineNodeInput(createEvent({ stroke: "#ff0000", strokeWidth: 20 }));

    expect(input).toMatchObject({ stroke: "#ff0000", strokeWidth: 20 });
  });

  it("几何字段原样透传，不做二次归一化", () => {
    const input = getLineNodeInput(
      createEvent({ height: 1, points: [0, 0, 0.1, 0.1], width: 1, x: 100, y: 100 }),
    );

    expect(input).toMatchObject({ height: 1, points: [0, 0, 0.1, 0.1], width: 1, x: 100, y: 100 });
  });
});
