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

const createEraserCursor = (size: number) => {
  const cursorSize = Math.max(12, Math.min(size, 64));
  const hotspotX = Math.max(1, Math.round(cursorSize * 0.125));
  const hotspotY = Math.max(1, Math.round(cursorSize * 0.875));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${cursorSize}" height="${cursorSize}"><path d="M567.494 765.551L270.292 557.448c-22.62-15.839-28.117-47.016-12.278-69.636l234.648-335.113c15.84-22.62 47.017-28.118 69.637-12.28L859.5 348.524c22.62 15.839 28.118 47.016 12.28 69.636L637.13 753.272c-15.839 22.62-47.016 28.118-69.636 12.28zM382.44 861.973L242.979 764.32c-45.241-31.678-56.236-94.032-24.558-139.273l22.28-31.82 303.294 212.369-22.28 31.82c-31.678 45.24-94.033 56.235-139.273 24.557z" fill="#1AA5FF"/></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, auto`;
};

function Home() {
  const message = useAppMessage(); // 消息提示
  const canvasViewRef = useRef<HTMLDivElement>(null);
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasShellSize = useSize(canvasShellRef); // 画布 shell 的 padding box 尺寸
  const [leftCollapsed, setLeftCollapsed] = useState(false); // 左侧是否折叠
  const [rightCollapsed, setRightCollapsed] = useState(false); // 右侧是否折叠
  const [activeTool, setActiveTool] = useState<CanvasToolMode>("select"); // 激活的工具
  const [brushSize, setBrushSize] = useState(8); // 笔刷粗细
  const [eraserSize, setEraserSize] = useState(24); // 橡皮擦粗细
  const [magnifierSize, setMagnifierSize] = useState(200); // 放大镜镜片直径
  const [magnifierZoom, setMagnifierZoom] = useState(3); // 放大镜放大倍数
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
    groupSelected,
    pageIds,
    pages,
    redo,
    removeNodes,
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

  useLeaferCanvas({
    magnifierCanvasRef,
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

  const closeContextMenu = () => {
    setContextMenu((value) => ({ ...value, open: false }));
  };

  const saveDocument = () => {
    try {
      window.localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(document));
      message.success("保存成功");
    } catch {
      message.error("保存失败");
    }
  };

  const openContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!getDraggingMaterialKind()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = getDraggingMaterialKind();
    setDraggingMaterialKind(undefined);

    if (!kind) return;

    const view = canvasViewRef.current;

    if (!view) return;

    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;

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
            {/* 放大镜镜片：位置、尺寸和显隐都由 useMagnifier 直接写 style，避免 pointermove 触发 React 重渲染。 */}
            <canvas className="canvas-maker__magnifier" ref={magnifierCanvasRef} />
          </div>
          <PageThumbnailStrip
            activePageId={activePageId}
            pageIds={pageIds}
            pages={pages}
            onAddPage={addPage}
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
        canGroup={canGroup}
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
