import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurvedText } from "../src";

  const { MockGroup, MockText, MockRect } = vi.hoisted(() => {
  class MockGroup {
    children: MockText[] = [];
    data: Record<string, unknown>;
    destroyed = false;
    listeners = new Map<string, (event: unknown) => void>();

    constructor(data: Record<string, unknown>) {
      this.data = { ...data };
    }

    add(child: MockText) {
      this.children.push(child);
    }

    on(type: string, listener: (event: unknown) => void) {
      this.listeners.set(type, listener);
    }

    removeAll() {
      this.children = [];
    }

    set(data: Record<string, unknown>) {
      Object.assign(this.data, data);
    }

    toJSON() {
      return { ...this.data, children: this.children.map((child) => child.data) };
    }

    destroy() {
      this.destroyed = true;
      this.removeAll();
    }
  }

  class MockText {
    data: Record<string, unknown>;
    listeners = new Map<string, (event: unknown) => void>();

    constructor(data: Record<string, unknown>) {
      this.data = { ...data };
    }

    get x() {
      return this.data.x as number;
    }

    get y() {
      return this.data.y as number;
    }

    set(data: Record<string, unknown>) {
      Object.assign(this.data, data);
    }

    on(type: string, listener: (event: unknown) => void) {
      this.listeners.set(type, listener);
    }
  }

  class MockRect extends MockText {}

  return { MockGroup, MockText, MockRect };
});

vi.mock("@leafer-ui/core", () => ({ Group: MockGroup, Rect: MockRect, Text: MockText }));

const createCurvedText = (overrides: Record<string, unknown> = {}) =>
  new CurvedText({
    text: "ABC",
    layout: { bendAngle: 100, radius: 80 },
    measureGrapheme: () => 10,
    characterEditing: true,
    ...overrides,
  } as ConstructorParameters<typeof CurvedText>[0]);

describe("CurvedText", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("按字素簇创建独立 Leafer Text 子对象", () => {
    const curvedText = createCurvedText();

    expect((curvedText as unknown as InstanceType<typeof MockGroup>).children).toHaveLength(4);
    expect(curvedText.text).toBe("ABC");
  });

  it("点击编辑控制点切换字符编辑模式", () => {
    const curvedText = createCurvedText({ characterEditing: false });
    const handle = (curvedText as unknown as InstanceType<typeof MockGroup>).children.at(-1)!;

    expect(curvedText.characterEditing).toBe(false);
    handle.listeners.get("tap")?.({});
    expect(curvedText.characterEditing).toBe(true);
    handle.listeners.get("tap")?.({});
    expect(curvedText.characterEditing).toBe(false);
    expect(curvedText.data).toMatchObject({ draggable: true, editable: true });
  });

  it("字符编辑激活时禁用外层拖拽和编辑", () => {
    const curvedText = createCurvedText({ characterEditing: false });

    curvedText.characterEditing = true;

    expect((curvedText as unknown as InstanceType<typeof MockGroup>).data).toMatchObject({
      draggable: false,
      editable: false,
    });
  });

  it("默认样式与区间样式分别应用到对应字素", () => {
    const curvedText = createCurvedText({
      defaultStyle: { fontFamily: "Sans", fontSize: 12, fill: "#111" },
      styleRuns: [{ start: 1, end: 2, style: { fontSize: 24, fill: "#f00", stroke: "#000" } }],
    });
    const children = (curvedText as unknown as InstanceType<typeof MockGroup>).children;

    expect(children.slice(0, 3).map(({ data }) => data.fontSize)).toEqual([12, 24, 12]);
    expect(children[1].data).toMatchObject({ fill: "#f00", stroke: "#000", strokeWidth: undefined });
  });

  it("更新文本后重建字符对象并裁剪过期选区", () => {
    const curvedText = createCurvedText();
    curvedText.setCharacterSelection({ start: 1, end: 3 });

    curvedText.setText("A");

    expect((curvedText as unknown as InstanceType<typeof MockGroup>).children).toHaveLength(2);
    expect(curvedText.characterSelection).toBeUndefined();
  });

  it("setLayout 会重新计算字素位置", () => {
    const curvedText = createCurvedText();
    const before = (curvedText as unknown as InstanceType<typeof MockGroup>).children[0].data.x;

    curvedText.setLayout({ direction: "counterclockwise" });

    const after = (curvedText as unknown as InstanceType<typeof MockGroup>).children[0].data.x;
    expect(after).not.toBe(before);
  });

  it("修改半径会重新计算字符切线旋转", () => {
    const curvedText = createCurvedText({
      layout: { bendAngle: 120, radius: 80 },
    });
    const children = (curvedText as unknown as InstanceType<typeof MockGroup>).children;
    const before = children[0].data.rotation;

    curvedText.setLayout({ radius: 40 });

    expect((curvedText as unknown as InstanceType<typeof MockGroup>).children[0].data.rotation).not.toBe(
      before,
    );
  });

  it("选区范围按字素数量裁剪并发出变更事件", () => {
    const curvedText = createCurvedText();
    const listener = vi.fn();
    curvedText.on("character-selection-change", listener);

    curvedText.setCharacterSelection({ start: -2, end: 20 });

    expect(curvedText.characterSelection).toEqual({ start: 0, end: 3 });
    expect(listener).toHaveBeenCalledWith({ start: 0, end: 3 });
  });

  it("全选后应用样式只覆盖全部字素", () => {
    const curvedText = createCurvedText({ defaultStyle: { fill: "#111" } });

    curvedText.selectAll().setCharacterStyle({ fill: "#f00", fontSize: 20 });

    expect(curvedText.styleRuns).toEqual([
      { start: 0, end: 3, style: { fill: "#f00", fontSize: 20 } },
    ]);
    expect(
      (curvedText as unknown as InstanceType<typeof MockGroup>).children
        .slice(0, 3)
        .map(({ data }) => data.fontSize),
    ).toEqual([20, 20, 20]);
  });

  it("有选区时样式更新会保留选区外的覆盖", () => {
    const curvedText = createCurvedText({
      defaultStyle: { fill: "#111" },
      styleRuns: [{ start: 0, end: 1, style: { fill: "#0f0" } }],
    });
    curvedText.setCharacterSelection({ start: 1, end: 2 });
    curvedText.applyStyleToSelection({ fill: "#f00" });

    expect(curvedText.styleRuns).toEqual([
      { start: 0, end: 1, style: { fill: "#0f0" } },
      { start: 1, end: 2, style: { fill: "#f00" } },
    ]);
    expect(curvedText.getCharacterStyle(1)).toMatchObject({ fill: "#f00" });
  });

  it("选区样式只保存局部覆盖，默认样式变化仍会作用于其他字段", () => {
    const curvedText = createCurvedText({ defaultStyle: { fill: "#111", fontSize: 12 } });
    curvedText.setCharacterSelection({ start: 0, end: 1 });
    curvedText.setCharacterStyle({ fill: "#f00" });
    curvedText.setStyles({ fill: "#222", fontSize: 24 }, curvedText.styleRuns);

    expect(curvedText.getCharacterStyle(0)).toMatchObject({ fill: "#f00", fontSize: 24 });
  });

  it("文本缩短时裁剪越界样式区间", () => {
    const curvedText = createCurvedText({
      styleRuns: [{ start: 1, end: 8, style: { fill: "#f00" } }],
    });

    curvedText.setText("A");

    expect(curvedText.styleRuns).toEqual([]);
  });

  it("点击与拖动字符会选择连续字素范围", () => {
    const curvedText = createCurvedText();
    const children = (curvedText as unknown as InstanceType<typeof MockGroup>).children;
    const down = children[0].listeners.get("pointer.down");
    const move = children[2].listeners.get("pointer.move");

    down?.({ current: children[0] });
    move?.({ current: children[2] });

    expect(curvedText.characterSelection).toEqual({ start: 0, end: 3 });
  });

  it("拖动选择过程中发出最新选区", () => {
    const curvedText = createCurvedText();
    const listener = vi.fn();
    curvedText.on("character-selection-change", listener);
    const children = (curvedText as unknown as InstanceType<typeof MockGroup>).children;

    children[0].listeners.get("pointer.down")?.({ current: children[0] });
    children[2].listeners.get("pointer.move")?.({ current: children[2] });

    expect(listener).toHaveBeenLastCalledWith({ start: 0, end: 3 });
  });

  it("拖动经过字素之间的空隙仍连续选择最近字素", () => {
    const curvedText = createCurvedText({ layout: { bendAngle: 0, radius: 80 } });
    const group = curvedText as unknown as InstanceType<typeof MockGroup>;
    const glyphs = group.children;
    const down = group.listeners.get("pointer.down");
    const move = group.listeners.get("pointer.move");

    down?.({ x: glyphs[0].data.x, y: glyphs[0].data.y });
    move?.({ x: glyphs[2].data.x, y: glyphs[2].data.y });

    expect(curvedText.characterSelection).toEqual({ start: 0, end: 3 });
  });

  it("清除选区并恢复字符原始颜色", () => {
    const curvedText = createCurvedText({ defaultStyle: { fill: "#f00" } });
    curvedText.setCharacterSelection({ start: 0, end: 1 });
    curvedText.clearCharacterSelection();

    expect(curvedText.characterSelection).toBeUndefined();
    expect((curvedText as unknown as InstanceType<typeof MockGroup>).children[0].data.fill).toBe("#f00");
  });

  it("选区高亮颜色可通过配置和运行时 setter 修改", () => {
    const curvedText = createCurvedText({ selectionFill: "#0a0" });
    curvedText.setCharacterSelection({ start: 0, end: 1 });
    expect((curvedText as unknown as InstanceType<typeof MockGroup>).children[0].data.fill).toBe("#0a0");

    curvedText.selectionFill = "#a00";
    expect((curvedText as unknown as InstanceType<typeof MockGroup>).children[0].data.fill).toBe("#a00");
  });

  it("序列化只返回业务数据，不包含运行时选区和测量器", () => {
    const curvedText = createCurvedText({ id: "curve-1", defaultStyle: { fontSize: 20 } });
    curvedText.setCharacterSelection({ start: 0, end: 1 });

    const data = curvedText.toJSON() as unknown as Record<string, unknown>;

    expect(data).toMatchObject({
      id: "curve-1",
      kind: "curvedText",
      text: "ABC",
      defaultStyle: { fontSize: 20 },
    });
    expect(data).not.toHaveProperty("selection");
    expect(data).not.toHaveProperty("measureGrapheme");
    expect(data).not.toHaveProperty("children");
  });

  it("destroy 可重复调用且释放子对象引用", () => {
    const curvedText = createCurvedText();

    curvedText.destroy();
    curvedText.destroy();

    expect((curvedText as unknown as InstanceType<typeof MockGroup>).destroyed).toBe(true);
    expect((curvedText as unknown as InstanceType<typeof MockGroup>).children).toEqual([]);
  });
});
