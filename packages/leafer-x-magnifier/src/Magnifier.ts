import type { IApp } from "@leafer-ui/interface";
import { drawMagnifierLens, getMagnifierSample } from "./geometry";
import type { MagnifierConfig } from "./types";

/** 默认镜片直径（CSS 像素）。 */
export const DEFAULT_SIZE = 200;
/** 默认放大倍数。 */
export const DEFAULT_ZOOM = 3;

/** 镜片的默认外观；宿主可以用 config.style 覆盖。 */
const DEFAULT_STYLE: Record<string, string> = {
  position: "absolute",
  top: "0",
  left: "0",
  display: "none",
  // 镜片始终压在指针上，必须让指针事件穿透，否则会和画布的 pointermove / pointerleave 互相触发。
  pointerEvents: "none",
  background: "#ffffff",
  border: "2px solid rgba(31, 41, 55, 0.72)",
  borderRadius: "50%",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.26), 0 2px 6px rgba(15, 23, 42, 0.16)",
  zIndex: "6",
};

/** 插件只需要 App 上的画布视图，用结构化类型避免和宿主的具体 App 泛型耦合。 */
type CanvasLayer = { canvas?: { view?: HTMLCanvasElement } | null };

/**
 * 取业务节点真正绘制的那层画布。
 *
 * 带 editor 的 App 是多层画布，节点内容画在 tree 层；取错层会放大到空白或 Editor 控制框。
 */
const getSourceCanvas = (app: IApp) => {
  const layer = (app.tree ?? app) as unknown as CanvasLayer | undefined;

  return layer?.canvas?.view;
};

/**
 * 放大镜插件：指针悬停在画布上时，用一个镜片局部放大画布。
 *
 * 插件不依赖任何框架，也不持有宿主状态：
 * 构造后自己监听指针、自己维护一个 DOM canvas 镜片，宿主通过
 * `enabled / size / zoom` 三个存取器控制它，状态放在哪里由宿主决定。
 */
export class Magnifier {
  private app: IApp;
  private config: MagnifierConfig;
  private lens: HTMLCanvasElement | undefined;
  private view: HTMLElement | undefined;
  private point: { x: number; y: number } | undefined;
  private sizeValue: number;
  private zoomValue: number;
  private enabledValue: boolean;

  constructor(app: IApp, config: MagnifierConfig = {}) {
    this.app = app;
    this.config = config;
    this.sizeValue = config.size ?? DEFAULT_SIZE;
    this.zoomValue = config.zoom ?? DEFAULT_ZOOM;
    this.enabledValue = config.enabled ?? true;

    this.attach();
  }

  /** 是否启用；禁用时不响应指针并收起镜片。 */
  get enabled() {
    return this.enabledValue;
  }

  set enabled(value: boolean) {
    if (this.enabledValue === value) return;

    this.enabledValue = value;

    if (value) {
      this.render();
      return;
    }

    this.hide();
  }

  /** 镜片直径，CSS 像素。 */
  get size() {
    return this.sizeValue;
  }

  set size(value: number) {
    this.sizeValue = value;
    this.render();
  }

  /** 相对当前屏幕显示的放大倍数。 */
  get zoom() {
    return this.zoomValue;
  }

  set zoom(value: number) {
    this.zoomValue = value;
    this.render();
  }

  /** 批量更新配置，只处理传入的字段。 */
  set(config: MagnifierConfig) {
    const previousView = this.view;

    this.config = { ...this.config, ...config };

    if (config.size !== undefined) this.sizeValue = config.size;
    if (config.zoom !== undefined) this.zoomValue = config.zoom;
    if (config.enabled !== undefined) this.enabledValue = config.enabled;
    if (config.className !== undefined && this.lens) this.lens.className = config.className;
    if (config.style && this.lens) Object.assign(this.lens.style, config.style);

    // 换了指针监听元素要先把旧监听摘掉，render 会重新绑定到新元素上。
    if (config.view !== undefined && config.view !== previousView) this.detach();

    if (this.enabledValue) this.render();
    else this.hide();
  }

  /** 按当前指针位置重绘镜片；宿主改了 size / zoom 后也可以手动调用。 */
  render() {
    const point = this.point;

    if (!this.enabledValue || !point) {
      this.hide();
      return;
    }

    const source = getSourceCanvas(this.app);
    const container = this.mount();
    const lens = this.lens;

    if (!source || !container || !lens) return;

    const sourceRect = source.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const pixelRatio = globalThis.devicePixelRatio || 1;
    const size = this.sizeValue;
    const sample = getMagnifierSample(
      { x: point.x - sourceRect.left, y: point.y - sourceRect.top },
      size,
      this.zoomValue,
      pixelRatio,
    );

    drawMagnifierLens(lens, source, size, sample, pixelRatio);
    lens.style.display = "block";
    lens.style.width = `${size}px`;
    lens.style.height = `${size}px`;
    // 镜片中心始终压在指针上，取样点才和放大后的中心一致。
    lens.style.left = `${point.x - containerRect.left - size / 2}px`;
    lens.style.top = `${point.y - containerRect.top - size / 2}px`;
  }

  /** 收起镜片。 */
  hide() {
    if (this.lens) this.lens.style.display = "none";
  }

  /** 解绑监听并移除镜片，之后这个实例不再可用。 */
  dispose() {
    this.detach();
    this.lens?.remove();
    this.lens = undefined;
    this.point = undefined;
  }

  /** 默认的指针监听元素和镜片定位容器：Leafer 画布的父容器。 */
  private getDefaultHost() {
    return getSourceCanvas(this.app)?.parentElement ?? undefined;
  }

  /** 指针监听元素。 */
  private getView() {
    return this.config.view ?? this.getDefaultHost();
  }

  /** 镜片的定位容器。 */
  private getContainer() {
    return this.config.container ?? this.getDefaultHost();
  }

  /**
   * 把镜片挂到定位容器里，返回容器。
   *
   * 镜片创建时机推迟到第一次挂载，构造插件本身不碰 DOM，方便在没有 document 的阶段先建实例。
   */
  private mount() {
    const container = this.getContainer();

    if (!container) return undefined;

    if (!this.lens) {
      const ownerDocument = getSourceCanvas(this.app)?.ownerDocument ?? globalThis.document;

      if (!ownerDocument) return undefined;

      const lens = ownerDocument.createElement("canvas");

      if (this.config.className) lens.className = this.config.className;

      Object.assign(lens.style, DEFAULT_STYLE, this.config.style ?? {});
      this.lens = lens;
    }

    const lens = this.lens;

    if (!lens) return undefined;

    if (lens.parentElement !== container) {
      // 容器是 static 定位时绝对定位没有参照，这里补一个 relative。
      const { position } = getComputedStyle(container);

      if (position === "static") container.style.position = "relative";

      container.appendChild(lens);
    }

    return container;
  }

  private attach() {
    const view = this.view ?? this.getView();

    if (!view) return;

    this.view = view;
    // 用捕获阶段监听：Leafer 自己也会在画布上处理 pointer 事件，避免被它提前 stopPropagation。
    view.addEventListener("pointermove", this.handlePointerMove, true);
    view.addEventListener("pointerleave", this.handlePointerLeave);
  }

  private detach() {
    const view = this.view;

    if (!view) return;

    view.removeEventListener("pointermove", this.handlePointerMove, true);
    view.removeEventListener("pointerleave", this.handlePointerLeave);
    this.view = undefined;
  }

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.enabledValue) return;

    this.point = { x: event.clientX, y: event.clientY };
    this.render();
  };

  private handlePointerLeave = () => {
    this.hide();
  };
}
