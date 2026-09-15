import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditableLeaferApp } from "@/types";
import { BOARD_INSET } from "../../geometry/boardLayout";
import { useRuler } from "../useRuler";

const mockRuler = vi.hoisted(() => ({
  dispose: vi.fn(),
  enabledSets: [] as boolean[],
  instances: [] as Array<{
    app: unknown;
    config: Record<string, unknown>;
    rulerLeafer: { canvas: { hittable: boolean } };
  }>,
}));

vi.mock("leafer-x-ruler", () => ({
  Ruler: class {
    dispose = mockRuler.dispose;
    private enabledValue = true;
    rulerLeafer = { canvas: { hittable: true } };

    constructor(app: unknown, config: Record<string, unknown>) {
      mockRuler.instances.push({ app, config, rulerLeafer: this.rulerLeafer });
    }

    get enabled() {
      return this.enabledValue;
    }

    set enabled(value: boolean) {
      mockRuler.enabledSets.push(value);
      this.enabledValue = value;
    }
  },
}));

/** app 是 Leafer 边界，这里只关心 hook 传了什么。 */
const app = { isApp: true } as unknown as EditableLeaferApp;

const renderRuler = (current: EditableLeaferApp | null = app) =>
  renderHook(() => useRuler({ appRef: { current } }));

beforeEach(() => {
  mockRuler.dispose.mockClear();
  mockRuler.enabledSets.length = 0;
  mockRuler.instances.length = 0;
});

describe("useRuler", () => {
  it("刻度条宽度用 BOARD_INSET，和白板让位的空间保持一致", () => {
    renderRuler();

    expect(mockRuler.instances).toHaveLength(1);
    expect(mockRuler.instances[0]).toEqual({
      app,
      config: { ruleSize: BOARD_INSET, theme: "light", unit: "px" },
      rulerLeafer: { canvas: { hittable: false } },
    });
  });

  it("关闭标尺层的指针命中，避免盖住 Leafer Editor 的点击和拖拽", () => {
    renderRuler();

    expect(mockRuler.instances[0].rulerLeafer.canvas.hittable).toBe(false);
  });

  it("App 还没创建时不构造标尺", () => {
    renderRuler(null);

    expect(mockRuler.instances).toHaveLength(0);
  });

  it("卸载时禁用并销毁标尺", () => {
    const { unmount } = renderRuler();

    unmount();

    expect(mockRuler.enabledSets).toEqual([false]);
    expect(mockRuler.dispose).toHaveBeenCalled();
  });
});
