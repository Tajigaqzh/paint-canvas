import { describe, expect, it } from "vitest";
import { renderRegularPolygonPath } from "../polygon";

const createContext = () => {
  const calls: string[] = [];
  return {
    calls,
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    lineTo: () => calls.push("lineTo"),
    moveTo: () => calls.push("moveTo"),
  } as unknown as OffscreenCanvasRenderingContext2D & { calls: string[] };
};

describe("renderRegularPolygonPath", () => {
  it("sides 小于 3 仍按 3 边绘制", () => {
    const context = createContext();
    renderRegularPolygonPath(context, 100, 100, 1);
    expect(context.calls.filter((name) => name === "lineTo").length).toBe(2);
    expect(context.calls).toContain("closePath");
  });

  it("正方形四条边", () => {
    const context = createContext();
    renderRegularPolygonPath(context, 80, 80, 4);
    expect(context.calls.filter((name) => name === "lineTo").length).toBe(3);
  });
});
