import { describe, expect, it, vi } from "vitest";
import { createPointerGesture } from "../src";
import { dispatchPointer } from "./helpers";

const createHarness = (overrides: { enabled?: boolean; minDistance?: number } = {}) => {
  const view = document.createElement("div");
  const callbacks = {
    onEnd: vi.fn(),
    onMove: vi.fn(),
    onStart: vi.fn(),
  };
  let enabled = overrides.enabled ?? true;

  document.body.appendChild(view);

  const gesture = createPointerGesture(
    {
      isEnabled: () => enabled,
      minDistance: overrides.minDistance ?? 2,
      toPoint: (event) => ({ x: event.clientX, y: event.clientY }),
      view,
    },
    callbacks,
  );

  gesture.attach();

  return { callbacks, gesture, setEnabled: (value: boolean) => (enabled = value), view };
};

describe("createPointerGesture", () => {
  it("按下后按 window 级移动采样，抬手结束", () => {
    const { callbacks, view } = createHarness();

    dispatchPointer(view, "pointerdown", { clientX: 10, clientY: 20 });
    dispatchPointer(window, "pointermove", { clientX: 40, clientY: 60 });
    dispatchPointer(window, "pointerup", { clientX: 40, clientY: 60 });

    expect(callbacks.onStart).toHaveBeenCalledWith({ x: 10, y: 20 }, expect.anything());
    expect(callbacks.onMove).toHaveBeenCalledWith({ x: 40, y: 60 }, expect.anything());
    expect(callbacks.onEnd).toHaveBeenCalledTimes(1);
  });

  it("抬手后不再响应移动", () => {
    const { callbacks, view } = createHarness();

    dispatchPointer(view, "pointerdown", { clientX: 10, clientY: 20 });
    dispatchPointer(window, "pointerup", { clientX: 10, clientY: 20 });
    dispatchPointer(window, "pointermove", { clientX: 80, clientY: 80 });

    expect(callbacks.onMove).not.toHaveBeenCalled();
  });

  it("位移小于采样距离时不回调", () => {
    const { callbacks, view } = createHarness({ minDistance: 5 });

    dispatchPointer(view, "pointerdown", { clientX: 10, clientY: 20 });
    dispatchPointer(window, "pointermove", { clientX: 12, clientY: 21 });

    expect(callbacks.onMove).not.toHaveBeenCalled();
  });

  it("pointercancel 也会结束手势", () => {
    const { callbacks, view } = createHarness();

    dispatchPointer(view, "pointerdown", { clientX: 10, clientY: 20 });
    dispatchPointer(window, "pointercancel", { clientX: 10, clientY: 20 });

    expect(callbacks.onEnd).toHaveBeenCalledTimes(1);
  });

  it("其它 pointerId 的事件会被忽略", () => {
    const { callbacks, view } = createHarness();

    dispatchPointer(view, "pointerdown", { clientX: 10, clientY: 20, pointerId: 1 });
    dispatchPointer(window, "pointermove", { clientX: 40, clientY: 60, pointerId: 2 });

    expect(callbacks.onMove).not.toHaveBeenCalled();
  });

  it("禁用时不响应按下", () => {
    const { callbacks, setEnabled, view } = createHarness();

    setEnabled(false);
    dispatchPointer(view, "pointerdown", { clientX: 10, clientY: 20 });

    expect(callbacks.onStart).not.toHaveBeenCalled();
  });

  it("非主键按下不接管手势", () => {
    const { callbacks, view } = createHarness();

    dispatchPointer(view, "pointerdown", { button: 2, clientX: 10, clientY: 20 });

    expect(callbacks.onStart).not.toHaveBeenCalled();
  });

  it("onStart 返回 false 时不接管后续移动", () => {
    const { callbacks, view } = createHarness();

    callbacks.onStart.mockReturnValue(false);
    dispatchPointer(view, "pointerdown", { clientX: 10, clientY: 20 });
    dispatchPointer(window, "pointermove", { clientX: 40, clientY: 60 });

    expect(callbacks.onMove).not.toHaveBeenCalled();
    expect(callbacks.onEnd).not.toHaveBeenCalled();
  });

  it("手势进行中只允许一段手势", () => {
    const { callbacks, view } = createHarness();

    dispatchPointer(view, "pointerdown", { clientX: 10, clientY: 20, pointerId: 1 });
    dispatchPointer(view, "pointerdown", { clientX: 50, clientY: 50, pointerId: 2 });

    expect(callbacks.onStart).toHaveBeenCalledTimes(1);
  });

  it("detach 后不再响应按下", () => {
    const { callbacks, gesture, view } = createHarness();

    gesture.detach();
    dispatchPointer(view, "pointerdown", { clientX: 10, clientY: 20 });

    expect(callbacks.onStart).not.toHaveBeenCalled();
  });
});
