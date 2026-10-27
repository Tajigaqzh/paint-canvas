import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TextNode } from "@/types";
import type { ITextPathMode } from "leafer-x-richTextPlus";
import PropertyPanel from "../index";

const textNode: TextNode = {
  animationList: [],
  fill: "#111827",
  fontSize: 24,
  fontWeight: 400,
  id: "text-1",
  kind: "text",
  lineHeight: 36,
  name: "Text",
  rotation: 0,
  styleRanges: [{ start: 0, end: 1, fill: "#ff0000", fontWeight: 700 }],
  text: "abcd",
  transformOrigin: "center",
  x: 0,
  y: 0,
};

describe("PropertyPanel", () => {
  it("invalid polygon side count displays the minimum of three", () => {
    render(
      <PropertyPanel
        canUngroup={false}
        collapsed={false}
        node={{ ...textNode, textPath: { mode: "polygon" as ITextPathMode, sideCount: 2 } }}
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("多边形边数")).toHaveValue("3");
  });

  it("收起时不显示属性标题", () => {
    render(
      <PropertyPanel
        canUngroup={false}
        collapsed
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={vi.fn()}
      />,
    );
    expect(screen.queryByText("属性")).toBeNull();
  });

  it("展开且无节点时显示空状态", () => {
    render(
      <PropertyPanel
        canUngroup={false}
        collapsed={false}
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={vi.fn()}
      />,
    );
    expect(screen.getByText("属性")).toBeTruthy();
  });

  it("选中文字改填充只更新选区并保留已有字重", () => {
    const onUpdateNode = vi.fn();
    render(
      <PropertyPanel
        canUngroup={false}
        characterSelection={{ start: 0, end: 2 }}
        collapsed={false}
        node={textNode}
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={onUpdateNode}
      />,
    );

    fireEvent.change(screen.getByLabelText("文字颜色"), { target: { value: "#00ff00" } });

    expect(onUpdateNode).toHaveBeenCalledWith("text-1", {
      styleRanges: [
        { start: 0, end: 1, fill: "#00ff00", fontWeight: 700 },
        { start: 1, end: 2, fill: "#00ff00" },
      ],
    });
  });

  it("选中文字改字号时保留其他样式范围", () => {
    const onUpdateNode = vi.fn();
    render(
      <PropertyPanel
        canUngroup={false}
        characterSelection={{ start: 1, end: 3 }}
        collapsed={false}
        node={textNode}
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={onUpdateNode}
      />,
    );

    fireEvent.change(screen.getByLabelText("字号"), { target: { value: "40" } });
    expect(onUpdateNode).toHaveBeenLastCalledWith("text-1", {
      styleRanges: [
        { start: 0, end: 1, fill: "#ff0000", fontWeight: 700 },
        { start: 1, end: 3, fontSize: 40 },
      ],
    });


  });

  it("选区存在时行高仍作为整段属性更新", () => {
    const onUpdateNode = vi.fn();
    render(
      <PropertyPanel
        canUngroup={false}
        characterSelection={{ start: 1, end: 3 }}
        collapsed={false}
        node={textNode}
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={onUpdateNode}
      />,
    );

    fireEvent.change(screen.getByLabelText("行高"), { target: { value: "48" } });

    expect(onUpdateNode).toHaveBeenCalledWith("text-1", { lineHeight: 48 });
  });

  it("圆形文字显示路径属性", () => {
    render(
      <PropertyPanel
        canUngroup={false}
        collapsed={false}
        node={{ ...textNode, textPath: { mode: "circle" as ITextPathMode, radius: 140, side: "inner" } }}
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("路径半径")).toHaveValue("140");
    expect(screen.getByText("文字朝向")).toBeTruthy();
    expect(screen.getByText("起始角度")).toBeTruthy();
    expect(screen.getByText("编辑路径").closest("button")).toBeTruthy();
  });

  it("正多边形文字提供边数和路径编辑入口", () => {
    render(
      <PropertyPanel
        canUngroup={false}
        collapsed={false}
        node={{ ...textNode, textPath: { mode: "polygon" as ITextPathMode, radius: 120, sideCount: 5 } }}
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("多边形边数")).toHaveValue("5");
    expect(screen.getByText("编辑路径").closest("button")).toBeTruthy();
  });

  it("选中文字可写入字符旋转角度", () => {
    const onUpdateNode = vi.fn();
    render(
      <PropertyPanel
        canUngroup={false}
        characterSelection={{ start: 1, end: 3 }}
        collapsed={false}
        node={textNode}
        onToggle={vi.fn()}
        onUngroup={vi.fn()}
        onUpdateNode={onUpdateNode}
      />,
    );

    fireEvent.change(screen.getByLabelText("字符旋转"), { target: { value: "15" } });
    expect(onUpdateNode).toHaveBeenLastCalledWith("text-1", {
      styleRanges: [
        { start: 0, end: 1, fill: "#ff0000", fontWeight: 700 },
        { start: 1, end: 3, rotation: 15 },
      ],
    });
  });
});
