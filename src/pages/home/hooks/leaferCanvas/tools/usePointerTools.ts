import { useEffect } from "react";
import { Line } from "leafer-ui";
import type { CanvasLineEraserUpdate, LineNode } from "@/types";
import { getNormalizedLineNodeInput } from "./brush";
import {
  findHitNode,
  getLineLocalPoint,
  getPointDistance,
  getPreviewLocalPoint,
} from "../geometry/hitDetection";
import { createLineEraserUI, getLineEraserInput } from "../ui/lineUi";
import type {
  CanvasPoint,
  LineEraserPreview,
  LineGroupUI,
  ToolDrawingState,
  UseLeaferCanvasOptions,
} from "../shared/types";
import type { useLeaferCanvasRuntime } from "../core/useLeaferCanvasRuntime";

type Runtime = ReturnType<typeof useLeaferCanvasRuntime>;

type UsePointerToolsParams = Pick<UseLeaferCanvasOptions, "viewRef" | "viewSize"> & Runtime;

/**
 * 接管 brush / eraser 的 pointer 手势。
 *
 * select 模式完全交给 Leafer Editor；brush 和 eraser 会在 DOM pointerdown 后
 * 绑定 window 级 move/up，保证拖出画板时仍能结束绘制或擦除。
 */
export const usePointerTools = ({
  boardRef,
  drawingRef,
  onAddDrawLineRef,
  onApplyEraserResultRef,
  onSelectNodeRef,
  pageRef,
  toolRef,
  uiKindMapRef,
  uiMapRef,
  uiParentMapRef,
  viewRef,
  viewSize,
}: UsePointerToolsParams) => {
  const uiMap = uiMapRef.current;
  const uiKindMap = uiKindMapRef.current;
  const uiParentMap = uiParentMapRef.current;

  useEffect(() => {
    /**
     * 把浏览器 pointer 事件坐标换算成业务画板坐标。
     *
     * DOM 事件给的是 viewport 像素坐标；Leafer stage 会把 1920 x 1080 的业务画板
     * 等比缩放并居中到 canvas 容器内。这里反向扣掉 DOM 位置、居中偏移和缩放比例，
     * 得到后续 brush / eraser 都能直接使用的画板坐标。
     */
    const getCanvasPoint = (event: PointerEvent): CanvasPoint | undefined => {
      // DOM 坐标必须换算成 1920 x 1080 的业务画板坐标。
      const view = viewRef.current;
      const activePage = pageRef.current;

      // view 还没挂载时不处理指针。
      if (!view) return undefined;

      // rect 是当前 canvas DOM 在浏览器 viewport 中的位置和尺寸。
      const rect = view.getBoundingClientRect();
      // viewSize 由 Home 的 useSize 给出；没有时退回 DOM 实测尺寸。
      const viewWidth = viewSize?.width ?? rect.width;
      const viewHeight = viewSize?.height ?? rect.height;
      // stage 用同样的规则等比缩放业务画板，所以指针反算也必须一致。
      const scale = Math.min(
        viewWidth / activePage.viewport.width,
        viewHeight / activePage.viewport.height,
      );
      // boardX / boardY 是白色画板在 canvas 容器内部的居中偏移。
      const boardX = Math.max((viewWidth - activePage.viewport.width * scale) / 2, 0);
      const boardY = Math.max((viewHeight - activePage.viewport.height * scale) / 2, 0);
      const x = (event.clientX - rect.left - boardX) / scale;
      const y = (event.clientY - rect.top - boardY) / scale;

      // 指针落在白色画板外时，不启动画笔或橡皮擦。
      if (x < 0 || y < 0 || x > activePage.viewport.width || y > activePage.viewport.height) {
        return undefined;
      }

      return { x, y };
    };

    /**
     * 给某条 line 的实时 eraser 预览追加一个路径点。
     *
     * point 是画板全局坐标，临时 eraser Line 挂在 line group 内，所以要先转换成 line 局部坐标。
     * 转换后的 path 会同时驱动实时预览，并在 pointerup 时写入 store.eraserPaths。
     */
    const appendPointToLinePreview = (preview: LineEraserPreview, point: CanvasPoint) => {
      const localPoint = getPreviewLocalPoint(preview, point);
      const lastX = preview.path[preview.path.length - 2];
      const lastY = preview.path[preview.path.length - 1];

      // 同一个点不重复写入，减少 points 数量，也避免 Leafer 反复重绘同一条路径。
      if (lastX === localPoint.x && lastY === localPoint.y) return;

      preview.path.push(localPoint.x, localPoint.y);
      preview.tempLine.set(getLineEraserInput(preview.path, toolRef.current.eraserSize));
    };
    /**
     * 给本次手势已经命中过的所有 line 预览追加当前鼠标点。
     *
     * 一旦某条 line 被命中，它的 eraser 子线就跟随完整鼠标轨迹。
     * 这样鼠标短暂离开 line 的命中范围后再回来，擦除路径仍然连续，不会断成多个突兀片段。
     */
    const appendPointToActiveLinePreviews = (point: CanvasPoint) => {
      // 一旦某条 line 在本次手势中被命中过，它的 eraser 子线就应该跟随完整鼠标轨迹。
      drawingRef.current?.lineErasers.forEach((preview) => {
        appendPointToLinePreview(preview, point);
      });
    };
    /**
     * 更新某条 line 在当前 eraser 手势中的实时擦除预览。
     *
     * line 不会像普通图形那样整节点 destroy。
     * 第一次命中时，在 line group 内新建一个临时 eraser Line；
     * 后续持续命中时，只更新同一个临时 Line 的 points，由 Leafer 原生 eraser 实时渲染。
     */
    const updateLinePreview = (id: string, node: LineNode, parentOffset: CanvasPoint) => {
      // line 擦除不 destroy 原 UI，而是在 line group 里追加一个 Leafer 原生 eraser Line。
      const drawing = drawingRef.current;
      const lineGroup = uiMap.get(id) as LineGroupUI | undefined;
      const lastPoint = {
        x: drawing?.points[drawing.points.length - 2] ?? 0,
        y: drawing?.points[drawing.points.length - 1] ?? 0,
      };

      if (!drawing || !lineGroup) return;

      const localPoint = getLineLocalPoint(node, lastPoint, parentOffset);
      let preview = drawing.lineErasers.get(id);

      if (!preview) {
        // 第一次命中这条线时创建临时 eraser 子 Line，并从当前点开始记录局部路径。
        const path = [localPoint.x, localPoint.y];
        const tempLine = createLineEraserUI(path, toolRef.current.eraserSize);

        lineGroup.add?.(tempLine);
        preview = {
          nodeX: node.x,
          nodeY: node.y,
          parentOffset,
          path,
          tempLine,
        };
        drawing.lineErasers.set(id, preview);
        return;
      }

      // 同一条 line 上持续拖动时，只更新同一个临时 eraser Line，实时预览由 Leafer 渲染器完成。
      appendPointToLinePreview(preview, lastPoint);
    };
    /**
     * 清理本次手势创建的临时 line eraser 预览。
     *
     * 临时 eraser Line 只负责拖动中的即时反馈。
     * pointerup 后会先销毁它们，再通过 store.eraserPaths 重建持久 eraser 子节点，
     * 避免同一条擦除路径显示两遍。
     */
    const cleanupLineEraserPreviews = (drawing: ToolDrawingState) => {
      // 临时 eraser Line 只用于本次拖动预览；松手后会由 store.eraserPaths 重建为持久子节点。
      drawing.lineErasers.forEach((preview) => {
        preview.tempLine.destroy();
      });
      drawing.lineErasers.clear();
    };
    /**
     * 把本次手势中的 line eraser 预览转换成 store 更新数据。
     *
     * 返回的 points 已经是 line 内部局部坐标，主画布和缩略图 worker 都会按同一规则重建。
     * 这里不直接写 store，只生成 onApplyEraserResult 需要的一次性提交数据。
     */
    const getLineEraserUpdates = (drawing: ToolDrawingState): CanvasLineEraserUpdate[] =>
      [...drawing.lineErasers.entries()]
        .map(([id, preview]) => ({
          id,
          points: [...preview.path],
          strokeWidth: toolRef.current.eraserSize,
        }))
        .filter((update) => update.points.length >= 2);

    /**
     * 在指定画板坐标执行一次橡皮擦命中和擦除。
     *
     * 普通节点：命中后先临时 destroy UI，让用户立刻看到消失效果，松手再从 store 删除。
     * line 节点：不删除整条线，只更新 line group 内的 eraser 预览路径，实现局部擦除。
     */
    const eraseAtPoint = (point: CanvasPoint) => {
      // 没有正在进行的 eraser 手势时，不做删除。
      const drawing = drawingRef.current;

      if (!drawing) return;

      // 从当前页面根节点开始命中检测，内部会递归 group。
      const hit = findHitNode(
        pageRef.current,
        pageRef.current.rootIds,
        point,
        toolRef.current.eraserSize / 2,
      );
      const node = hit ? pageRef.current.nodeMap[hit.id] : undefined;

      // 没命中时，本次 move 不擦除任何东西。
      if (!hit || !node) return;

      if (node.kind === "line") {
        // 线条命中后只更新 eraser 预览，不加入 erasedIds，因为它不会整条删除。
        updateLinePreview(hit.id, node, hit.offset);
        return;
      }

      // 普通节点仍然是整节点擦除，同一手势命中过一次后不重复处理。
      if (drawing.erasedIds.has(hit.id)) return;

      // 先从 Leafer UI 上临时销毁，让用户立刻看到擦除效果；松手后再提交到 store。
      drawing.erasedIds.add(hit.id);
      uiMap.get(hit.id)?.destroy();
      uiMap.delete(hit.id);
      uiKindMap.delete(hit.id);
      uiParentMap.delete(hit.id);
    };

    /**
     * 处理 brush / eraser 的 pointerdown。
     *
     * select 模式不进入这里的自定义流程，事件继续交给 Leafer Editor。
     * brush / eraser 模式会接管本次手势、清空当前选区，并把 move/up 监听挂到 window，
     * 确保鼠标拖出画布后仍能正常结束本次绘制或擦除。
     */
    const handlePointerDown = (event: PointerEvent) => {
      // select 模式下不拦截 pointer，让 Leafer Editor 负责点击、拖拽和框选。
      const activeTool = toolRef.current;

      if (activeTool.mode === "select") return;

      // brush / eraser 只在白色业务画板内开始。
      const point = getCanvasPoint(event);

      if (!point) return;

      // 自定义工具接管本次手势，阻止 Leafer Editor 同时选中或拖拽节点。
      event.preventDefault();
      event.stopPropagation();
      onSelectNodeRef.current(undefined);

      // 记录本次手势的 pointerId 和起点，后续 move/up 只响应同一个 pointer。
      const drawing: ToolDrawingState = {
        erasedIds: new Set(),
        lineErasers: new Map(),
        pointerId: event.pointerId,
        points: [point.x, point.y],
      };

      drawingRef.current = drawing;

      if (activeTool.mode === "brush") {
        // brush 拖动过程中先画一条临时 Line，避免每个 move 都写 store。
        const tempLine = new Line({
          curve: 0.2,
          editable: false,
          fill: "transparent",
          points: [...drawing.points],
          stroke: "#111827",
          strokeCap: "round",
          strokeWidth: activeTool.brushSize,
          x: 0,
          y: 0,
        });

        boardRef.current?.add(tempLine);
        drawing.tempLine = tempLine;
      } else {
        // eraser 按下时立即尝试擦除起点下方节点。
        eraseAtPoint(point);
      }

      // move/up 监听挂到 window，保证指针拖出画布后仍能完成本次手势。
      window.addEventListener("pointermove", handlePointerMove, true);
      window.addEventListener("pointerup", handlePointerUp, true);
    };

    /**
     * 处理 brush / eraser 的 pointermove。
     *
     * brush：按最小距离采样，更新临时 Line 的 points，不频繁写 store。
     * eraser：每次移动都尝试擦除当前位置，并给已命中的 line 追加 eraser 路径点。
     */
    const handlePointerMove = (event: PointerEvent) => {
      // 只处理当前手势对应的 pointer。
      const drawing = drawingRef.current;

      if (!drawing || drawing.pointerId !== event.pointerId) return;

      // 移动到画板外时，本次 move 不产生新点或擦除。
      const point = getCanvasPoint(event);

      if (!point) return;

      // 自定义工具持续接管事件。
      event.preventDefault();
      event.stopPropagation();

      if (toolRef.current.mode === "brush") {
        // 采样点距离太近时跳过，减少 points 数量和渲染压力。
        const lastY = drawing.points[drawing.points.length - 1] ?? point.y;
        const lastX = drawing.points[drawing.points.length - 2] ?? point.x;

        if (getPointDistance({ x: lastX, y: lastY }, point) < 2) return;

        // 追加采样点，并更新临时线条的 points。
        drawing.points.push(point.x, point.y);

        if (drawing.tempLine) {
          drawing.tempLine.points = [...drawing.points];
        }
        return;
      }

      // eraser 模式每次 move 都尝试擦除当前位置命中的节点。
      // 已命中的 line 也会继续追加路径点，实现“橡皮擦经过哪里就擦哪里”的实时效果。
      drawing.points.push(point.x, point.y);
      appendPointToActiveLinePreviews(point);
      eraseAtPoint(point);
    };

    /**
     * 处理 brush / eraser 的 pointerup。
     *
     * brush：销毁临时 Line，把采样点归一化成 LineNode，并提交一次 addDrawLine。
     * eraser：销毁临时 eraser 预览，把普通节点删除列表和 line eraserPaths 作为一次历史提交。
     */
    const handlePointerUp = (event: PointerEvent) => {
      // 非当前 pointer 的 up 不结束手势。
      const drawing = drawingRef.current;

      if (!drawing || drawing.pointerId !== event.pointerId) return;

      // 松手后移除全局监听，避免后续普通鼠标移动继续进入工具逻辑。
      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);

      if (toolRef.current.mode === "brush") {
        // 临时线只用于即时反馈，最终会转换成 store 中的 LineNode。
        drawing.tempLine?.destroy();

        // 归一化采样点，生成一条业务 LineNode。
        const lineInput = getNormalizedLineNodeInput(drawing.points, toolRef.current.brushSize);

        if (lineInput) {
          // 只在松手时提交一次历史记录。
          onAddDrawLineRef.current(lineInput);
        }
      } else {
        const lineErasers = getLineEraserUpdates(drawing);

        // 临时 eraser Line 先清掉，随后 store 更新会按 eraserPaths 重建持久 eraser 子节点。
        cleanupLineEraserPreviews(drawing);
        // eraser 也是松手时把普通节点删除和 line eraser 轨迹作为一次历史记录提交。
        onApplyEraserResultRef.current([...drawing.erasedIds], lineErasers);
      }

      // 清空手势状态，等待下一次 pointerdown。
      drawingRef.current = null;
    };

    // 只在 canvas 容器上监听 pointerdown；后续 move/up 由手势开始时动态绑定。
    const view = viewRef.current;

    if (!view) return undefined;

    view.addEventListener("pointerdown", handlePointerDown, true);

    // effect 依赖变化或组件卸载时，移除可能残留的监听。
    return () => {
      view.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [
    boardRef,
    drawingRef,
    onAddDrawLineRef,
    onApplyEraserResultRef,
    onSelectNodeRef,
    pageRef,
    toolRef,
    uiKindMap,
    uiMap,
    uiParentMap,
    viewRef,
    viewSize?.height,
    viewSize?.width,
  ]);
};
