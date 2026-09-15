import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IApp } from "@leafer-ui/interface";
import { DEFAULT_SIZE, DEFAULT_ZOOM, Magnifier } from "../src";

const createContext = () => ({
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: "",
});

/** jsdom 拿不到真实 2d 上下文，这里给整块 canvas 打一个假上下文，插件就会照常绘制。 */
let context = createContext();
const originalGetContext = HTMLCanvasElement.prototype.getContext;

const toRect = (left: number, top: number, width: number, height: number) =>
  ({
    bottom: top + height,
    height,
    left,
    right: left + width,
    toJSON: () => ({}),
    top,
    width,
    x: left,
    y: top,
  }) as DOMRect;

type Env = {
  app: IApp;
  canvas: HTMLCanvasElement;
  host: HTMLDivElement;
};

/** 造一个「Leafer 画布挂在宿主容器里」的最小环境。 */
const createEnv = (hostRect = toRect(0, 0, 960, 540)): Env => {
  const host = document.createElement("div");

  host.getBoundingClientRect = () => hostRect;
  document.body.appendChild(host);

  const canvas = document.createElement("canvas");

  canvas.getBoundingClientRect = () => toRect(0, 0, 960, 540);
  host.appendChild(canvas);

  return { app: { tree: { canvas: { view: canvas } } } as unknown as IApp, canvas, host };
};

/** 镜片是插件自己插进来的那个 canvas，靠 pointer-events: none 认出来。 */
const getLens = (host: HTMLElement) =>
  [...host.querySelectorAll("canvas")].find((item) => item.style.pointerEvents === "none");

const dispatchMove = (view: HTMLElement, clientX: number, clientY: number) => {
  const event = new Event("pointermove", { bubbles: true });

  Object.assign(event, { clientX, clientY });
  view.dispatchEvent(event);
};

const dispatchLeave = (view: HTMLElement) => {
  view.dispatchEvent(new Event("pointerleave"));
};

beforeEach(() => {
  context = createContext();
  HTMLCanvasElement.prototype.getContext = (() => context) as unknown as typeof originalGetContext;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  document.body.innerHTML = "";
});

describe("Magnifier", () => {
  it("构造时不碰 DOM，第一次指针移动才挂上镜片", () => {
    const { app, host } = createEnv();
    const magnifier = new Magnifier(app);

    expect(getLens(host)).toBeUndefined();

    dispatchMove(host, 200, 150);

    const lens = getLens(host);

    expect(lens).toBeDefined();
    expect(lens?.style.display).toBe("block");
    expect(lens?.style.width).toBe(`${DEFAULT_SIZE}px`);
    expect(lens?.style.height).toBe(`${DEFAULT_SIZE}px`);

    magnifier.dispose();
  });

  it("按倍率取画布局部区域放大，镜片中心压在指针上", () => {
    const { app, canvas, host } = createEnv();
    const magnifier = new Magnifier(app, { size: 200, zoom: 2 });

    dispatchMove(host, 200, 150);

    // 200 / 2 = 100 设备像素取样，中心落在指针上。
    expect(context.drawImage).toHaveBeenCalledWith(canvas, 150, 100, 100, 100, 0, 0, 200, 200);

    const lens = getLens(host);

    expect(lens?.style.left).toBe("100px");
    expect(lens?.style.top).toBe("50px");

    magnifier.dispose();
  });

  it("镜片位置按定位容器的偏移换算", () => {
    const { app, host } = createEnv(toRect(40, 30, 960, 540));
    const magnifier = new Magnifier(app, { size: 200, zoom: 2 });

    dispatchMove(host, 240, 180);

    const lens = getLens(host);

    // 取样点相对源画布 240/180，镜片相对容器 240-40-100 / 180-30-100。
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      190,
      130,
      100,
      100,
      0,
      0,
      200,
      200,
    );
    expect(lens?.style.left).toBe("100px");
    expect(lens?.style.top).toBe("50px");

    magnifier.dispose();
  });

  it("修改 size / zoom 后立刻用上一次指针位置重绘", () => {
    const { app, host } = createEnv();
    const magnifier = new Magnifier(app, { size: 200, zoom: 2 });

    dispatchMove(host, 200, 150);
    context.drawImage.mockClear();

    magnifier.size = 240;

    // 240 / 2 = 120 设备像素取样。
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      140,
      90,
      120,
      120,
      0,
      0,
      240,
      240,
    );
    expect(getLens(host)?.style.width).toBe("240px");

    magnifier.dispose();
  });

  it("禁用时不绘制也不显示镜片", () => {
    const { app, host } = createEnv();
    const magnifier = new Magnifier(app, { enabled: false });

    dispatchMove(host, 200, 150);

    expect(context.drawImage).not.toHaveBeenCalled();
    expect(getLens(host)).toBeUndefined();

    magnifier.enabled = true;
    dispatchMove(host, 200, 150);
    expect(getLens(host)?.style.display).toBe("block");

    magnifier.enabled = false;
    expect(getLens(host)?.style.display).toBe("none");

    magnifier.dispose();
  });

  it("指针离开画布时收起镜片", () => {
    const { app, host } = createEnv();
    const magnifier = new Magnifier(app);

    dispatchMove(host, 200, 150);
    dispatchLeave(host);

    expect(getLens(host)?.style.display).toBe("none");

    magnifier.dispose();
  });

  it("自定义 container 优先，static 容器会被补上相对定位", () => {
    const { app, host } = createEnv();
    const container = document.createElement("div");

    document.body.appendChild(container);

    const magnifier = new Magnifier(app, { container });

    // 指针事件仍然走默认的 view（画布父容器），镜片挂到指定 container 里。
    dispatchMove(host, 200, 150);

    expect(container.style.position).toBe("relative");
    expect(getLens(container)).toBeDefined();
    expect(getLens(host)).toBeUndefined();

    magnifier.dispose();
  });

  it("set() 批量更新后再渲染", () => {
    const { app, host } = createEnv();
    const magnifier = new Magnifier(app, { size: 200, zoom: 2 });

    dispatchMove(host, 200, 150);
    context.drawImage.mockClear();

    magnifier.set({ size: 100, zoom: 4 });

    // 100 / 4 = 25 设备像素取样。
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      187.5,
      137.5,
      25,
      25,
      0,
      0,
      100,
      100,
    );

    magnifier.dispose();
  });

  it("dispose 会移除镜片并解绑指针监听", () => {
    const { app, host } = createEnv();
    const magnifier = new Magnifier(app);

    dispatchMove(host, 200, 150);
    magnifier.dispose();

    expect(getLens(host)).toBeUndefined();

    context.drawImage.mockClear();
    dispatchMove(host, 300, 200);

    expect(context.drawImage).not.toHaveBeenCalled();
  });

  it("App 上没有 tree 画布时不抛错也不创建镜片", () => {
    const host = document.createElement("div");

    document.body.appendChild(host);

    const magnifier = new Magnifier({} as IApp);

    expect(() => dispatchMove(host, 200, 150)).not.toThrow();
    expect(getLens(host)).toBeUndefined();

    magnifier.dispose();
  });

  it("默认直径和倍数可以直接引用常量", () => {
    expect(DEFAULT_SIZE).toBe(200);
    expect(DEFAULT_ZOOM).toBe(3);
  });
});
