import { Creator, Line } from "@leafer-ui/core";
import type { IPointData, ISelector, IUI } from "@leafer-ui/interface";
import { Emitter } from "./emitter";
import { padSinglePoint } from "./geometry";
import { createPointerGesture, type PointerGesture } from "./gesture";
import type { DrawContainer, EraserConfig, EraserEraseEvent } from "./types";
import { getContainerView, toContainerPoint } from "./view";

/** 擦除预览的 className。 */
export const ERASER_PREVIEW_CLASS = "brush-eraser-preview";

/** 默认擦除宽度（容器局部坐标）。 */
export const DEFAULT_ERASER_WIDTH = 24;
/** 默认采样节流距离。 */
export const DEFAULT_ERASER_MIN_DISTANCE = 2;

type EraserEvents = {
  /** 一次手势里每个被擦到的元素各抛一次，宿主可以做增量处理。 */
  erase: EraserEraseEvent;
  /** 一次手势结束（在所有 erase 之后触发一次），宿主可以在这里把一次手势批量提交。 */
  end: { strokes: EraserEraseEvent[] };
};

/** 一次手势里针对同一个目标累积的擦除轨迹。 */
type EraseStroke = {
  /** 预览挂载的容器（目标父级），也是 points 的坐标空间。 */
  container: DrawContainer;
  /** 目标包围盒相对容器左上角的偏移，宿主拿它换算到自己的节点局部坐标。 */
  offset: { x: number; y: number };
  points: number[];
  preview?: Line;
  target: IUI;
};

/**
 * 橡皮擦插件。
 *
 * 命中用 Leafer 自己的选择器（选择器在世界坐标里计算），擦除预览是一条
 * `eraser: "pixel"` 的临时 Line，插在被擦元素的父容器里，松手时销毁；
 * 最终轨迹通过 `erase` 事件交回宿主。插件不持有文档状态，也不 import 任何框架。
 *
 * 选择器带 `through: true` 取 `throughPath`，叠在一起的笔迹能一次性擦穿多层；
 * 同一点下的每一层各记一条轨迹，松手时各自抛出一次 `erase`，宿主一次手势批量提交。
 */
export class Eraser extends Emitter<EraserEvents> {
  private config: EraserConfig;
  private gesture: PointerGesture | undefined;
  private strokes = new Map<IUI, EraseStroke>();
  private fallbackSelector: ISelector | undefined;
  private enabledValue: boolean;

  constructor(config: EraserConfig) {
    super();

    this.config = config;
    this.enabledValue = config.enabled ?? true;

    const view = config.view ?? getContainerView(config.container);

    if (view) {
      this.gesture = createPointerGesture(
        {
          isEnabled: () => this.enabledValue,
          minDistance: config.minDistance ?? DEFAULT_ERASER_MIN_DISTANCE,
          toPoint: (event) => toContainerPoint(config.container, event),
          view,
        },
        {
          onEnd: () => this.finish(),
          onMove: (point) => this.eraseAt(point),
          // 按在空白处也允许开始手势，之后拖过元素同样能擦到。
          onStart: (point) => {
            this.eraseAt(point);
          },
        },
      );

      if (this.enabledValue) this.gesture.attach();
    }
  }

  /** 是否启用；禁用时会丢弃预览且不提交。 */
  get enabled() {
    return this.enabledValue;
  }

  set enabled(value: boolean) {
    if (this.enabledValue === value) return;

    this.enabledValue = value;

    if (value) {
      this.gesture?.attach();
      return;
    }

    this.cancel();
    this.gesture?.detach();
  }

  /** 更新配置；坐标空间相关的 container / view 只能在构造时给。 */
  set(config: Partial<Omit<EraserConfig, "container" | "view">>) {
    this.config = { ...this.config, ...config };
  }

  /** 解绑指针事件、丢弃预览并释放自带的选择器。 */
  dispose() {
    this.cancel();
    this.gesture?.detach();
    this.fallbackSelector?.destroy();
    this.fallbackSelector = undefined;
    this.clearListeners();
  }

  /** 中断当前手势：丢掉全部预览，不抛事件。 */
  cancel() {
    this.strokes.forEach((stroke) => {
      stroke.preview?.destroy();
    });
    this.strokes.clear();
  }

  private getStrokeWidth() {
    return this.config.strokeWidth ?? DEFAULT_ERASER_WIDTH;
  }

  /**
   * 命中检测：返回指针位置下**所有**可擦笔迹（按 group 去重）。
   *
   * 选择器按世界坐标计算，命中半径取擦除半宽，这样细线也能被容易地擦到。
   * 带 `through: true` 时选择器返回 `throughPath`（命中的全部图层），叠在一起的笔迹
   * 就能一次性擦穿多层；老选择器或单命中场景只给 `target`，这里回退成单层处理。
   */
  private getHits(point: IPointData): { group: IUI; leaf: IUI }[] {
    const selector = this.getSelector();

    if (!selector) return [];

    const world = this.config.container.getWorldPoint(point);
    const result = selector.getByPoint(world, this.getStrokeWidth() / 2, { through: true });

    // throughPath 是命中的全部图层；没有就回退到单 target。
    const leaves = result.throughPath?.list?.length
      ? result.throughPath.list
      : result.target
        ? [result.target]
        : [];

    const hits: { group: IUI; leaf: IUI }[] = [];
    const seen = new Set<IUI>();

    for (const leaf of leaves) {
      const group = this.resolveGroup(leaf as IUI);

      // 同一条笔迹的 group、内部图形、eraser 子节点可能同时命中，按 group 去重。
      if (!group || seen.has(group)) continue;

      seen.add(group);
      hits.push({ group, leaf: leaf as IUI });
    }

    return hits;
  }

  /**
   * 把一个命中叶子解析成「笔迹 group」。
   *
   * 命中项通常是 line group 内部的图形子节点（父级就是 line 节点）；
   * 直接命中 group 自身的情况也兼容。不可擦的叶子返回 undefined。
   */
  private resolveGroup(leaf: IUI): IUI | undefined {
    const erasable = this.config.erasable;
    const parent = leaf.parent as IUI | undefined;

    if (!erasable) return parent ?? leaf;

    // 与宿主 isErasableLineTarget 的判定顺序一致：优先父级，再自身。
    if (parent && erasable(parent)) return parent;
    if (erasable(leaf)) return leaf;

    return undefined;
  }

  private getSelector(): ISelector | undefined {
    const leafer = (this.config.container as unknown as { leafer?: { selector?: ISelector } })
      .leafer;

    // 交互层开启时 Leafer 自己会带选择器，优先复用。
    if (leafer?.selector) return leafer.selector;

    // 宿主没开交互层时自己建一个，保证插件独立可用。
    this.fallbackSelector ??= Creator.selector?.(this.config.container);

    return this.fallbackSelector;
  }

  private eraseAt(point: IPointData) {
    const hits = this.getHits(point);

    if (hits.length === 0) return;

    const world = this.config.container.getWorldPoint(point);

    // 同一点下的每一层笔迹各记一条轨迹，松手时各自抛出一次 erase。
    hits.forEach(({ group, leaf }) => {
      const container = group as DrawContainer;
      // 手势坐标是入口容器的局部坐标，这里换算到预览所在容器的局部坐标。
      const local = container.getInnerPoint(world);
      const stroke = this.getStroke(group, leaf);

      stroke.points.push(local.x, local.y);
      this.updatePreview(stroke);
    });
  }

  /**
   * 取（或建）某条笔迹的擦除轨迹缓存。
   *
   * 以「笔迹 group」为键去重：同一条笔迹的多个命中叶子共用一份轨迹。
   * offset 用叶子相对 group 的包围盒算（宿主实际只用 container 与 points）。
   */
  private getStroke(group: IUI, leaf: IUI) {
    const cached = this.strokes.get(group);

    if (cached) return cached;

    const container = group as DrawContainer;
    const bounds = leaf.getBounds("box", container);
    const stroke: EraseStroke = {
      container,
      offset: { x: bounds.x, y: bounds.y },
      points: [],
      target: leaf,
    };

    this.strokes.set(group, stroke);

    return stroke;
  }

  private updatePreview(stroke: EraseStroke) {
    if (this.config.preview === false) return;

    const points = padSinglePoint([...stroke.points]);
    const strokeWidth = this.getStrokeWidth();

    if (!stroke.preview) {
      const preview = new Line({
        className: ERASER_PREVIEW_CLASS,
        draggable: false,
        editable: false,
        eraser: "pixel",
        fill: "transparent",
        hittable: false,
        points,
        stroke: "#000000",
        strokeCap: "round",
        strokeWidth,
        x: 0,
        y: 0,
      });

      // 挂在目标父容器的最上层，Leafer 才会按像素擦掉下层内容。
      stroke.container.add(preview);
      stroke.preview = preview;

      return;
    }

    stroke.preview.set({ points, strokeWidth });
  }

  private finish() {
    const strokes = [...this.strokes.values()];

    this.strokes.clear();

    const events: EraserEraseEvent[] = [];

    strokes.forEach((stroke) => {
      stroke.preview?.destroy();
      stroke.preview = undefined;

      // 只有一个点不成轨迹，直接丢掉。
      if (stroke.points.length < 2) return;

      const event: EraserEraseEvent = {
        container: stroke.container,
        offset: stroke.offset,
        points: padSinglePoint([...stroke.points]),
        strokeWidth: this.getStrokeWidth(),
        target: stroke.target,
      };

      events.push(event);
      this.emit("erase", event);
    });

    // 即使一次都没擦到也抛，宿主的临时缓冲可以统一在这里清掉并提交。
    this.emit("end", { strokes: events });
  }
}
