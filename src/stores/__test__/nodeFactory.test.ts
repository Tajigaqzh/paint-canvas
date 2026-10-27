import { describe, expect, it } from "vitest";
import { createNode } from "../nodeFactory";

describe("createNode", () => {
  it.each([
    ["rect", "rect"],
    ["text", "text"],
    ["curvedText", "curvedText"],
    ["line", "line"],
    ["triangle", "polygon"],
    ["polygon", "polygon"],
    ["star", "star"],
    ["circle", "ellipse"],
    ["ellipse", "ellipse"],
    ["ring", "ellipse"],
    ["sector", "ellipse"],
    ["sector-ring", "ellipse"],
    ["arc", "ellipse"],
    ["image", "image"],
  ] as const)("%s 生成 %s 节点并包含默认位置与序号", (kind, expectedKind) => {
    const node = createNode(kind, { id: "test-node", index: 2, serial: 7 });

    expect(node).toMatchObject({
      animationList: [],
      id: "test-node",
      kind: expectedKind,
      x: 228,
      y: 180,
    });
    expect(node.name).toContain("7");
  });

  it("arc 使用开放路径和圆角描边", () => {
    expect(createNode("arc", { id: "arc", index: 0, serial: 1 })).toMatchObject({
      closed: false,
      fill: "transparent",
      stroke: "#32cd79",
      strokeCap: "round",
      strokeWidth: 10,
    });
  });

  it("sector-ring 使用内半径与圆角", () => {
    expect(createNode("sector-ring", { id: "sector-ring", index: 0, serial: 1 })).toMatchObject({
      cornerRadius: 10,
      endAngle: 180,
      innerRadius: 0.5,
      startAngle: -60,
    });
  });

  it("曲线文字包含默认圆弧布局与富文本样式", () => {
    expect(createNode("curvedText", { id: "curve", index: 0, serial: 1 })).toMatchObject({
      defaultStyle: { fontSize: 32 },
      layout: { bendAngle: 90, direction: "clockwise", radius: 360 },
      styleRuns: [],
    });
  });
});
