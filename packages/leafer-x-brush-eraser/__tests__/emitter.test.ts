import { describe, expect, it, vi } from "vitest";
import { Emitter } from "../src";

type Events = {
  ping: { value: number };
  pong: { value: number };
};

class TestEmitter extends Emitter<Events> {
  send(type: keyof Events, value: number) {
    this.emit(type, { value });
  }

  reset() {
    this.clearListeners();
  }
}

describe("Emitter", () => {
  it("on 订阅后能收到对应事件", () => {
    const emitter = new TestEmitter();
    const listener = vi.fn();

    emitter.on("ping", listener);
    emitter.send("ping", 1);

    expect(listener).toHaveBeenCalledWith({ value: 1 });
  });

  it("只收到自己订阅的事件类型", () => {
    const emitter = new TestEmitter();
    const listener = vi.fn();

    emitter.on("ping", listener);
    emitter.send("pong", 2);

    expect(listener).not.toHaveBeenCalled();
  });

  it("支持多个监听者", () => {
    const emitter = new TestEmitter();
    const first = vi.fn();
    const second = vi.fn();

    emitter.on("ping", first);
    emitter.on("ping", second);
    emitter.send("ping", 3);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("off 之后不再收到事件", () => {
    const emitter = new TestEmitter();
    const listener = vi.fn();

    emitter.on("ping", listener);
    emitter.off("ping", listener);
    emitter.send("ping", 4);

    expect(listener).not.toHaveBeenCalled();
  });

  it("清空监听后不再回调", () => {
    const emitter = new TestEmitter();
    const listener = vi.fn();

    emitter.on("ping", listener);
    emitter.reset();
    emitter.send("ping", 5);

    expect(listener).not.toHaveBeenCalled();
  });

  it("on 返回自身，方便链式调用", () => {
    const emitter = new TestEmitter();

    expect(emitter.on("ping", vi.fn())).toBe(emitter);
  });
});
