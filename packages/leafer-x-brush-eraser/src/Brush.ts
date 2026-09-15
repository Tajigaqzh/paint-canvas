import { Line } from "@leafer-ui/core";
import type { IPointData } from "@leafer-ui/interface";
import { Emitter } from "./emitter";
import { normalizeLinePoints } from "./geometry";
import { createPointerGesture, type PointerGesture } from "./gesture";
import type { BrushConfig, BrushDrawEvent } from "./types";
import { getContainerView, toContainerPoint } from "./view";

/** 笔迹预览的 className；宿主遍历场景时可以据此区分临时预览和真实节点。 */
export const PREVIEW_CLASS = "brush-preview";

/** 默认描边颜色。 */
export const DEFAULT_STROKE = "#111827";
/** 默认描边宽度（容器局部坐标）。 */
export const DEFAULT_STROKE_WIDTH = 8;
/** 默认采样节流距离。 */
export const DEFAULT_MIN_DISTANCE = 2;
/** 默认曲线平滑度。 */
export const DEFAULT_CURVE = 0.2;

type BrushEvents = {
  /** 一段笔迹结束时抛出，宿主在这里把数据写进自己的状态。 */
  draw: BrushDrawEvent;
};

/**
 * 自由绘制插件。
 *
 * 手势采样和实时预览由插件自己管（预览是一条临时 Line，直接画在宿主给的容器里），
 * 松手时把归一化后的笔迹通过 `draw` 事件交回宿主。插件不持有任何文档状态，
 * 也不 import 任何框架。
 */
export class Brush extends Emitter<BrushEvents> {
  private config: BrushConfig;
  private gesture: PointerGesture | undefined;
  private points: number[] = [];
  private preview: Line | undefined;
  private enabledValue: boolean;

  constructor(config: BrushConfig) {
    super();

    this.config = config;
    this.enabledValue = config.enabled ?? true;

    const view = config.view ?? getContainerView(config.container);

    if (view) {
      this.gesture = createPointerGesture(
        {
          isEnabled: () => this.enabledValue,
          minDistance: config.minDistance ?? DEFAULT_MIN_DISTANCE,
          toPoint: (event) => toContainerPoint(config.container, event),
          view,
        },
        {
          onEnd: () => this.finish(),
          onMove: (point) => this.append(point),
          onStart: (point) => this.begin(point),
        },
      );

      if (this.enabledValue) this.gesture.attach();
    }
  }

  /** 是否启用；禁用时会中断当前笔迹且不提交。 */
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
  set(config: Partial<Omit<BrushConfig, "container" | "view">>) {
    this.config = { ...this.config, ...config };
  }

  /** 解绑指针事件并丢弃预览，之后这个实例不再可用。 */
  dispose() {
    this.cancel();
    this.gesture?.detach();
    this.clearListeners();
  }

  /** 中断当前笔迹：丢掉预览，不抛事件。 */
  cancel() {
    this.points = [];
    this.preview?.destroy();
    this.preview = undefined;
  }

  private begin(point: IPointData) {
    this.points = [point.x, point.y];

    const preview = new Line({
      className: PREVIEW_CLASS,
      curve: this.config.curve ?? DEFAULT_CURVE,
      draggable: false,
      editable: false,
      fill: "transparent",
      hittable: false,
      points: [...this.points],
      stroke: this.config.stroke ?? DEFAULT_STROKE,
      strokeCap: "round",
      strokeWidth: this.config.strokeWidth ?? DEFAULT_STROKE_WIDTH,
      x: 0,
      y: 0,
    });

    this.config.container.add(preview);
    this.preview = preview;
  }

  private append(point: IPointData) {
    this.points.push(point.x, point.y);
    this.preview?.set({ points: [...this.points] });
  }

  private finish() {
    const points = this.points;
    const preview = this.preview;

    this.points = [];
    this.preview = undefined;
    preview?.destroy();

    const geometry = normalizeLinePoints(points);

    // 点数不足时不产生笔迹，宿主也不会收到事件。
    if (!geometry) return;

    this.emit("draw", {
      ...geometry,
      stroke: this.config.stroke ?? DEFAULT_STROKE,
      strokeWidth: this.config.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    });
  }
}
