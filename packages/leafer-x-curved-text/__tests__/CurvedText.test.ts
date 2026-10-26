import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurvedText } from "../src";

const { MockGroup, MockText } = vi.hoisted(() => {
  class MockGroup {
    children: MockText[] = [];
    data: Record<string, unknown>;
    destroyed = false;

    constructor(data: Record<string, unknown>) {
      this.data = { ...data };
    }

    add(child: MockText) {
      this.children.push(child);
    }

    removeAll() {
      this.children = [];
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

    set(data: Record<string, unknown>) {
      Object.assign(this.data, data);
    }

    on(type: string, listener: (event: unknown) => void) {
      this.listeners.set(type, listener);
    }
  }

  return { MockGroup, MockText };
});

vi.mock("@leafer-ui/core", () => ({ Group: MockGroup, Text: MockText }));

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

    expect((curvedText as unknown as MockGroup).children).toHaveLength(3);
    expect(curvedText.text).toBe("ABC");
  });

  it("默认样式与区间样式分别应用到对应字素", () => {
    const curvedText = createCurvedText({
      defaultStyle: { fontFamily: "Sans", fontSize: 12, fill: "#111" },
      styleRuns: [{ start: 1, end: 2, style: { fontSize: 24, fill: "#f00", stroke: "#000" } }],
    });
    const children = (curvedText as unknown as MockGroup).children;

    expect(children.map(({ data }) => data.fontSize)).toEqual([12, 24, 12]);
    expect(children[1].data).toMatchObject({ fill: "#f00", stroke: "#000", strokeWidth: undefined });
  });

  it("更新文本后重建字符对象并裁剪过期选区", () => {
    const curvedText = createCurvedText();
    curvedText.setCharacterSelection({ start: 1, end: 3 });

    curvedText.setText("A");

    expect((curvedText as unknown as MockGroup).children).toHaveLength(1);
    expect(curvedText.characterSelection).toBeUndefined();
  });

  it("setLayout 会重新计算字素位置", () => {
    const curvedText = createCurvedText();
    const before = (curvedText as unknown as MockGroup).children[0].data.x;

    curvedText.setLayout({ direction: "counterclockwise" });

    const after = (curvedText as unknown as MockGroup).children[0].data.x;
    expect(after).not.toBe(before);
  });

  it("选区范围按字素数量裁剪并发出变更事件", () => {
    const curvedText = createCurvedText();
    const listener = vi.fn();
    curvedText.on("character-selection-change", listener);

    curvedText.setCharacterSelection({ start: -2, end: 20 });

    expect(curvedText.characterSelection).toEqual({ start: 0, end: 3 });
    expect(listener).toHaveBeenCalledWith({ start: 0, end: 3 });
  });

  it("点击与拖动字符会选择连续字素范围", () => {
    const curvedText = createCurvedText();
    const children = (curvedText as unknown as MockGroup).children;
    const down = children[0].listeners.get("pointer.down");
    const move = children[2].listeners.get("pointer.move");

    down?.({ current: children[0] });
    move?.({ current: children[2] });

    expect(curvedText.characterSelection).toEqual({ start: 0, end: 3 });
  });

  it("清除选区并恢复字符原始颜色", () => {
    const curvedText = createCurvedText({ defaultStyle: { fill: "#f00" } });
    curvedText.setCharacterSelection({ start: 0, end: 1 });
    curvedText.clearCharacterSelection();

    expect(curvedText.characterSelection).toBeUndefined();
    expect((curvedText as unknown as MockGroup).children[0].data.fill).toBe("#f00");
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
  });

  it("destroy 可重复调用且释放子对象引用", () => {
    const curvedText = createCurvedText();

    curvedText.destroy();
    curvedText.destroy();

    expect((curvedText as unknown as MockGroup).destroyed).toBe(true);
    expect((curvedText as unknown as MockGroup).children).toEqual([]);
  });
});
