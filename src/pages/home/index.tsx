import { useSize } from "ahooks";
import { useMemo, useRef, useState } from "react";
import { useAppMessage } from "@/hooks/useAppMessage";
import { useCanvasStore } from "@/stores/canvasStore";
import type { CanvasDocument, CanvasToolMode } from "@/types";
import { getCanvasViewSize } from "./canvasFit";
import CanvasContextMenu from "./components/CanvasContextMenu";
import CanvasToolbar from "./components/CanvasToolbar";
import MaterialPanel from "./components/MaterialPanel";
import PageThumbnailStrip from "./components/PageThumbnailStrip";
import PropertyPanel from "./components/PropertyPanel";
import { useLeaferCanvas } from "./hooks/useLeaferCanvas";
import {
  getDraggingMaterialKind,
  mapMaterialDropPoint,
  setDraggingMaterialKind,
} from "./materialDrop";
import "./index.less";

const CANVAS_STORAGE_KEY = "paint-canvas:document";

/**
 * 生成随橡皮尺寸变化的光标。光标位图限制在 12～64px，避免极端笔刷尺寸遮住画布；
 * 热点落在橡皮左下方，与图标实际接触画布的位置保持一致。
 */
const createEraserCursor = (size: number) => {
  const cursorSize = Math.max(12, Math.min(size, 64));
  const hotspotX = Math.max(1, Math.round(cursorSize * 0.125));
  const hotspotY = Math.max(1, Math.round(cursorSize * 0.875));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${cursorSize}" height="${cursorSize}"><path d="M567.494 765.551L270.292 557.448c-22.62-15.839-28.117-47.016-12.278-69.636l234.648-335.113c15.84-22.62 47.017-28.118 69.637-12.28L859.5 348.524c22.62 15.839 28.118 47.016 12.28 69.636L637.13 753.272c-15.839 22.62-47.016 28.118-69.636 12.28zM382.44 861.973L242.979 764.32c-45.241-31.678-56.236-94.032-24.558-139.273l22.28-31.82 303.294 212.369-22.28 31.82c-31.678 45.24-94.033 56.235-139.273 24.557z" fill="#1AA5FF"/></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, auto`;
};

/** 制作页工作台：编排工具栏、素材/属性面板与 Leafer 画布运行时。 */
function Home() {
  const message = useAppMessage();
  // shell 用于测量可用空间和承载浮层，view 才是 Leafer 实际挂载的内容区域。
  const canvasViewRef = useRef<HTMLDivElement>(null);
  const canvasShellRef = useRef<HTMLDivElement>(null);
  // useSize 返回 shell 的 padding box，后续还需扣除内边距才能得到真实画布视口。
  const canvasShellSize = useSize(canvasShellRef);

  // 这些状态只描述当前工作台 UI，不进入文档，也不参与撤销/重做。
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<CanvasToolMode>("select");
  const [brushSize, setBrushSize] = useState(8);
  const [eraserSize, setEraserSize] = useState(24);
  const [magnifierSize, setMagnifierSize] = useState(200);
  const [magnifierZoom, setMagnifierZoom] = useState(3);
  const [contextMenu, setContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
  });
  const {
    activePage,
    activePageId,
    addDrawLine,
    addPage,
    addNode,
    applyEraserResult,
    bringForward,
    canGroup,
    canRedo,
    canUndo,
    canUngroup,
    duplicatePage,
    groupSelected,
    insertBlankPage,
    pageIds,
    pages,
    redo,
    removeNodes,
    removePage,
    selectNode,
    selectPage,
    selectNodes,
    sendBackward,
    undo,
    ungroupSelected,
    updateNode,
    updateNodes,
  } = useCanvasStore();
  const { activeId, nodeMap, selectedIds, viewport } = activePage;

  // 保存时从 Store 派生完整文档，避免维护一份可能与当前页状态脱节的副本。
  const document = useMemo<CanvasDocument>(
    () => ({
      activePageId,
      pageIds,
      pages,
    }),
    [activePageId, pageIds, pages],
  );
  const activeNode = activeId ? nodeMap[activeId] : undefined;

  // shell 带内边距，Leafer 只挂在内容区，视图尺寸必须扣掉 padding，见 canvasFit.ts。
  const canvasViewSize = useMemo(
    () => getCanvasViewSize(canvasShellSize, canvasShellRef.current),
    [canvasShellSize],
  );
  const eraserCursor = useMemo(() => createEraserCursor(eraserSize), [eraserSize]);

  // 画布运行时通过这些 Store action 回写交互结果，确保 Leafer 不会成为第二份业务状态。
  useLeaferCanvas({
    magnifierContainerRef: canvasShellRef,
    onSelectNode: selectNode,
    onSelectNodes: selectNodes,
    onAddDrawLine: addDrawLine,
    onApplyEraserResult: applyEraserResult,
    onUpdateNode: updateNode,
    onUpdateNodes: updateNodes,
    page: activePage,
    tool: {
      brushSize,
      eraserSize,
      magnifierSize,
      magnifierZoom,
      mode: activeTool,
    },
    viewRef: canvasViewRef,
    viewSize: canvasViewSize,
  });

  // 打组只在“编辑（select）”工具下可用：画笔时是连续绘制状态，选区不适合组织成组。
  const canGroupInEditMode = canGroup && activeTool === "select";

  /** 关闭画布上的右键菜单。 */
  const closeContextMenu = () => {
    setContextMenu((value) => ({ ...value, open: false }));
  };

  /** 将当前 Store 文档序列化到浏览器本地存储，并反馈保存结果。 */
  const saveDocument = () => {
    try {
      window.localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(document));
      message.success("保存成功");
    } catch {
      // localStorage 可能因隐私策略、配额或序列化失败而不可用，统一留在页面层反馈。
      message.error("保存失败");
    }
  };

  /** 记录右键菜单的 viewport 坐标，并阻止浏览器默认菜单。 */
  const openContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    // 菜单相对 viewport 定位，因此直接保留 client 坐标，不参与画布缩放反算。
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
    });
  };

  /** 拖拽素材经过画布时，仅允许素材拖放进入并显示复制光标。 */
  const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    // 只接管素材面板发起的拖拽，避免阻止浏览器处理其它原生拖放。
    if (!getDraggingMaterialKind()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  /** 将素材落点从 DOM 客户端坐标换算为画布业务坐标，并创建节点。 */
  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = getDraggingMaterialKind();
    // 无论后续坐标校验是否通过，都结束本次拖拽，防止残留类型污染下一次 drop。
    setDraggingMaterialKind(undefined);

    if (!kind) return;

    const view = canvasViewRef.current;

    if (!view) return;

    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;

    // DOM client 坐标需结合舞台缩放和平移，反算为固定 1920×1080 的业务坐标。
    const point = mapMaterialDropPoint(
      event.clientX,
      event.clientY,
      view,
      canvasViewSize,
      viewport,
    );

    if (!point) return;

    addNode(kind, point);
  };

  return (
    <div className="canvas-maker" onClick={closeContextMenu}>
      <header className="canvas-maker__header">
        <div className="canvas-maker__brand">
          <span className="canvas-maker__brand-icon" aria-hidden="true" />
          <h1>Canvas 制作工具</h1>
        </div>

        <CanvasToolbar
          activeTool={activeTool}
          brushSize={brushSize}
          canRedo={canRedo}
          canUndo={canUndo}
          eraserSize={eraserSize}
          magnifierSize={magnifierSize}
          magnifierZoom={magnifierZoom}
          onChangeBrushSize={setBrushSize}
          onChangeEraserSize={setEraserSize}
          onChangeMagnifierSize={setMagnifierSize}
          onChangeMagnifierZoom={setMagnifierZoom}
          onChangeTool={setActiveTool}
          onRedo={redo}
          onSave={saveDocument}
          onUndo={undo}
        />
      </header>

      <main className="canvas-maker__body">
        <MaterialPanel
          collapsed={leftCollapsed}
          onAddNode={addNode}
          onToggle={() => setLeftCollapsed((value) => !value)}
        />

        <section className="canvas-maker__workspace">
          <div className="canvas-maker__workspace-bar">
            <span>画布区域</span>
            <span>
              {activePage.name} · {viewport.width} x {viewport.height}
            </span>
          </div>
          <div
            className="canvas-maker__canvas-shell"
            ref={canvasShellRef}
            onContextMenu={openContextMenu}
          >
            <div
              className="canvas-maker__canvas"
              data-tool={activeTool}
              ref={canvasViewRef}
              onDragOver={handleCanvasDragOver}
              onDrop={handleCanvasDrop}
              style={{ cursor: activeTool === "eraser" ? eraserCursor : undefined }}
            />
          </div>
          <PageThumbnailStrip
            activePageId={activePageId}
            pageIds={pageIds}
            pages={pages}
            onAddPage={addPage}
            onDuplicatePage={duplicatePage}
            onInsertBlankPage={insertBlankPage}
            onRemovePage={removePage}
            onSelectPage={selectPage}
          />
        </section>

        <PropertyPanel
          canUngroup={canUngroup}
          collapsed={rightCollapsed}
          node={activeNode}
          onToggle={() => setRightCollapsed((value) => !value)}
          onUngroup={ungroupSelected}
          onUpdateNode={updateNode}
        />
      </main>

      <CanvasContextMenu
        canGroup={canGroupInEditMode}
        canUngroup={canUngroup}
        open={contextMenu.open}
        selectedCount={selectedIds.length}
        x={contextMenu.x}
        y={contextMenu.y}
        onBringForward={() => {
          bringForward();
          closeContextMenu();
        }}
        onClose={closeContextMenu}
        onGroup={() => {
          // 非编辑工具下不执行打组，避免绕过菜单 disabled 状态直接触发。
          if (activeTool !== "select") return;
          groupSelected();
          closeContextMenu();
        }}
        onRemove={() => {
          removeNodes(selectedIds);
          closeContextMenu();
        }}
        onSendBackward={() => {
          sendBackward();
          closeContextMenu();
        }}
        onUngroup={() => {
          ungroupSelected();
          closeContextMenu();
        }}
      />
    </div>
  );
}

export default Home;
