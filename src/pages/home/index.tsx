import { useSize } from "ahooks";
import { useMemo, useRef, useState } from "react";
import { useAppMessage } from "@/hooks/useAppMessage";
import { useCanvasStore } from "@/stores/canvasStore";
import type { CanvasDocument, CanvasToolMode } from "@/types";
import CanvasContextMenu from "./components/CanvasContextMenu";
import CanvasToolbar from "./components/CanvasToolbar";
import MaterialPanel from "./components/MaterialPanel";
import PageThumbnailStrip from "./components/PageThumbnailStrip";
import PropertyPanel from "./components/PropertyPanel";
import { useLeaferCanvas } from "./hooks/useLeaferCanvas";
import "./index.less";

const CANVAS_STORAGE_KEY = "paint-canvas:document";

function Home() {
  const message = useAppMessage();
  const canvasViewRef = useRef<HTMLDivElement>(null);
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const canvasSize = useSize(canvasShellRef);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<CanvasToolMode>("select");
  const [brushSize, setBrushSize] = useState(8);
  const [eraserSize, setEraserSize] = useState(24);
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
  const fittedCanvasSize = useMemo(() => {
    const shellWidth = canvasSize?.width ?? 0;
    const shellHeight = canvasSize?.height ?? 0;

    if (shellWidth <= 0 || shellHeight <= 0) {
      return {
        height: 540,
        width: 960,
      };
    }

    const width = Math.min(shellWidth, shellHeight * (viewport.width / viewport.height));

    return {
      height: width * (viewport.height / viewport.width),
      width,
    };
  }, [canvasSize?.height, canvasSize?.width, viewport.height, viewport.width]);

  useLeaferCanvas({
    onSelectNode: selectNode,
    onSelectNodes: selectNodes,
    onAddDrawLine: addDrawLine,
    onRemoveNodes: removeNodes,
    onUpdateNode: updateNode,
    onUpdateNodes: updateNodes,
    page: activePage,
    tool: {
      brushSize,
      eraserSize,
      mode: activeTool,
    },
    viewRef: canvasViewRef,
    viewSize: fittedCanvasSize,
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
          onChangeBrushSize={setBrushSize}
          onChangeEraserSize={setEraserSize}
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
              style={{
                height: fittedCanvasSize.height,
                width: fittedCanvasSize.width,
              }}
            />
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
