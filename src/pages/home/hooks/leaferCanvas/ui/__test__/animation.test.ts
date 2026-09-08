import { describe, expect, it } from "vitest";
import type { CanvasAnimationItem } from "@/types";
import { getAnimationSignature, getLeaferAnimation } from "../animation";

const item = (overrides: Partial<CanvasAnimationItem> = {}): CanvasAnimationItem => ({
  animation: { style: { opacity: 1 } },
  delay: 100,
  duration: 200,
  id: "a",
  loop: 0,
  name: "a",
  preset: "fadeIn",
  ...overrides,
});

const keyframeStyle = (overrides: { delay?: number; duration?: number } = {}) =>
  item({
    animation: {
      keyframes: [{ style: { x: 1 }, ...overrides }],
    },
  });

describe("getLeaferAnimation", () => {
  it("undefined 返回 undefined", () => {
    expect(getLeaferAnimation(undefined)).toBeUndefined();
  });

  it("空数组返回 undefined", () => {
    expect(getLeaferAnimation([])).toBeUndefined();
  });

  it("单条动画返回对象而不是数组", () => {
    expect(Array.isArray(getLeaferAnimation([item()]))).toBe(false);
  });

  it("两条动画返回数组", () => {
    expect(Array.isArray(getLeaferAnimation([item({ id: "a" }), item({ id: "b" })]))).toBe(true);
  });

  it("delay 毫秒换成秒", () => {
    expect(getLeaferAnimation([item({ delay: 100 })])).toMatchObject({ delay: 0.1 });
  });

  it("delay 为 0 时换成 0 秒", () => {
    expect(getLeaferAnimation([item({ delay: 0 })])).toMatchObject({ delay: 0 });
  });

  it("delay 为负数时仍按毫秒除以 1000", () => {
    expect(getLeaferAnimation([item({ delay: -100 })])).toMatchObject({ delay: -0.1 });
  });

  it("duration 毫秒换成秒", () => {
    expect(getLeaferAnimation([item({ duration: 200 })])).toMatchObject({ duration: 0.2 });
  });

  it("duration 为 0 时换成 0 秒", () => {
    expect(getLeaferAnimation([item({ duration: 0 })])).toMatchObject({ duration: 0 });
  });

  it("duration 为负数时仍按毫秒除以 1000", () => {
    expect(getLeaferAnimation([item({ duration: -200 })])).toMatchObject({ duration: -0.2 });
  });

  it("loop 为 0 时 Leafer loop 为 false", () => {
    expect(getLeaferAnimation([item({ loop: 0 })])).toMatchObject({ loop: false });
  });

  it("loop 为 -1 时 Leafer loop 为 true", () => {
    expect(getLeaferAnimation([item({ loop: -1 })])).toMatchObject({ loop: true });
  });

  it("loop 小于 -1 时 Leafer loop 仍为 true", () => {
    expect(getLeaferAnimation([item({ loop: -2 })])).toMatchObject({ loop: true });
  });

  it("loop 为 1 时透传 1", () => {
    expect(getLeaferAnimation([item({ loop: 1 })])).toMatchObject({ loop: 1 });
  });

  it("loop 大于 1 时透传次数", () => {
    expect(getLeaferAnimation([item({ loop: 3 })])).toMatchObject({ loop: 3 });
  });

  it("preset 为 rotate 时 join 为 true", () => {
    expect(getLeaferAnimation([item({ preset: "rotate" })])).toMatchObject({ join: true });
  });

  it("preset 为 fadeIn 时 join 为 false", () => {
    expect(getLeaferAnimation([item({ preset: "fadeIn" })])).toMatchObject({ join: false });
  });

  it("preset 为 fadeOut 时 join 为 false", () => {
    expect(getLeaferAnimation([item({ preset: "fadeOut" })])).toMatchObject({ join: false });
  });

  it("preset 为 slideRight 时 join 为 false", () => {
    expect(getLeaferAnimation([item({ preset: "slideRight" })])).toMatchObject({ join: false });
  });

  it("没有 style 也没有 keyframes 时 style 为空对象", () => {
    expect(getLeaferAnimation([item({ animation: {} })])).toMatchObject({ style: {} });
  });

  it("style 为空对象时原样带上", () => {
    expect(getLeaferAnimation([item({ animation: { style: {} } })])).toMatchObject({ style: {} });
  });

  it("keyframes 为空数组时走 style 分支", () => {
    expect(
      getLeaferAnimation([item({ animation: { keyframes: [], style: { opacity: 0.5 } } })]),
    ).toMatchObject({ style: { opacity: 0.5 } });
  });

  it("走 style 分支时结果不带 keyframes", () => {
    expect(getLeaferAnimation([item({ animation: { style: { opacity: 1 } } })])).not.toHaveProperty(
      "keyframes",
    );
  });

  it("有 keyframes 时结果不带 style", () => {
    expect(
      getLeaferAnimation([
        item({
          animation: {
            keyframes: [{ style: { x: 1 }, duration: 1000 }],
            style: { opacity: 1 },
          },
        }),
      ]),
    ).not.toHaveProperty("style");
  });

  it("内层 animation.delay 不参与换算，只用条目 delay", () => {
    expect(
      getLeaferAnimation([
        item({
          animation: { delay: 9999, style: { opacity: 1 } },
          delay: 100,
        }),
      ]),
    ).toMatchObject({ delay: 0.1 });
  });

  it("内层 animation.duration 不参与换算，只用条目 duration", () => {
    expect(
      getLeaferAnimation([
        item({
          animation: { duration: 9999, style: { opacity: 1 } },
          duration: 200,
        }),
      ]),
    ).toMatchObject({ duration: 0.2 });
  });

  it("内层 animation.loop 不参与换算，只用条目 loop", () => {
    expect(
      getLeaferAnimation([
        item({
          animation: { loop: 9, style: { opacity: 1 } },
          loop: 0,
        }),
      ]),
    ).toMatchObject({ loop: false });
  });

  it("两条动画第二条 delay 累加第一条的 delay 和 duration", () => {
    expect(
      getLeaferAnimation([item({ delay: 100, duration: 100 }), item({ delay: 0, duration: 50 })]),
    ).toEqual([
      expect.objectContaining({ delay: 0.1, duration: 0.1 }),
      expect.objectContaining({ delay: 0.2, duration: 0.05 }),
    ]);
  });

  it("第三条动画 delay 累加前两条的 delay 和 duration", () => {
    expect(
      getLeaferAnimation([
        item({ delay: 100, duration: 100 }),
        item({ delay: 50, duration: 50 }),
        item({ delay: 0, duration: 10 }),
      ]),
    ).toEqual([
      expect.objectContaining({ delay: 0.1 }),
      expect.objectContaining({ delay: 0.25 }),
      expect.objectContaining({ delay: 0.3 }),
    ]);
  });

  it("带 style 的关键帧会把毫秒换成秒", () => {
    expect(getLeaferAnimation([keyframeStyle({ delay: 500, duration: 1000 })])).toMatchObject({
      keyframes: [{ delay: 0.5, duration: 1, style: { x: 1 } }],
    });
  });

  it("带 style 的关键帧 delay 为 0 时写成 0 秒", () => {
    expect(getLeaferAnimation([keyframeStyle({ delay: 0, duration: 1000 })])).toMatchObject({
      keyframes: [{ delay: 0, duration: 1, style: { x: 1 } }],
    });
  });

  it("带 style 的关键帧 duration 为 0 时写成 0 秒", () => {
    expect(getLeaferAnimation([keyframeStyle({ delay: 500, duration: 0 })])).toMatchObject({
      keyframes: [{ delay: 0.5, duration: 0, style: { x: 1 } }],
    });
  });

  it("带 style 的关键帧 delay 缺省时不写 delay", () => {
    expect(getLeaferAnimation([keyframeStyle({ duration: 1000 })])).toMatchObject({
      keyframes: [{ delay: undefined, duration: 1, style: { x: 1 } }],
    });
  });

  it("带 style 的关键帧 duration 缺省时不写 duration", () => {
    expect(getLeaferAnimation([keyframeStyle({ delay: 500 })])).toMatchObject({
      keyframes: [{ delay: 0.5, duration: undefined, style: { x: 1 } }],
    });
  });

  it("带 style 的关键帧 delay 为 null 时不写 delay", () => {
    expect(
      getLeaferAnimation([
        item({
          animation: {
            keyframes: [{ delay: null as unknown as undefined, duration: 1000, style: { x: 1 } }],
          },
        }),
      ]),
    ).toMatchObject({
      keyframes: [{ delay: undefined, duration: 1, style: { x: 1 } }],
    });
  });

  it("带 style 的关键帧 duration 为 null 时不写 duration", () => {
    expect(
      getLeaferAnimation([
        item({
          animation: {
            keyframes: [{ delay: 500, duration: null as unknown as undefined, style: { x: 1 } }],
          },
        }),
      ]),
    ).toMatchObject({
      keyframes: [{ delay: 0.5, duration: undefined, style: { x: 1 } }],
    });
  });

  it("纯样式关键帧不转换 duration", () => {
    expect(
      getLeaferAnimation([item({ animation: { keyframes: [{ duration: 1000, x: 1 }] } })]),
    ).toMatchObject({
      keyframes: [{ duration: 1000, x: 1 }],
    });
  });

  it("纯样式关键帧不转换 delay", () => {
    expect(
      getLeaferAnimation([item({ animation: { keyframes: [{ delay: 500, x: 1 }] } })]),
    ).toMatchObject({
      keyframes: [{ delay: 500, x: 1 }],
    });
  });

  it("多条带 style 的关键帧都会换算", () => {
    expect(
      getLeaferAnimation([
        item({
          animation: {
            keyframes: [
              { duration: 1000, style: { x: 0 } },
              { duration: 500, style: { x: 2 } },
            ],
          },
        }),
      ]),
    ).toMatchObject({
      keyframes: [
        { duration: 1, style: { x: 0 } },
        { duration: 0.5, style: { x: 2 } },
      ],
    });
  });

  it("同一列表里纯样式关键帧和带 style 的关键帧分别处理", () => {
    expect(
      getLeaferAnimation([
        item({
          animation: {
            keyframes: [
              { duration: 1000, x: 1 },
              { duration: 1000, style: { x: 2 } },
            ],
          },
        }),
      ]),
    ).toMatchObject({
      keyframes: [
        { duration: 1000, x: 1 },
        { duration: 1, style: { x: 2 } },
      ],
    });
  });

  it("style 为 undefined 的关键帧原样返回", () => {
    expect(
      getLeaferAnimation([
        item({
          animation: {
            keyframes: [{ duration: 1000, style: undefined }],
          },
        }),
      ]),
    ).toMatchObject({
      keyframes: [{ duration: 1000, style: undefined }],
    });
  });
});

describe("getAnimationSignature", () => {
  it("undefined 序列化成空数组", () => {
    expect(getAnimationSignature(undefined)).toBe("[]");
  });

  it("空数组序列化成空数组", () => {
    expect(getAnimationSignature([])).toBe("[]");
  });

  it("undefined 和空数组签名相同", () => {
    expect(getAnimationSignature(undefined)).toBe(getAnimationSignature([]));
  });

  it("相同列表签名一致", () => {
    const list = [item()];
    expect(getAnimationSignature(list)).toBe(getAnimationSignature(list));
  });

  it("duration 不同时签名不同", () => {
    expect(getAnimationSignature([item({ duration: 100 })])).not.toBe(
      getAnimationSignature([item({ duration: 200 })]),
    );
  });

  it("delay 不同时签名不同", () => {
    expect(getAnimationSignature([item({ delay: 0 })])).not.toBe(
      getAnimationSignature([item({ delay: 100 })]),
    );
  });

  it("loop 不同时签名不同", () => {
    expect(getAnimationSignature([item({ loop: 0 })])).not.toBe(
      getAnimationSignature([item({ loop: 1 })]),
    );
  });

  it("preset 不同时签名不同", () => {
    expect(getAnimationSignature([item({ preset: "fadeIn" })])).not.toBe(
      getAnimationSignature([item({ preset: "rotate" })]),
    );
  });

  it("style 不同时签名不同", () => {
    expect(getAnimationSignature([item({ animation: { style: { opacity: 1 } } })])).not.toBe(
      getAnimationSignature([item({ animation: { style: { opacity: 0 } } })]),
    );
  });

  it("有无 keyframes 时签名不同", () => {
    expect(getAnimationSignature([item({ animation: { style: { x: 1 } } })])).not.toBe(
      getAnimationSignature([item({ animation: { keyframes: [{ style: { x: 1 } }] } })]),
    );
  });

  it("顺序不同时签名不同", () => {
    const first = item({ duration: 100, id: "a" });
    const second = item({ duration: 200, id: "b" });
    expect(getAnimationSignature([first, second])).not.toBe(getAnimationSignature([second, first]));
  });

  it("name 为空字符串时签名与非空不同", () => {
    expect(getAnimationSignature([item({ name: "" })])).not.toBe(
      getAnimationSignature([item({ name: "a" })]),
    );
  });

  it("id 为空字符串时签名与非空不同", () => {
    expect(getAnimationSignature([item({ id: "" })])).not.toBe(getAnimationSignature([item({ id: "a" })]));
  });

  it("一条和两条列表签名不同", () => {
    expect(getAnimationSignature([item()])).not.toBe(
      getAnimationSignature([item(), item({ id: "b" })]),
    );
  });
});
