import { useSize } from "ahooks";
import { ConfigProvider } from "antd";
import { useMemo, useRef, useState } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import type { CanvasDocument } from "./types";
import CanvasContextMenu from "./components/CanvasContextMenu";
import CanvasToolbar from "./components/CanvasToolbar";
import MaterialPanel from "./components/MaterialPanel";
import PropertyPanel from "./components/PropertyPanel";
import { useLeaferCanvas } from "./hooks/useLeaferCanvas";
import "./index.less";

function Home() {
  const canvasViewRef = useRef<HTMLDivElement>(null);
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const canvasSize = useSize(canvasShellRef);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
  });
  const {
    activeId,
    addNode,
    bringForward,
    canGroup,
    canRedo,
    canUndo,
    canUngroup,
    groupSelected,
    nodeMap,
    redo,
    rootIds,
    selectedIds,
    selectNode,
    selectNodes,
    sendBackward,
    undo,
    ungroupSelected,
    updateNode,
    viewport,
  } = useCanvasStore();

  const document = useMemo<CanvasDocument>(
    () => ({
      activeId,
      nodeMap,
      rootIds,
      selectedIds,
      viewport,
    }),
    [activeId, nodeMap, rootIds, selectedIds, viewport],
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
    document,
    onSelectNode: selectNode,
    onSelectNodes: selectNodes,
    onUpdateNode: updateNode,
    viewRef: canvasViewRef,
    viewSize: fittedCanvasSize,
  });

  const closeContextMenu = () => {
    setContextMenu((value) => ({ ...value, open: false }));
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
    <ConfigProvider
      componentSize="large"
      theme={{
        token: {
          borderRadius: 8,
          controlHeight: 44,
          fontSize: 15,
        },
        components: {
          Button: {
            controlHeightLG: 46,
            fontSizeLG: 16,
            paddingInlineLG: 18,
          },
          Tabs: {
            cardHeight: 46,
            fontSize: 16,
            titleFontSize: 16,
          },
        },
      }}
    >
      <div className="canvas-maker" onClick={closeContextMenu}>
        <header className="canvas-maker__header">
          <div className="canvas-maker__brand">
            <span className="canvas-maker__brand-icon" aria-hidden="true" />
            <h1>Canvas 制作工具</h1>
          </div>

          <CanvasToolbar canRedo={canRedo} canUndo={canUndo} onRedo={redo} onUndo={undo} />
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
                {viewport.width} x {viewport.height}
              </span>
            </div>
            <div
              className="canvas-maker__canvas-shell"
              ref={canvasShellRef}
              onContextMenu={openContextMenu}
            >
              <div
                className="canvas-maker__canvas"
                ref={canvasViewRef}
                style={{
                  height: fittedCanvasSize.height,
                  width: fittedCanvasSize.width,
                }}
              />
            </div>
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
    </ConfigProvider>
  );
}

export default Home;
