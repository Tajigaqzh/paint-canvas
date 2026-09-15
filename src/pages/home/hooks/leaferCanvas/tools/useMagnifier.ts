import { useEffect } from "react";
import type { EditableLeaferApp, UseLeaferCanvasOptions } from "@/types";
import type { useRuntime } from "../core/useRuntime";
import { drawMagnifierLens, getMagnifierSample } from "./magnifier";

type Runtime = ReturnType<typeof useRuntime>;

type UseMagnifierParams = Pick<UseLeaferCanvasOptions, "magnifierCanvasRef" | "tool" | "viewRef"> &
  Pick<Runtime, "appRef" | "toolRef">;

/**
 * 取业务节点真正绘制的那层画布。
 *
 * App 带 editor 时 canvas 是多层合成画布，节点内容画在 tree 层；
 * 取错层会放大到空白或 Editor 控制框。
 */
const getSourceCanvas = (app: EditableLeaferApp | null) => (app?.tree ?? app)?.canvas?.view;

/**
 * 放大镜的 hover 手势：指针停在画板上时，把画布局部放大到镜片画布里。
 *
 * 镜片是 Home 渲染的 DOM canvas，位置和尺寸都由这里直接写 style：
 * pointermove 是高频事件，走 React state 会让整个制作页每帧重渲染。
 */
export const useMagnifier = ({
  appRef,
  magnifierCanvasRef,
  tool,
  toolRef,
  viewRef,
}: UseMagnifierParams) => {
  // 只有 mode 需要参与 React 依赖：切走工具时要立刻收起镜片。
  const mode = tool.mode;

  useEffect(() => {
    const lens = magnifierCanvasRef.current;
    const view = viewRef.current;

    if (!lens || !view) return undefined;

    const hideLens = () => {
      lens.style.display = "none";
    };

    const handlePointerMove = (event: PointerEvent) => {
      const currentTool = toolRef.current;

      if (currentTool.mode !== "magnifier") return;

      const source = getSourceCanvas(appRef.current);
      // host 是镜片的定位参照（画布外层容器）；镜片用绝对定位挂在它里面。
      const host = lens.parentElement;

      if (!source || !host) return;

      const sourceRect = source.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      // 镜片尺寸是 CSS 像素，取样区域要换算成源画布的设备像素。
      const pixelRatio = window.devicePixelRatio || 1;
      const lensSize = currentTool.magnifierSize;
      const sample = getMagnifierSample(
        { x: event.clientX - sourceRect.left, y: event.clientY - sourceRect.top },
        lensSize,
        currentTool.magnifierZoom,
        pixelRatio,
      );

      drawMagnifierLens(lens, source, lensSize, sample, pixelRatio);
      lens.style.display = "block";
      lens.style.width = `${lensSize}px`;
      lens.style.height = `${lensSize}px`;
      // 镜片中心始终压在指针上，取样点才和放大后的中心一致。
      lens.style.left = `${event.clientX - hostRect.left - lensSize / 2}px`;
      lens.style.top = `${event.clientY - hostRect.top - lensSize / 2}px`;
    };

    // 用捕获阶段监听：Leafer 自己也会在画布上处理 pointer 事件，避免被它提前 stopPropagation。
    view.addEventListener("pointermove", handlePointerMove, true);
    view.addEventListener("pointerleave", hideLens);

    return () => {
      view.removeEventListener("pointermove", handlePointerMove, true);
      view.removeEventListener("pointerleave", hideLens);
      hideLens();
    };
  }, [appRef, magnifierCanvasRef, toolRef, viewRef]);

  // 指针离开画布后不会再有 pointermove 兜底，工具切走时必须主动收起镜片。
  useEffect(() => {
    if (mode === "magnifier") return;

    const lens = magnifierCanvasRef.current;

    if (lens) {
      lens.style.display = "none";
    }
  }, [magnifierCanvasRef, mode]);
};
