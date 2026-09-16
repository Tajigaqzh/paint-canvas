import { CaretRightOutlined, SettingOutlined } from "@ant-design/icons";
import { useSize } from "ahooks";
import { Button, Drawer, InputNumber, Space, Switch } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCanvasStore } from "@/stores/canvasStore";
import type { CanvasToolMode, LineNode } from "@/types";
import { useLeaferCanvas } from "@/pages/home/hooks/useLeaferCanvas";
import { getCanvasViewSize } from "@/pages/home/canvasFit";
import { createEraserCursor } from "@/pages/home/eraserCursor";
import PreviewToolbar from "./PreviewToolbar";
import { BRUSH_COLORS } from "./presets";
import PreviewPageStrip from "./PreviewPageStrip";
import "./index.less";

/** 预览演示页：只读展示 home 制作的画布，支持画笔批注、橡皮擦、一键清除、动画播放与演示设置。 */
const PreviewPage = () => {
  const navigate = useNavigate();
  const canvasViewRef = useRef<HTMLDivElement>(null);
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasShellSize = useSize(canvasShellRef);

  // 这些是预览页自身的 UI 状态，不进入文档，也不参与撤销/重做。
  // 默认“鼠标”模式：只展示画布、不绘制；切到画笔才进入批注状态，随时可切回。
  const [activeTool, setActiveTool] = useState<CanvasToolMode>("select");
  const [brushSize, setBrushSize] = useState(8);
  const [eraserSize, setEraserSize] = useState(24);
  const [brushColor, setBrushColor] = useState(BRUSH_COLORS[0]);
  const [magnifierSize, setMagnifierSize] = useState(200);
  const [magnifierZoom, setMagnifierZoom] = useState(3);
  const [replayToken, setReplayToken] = useState(0);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [stripCollapsed, setStripCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [autoplaySeconds, setAutoplaySeconds] = useState(5);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    activePage,
    activePageId,
    pageIds,
    pages,
    addDrawLine,
    applyEraserResult,
    clearPreviewNotes,
    selectPage,
  } = useCanvasStore();

  const canvasViewSize = useMemo(
    () => getCanvasViewSize(canvasShellSize, canvasShellRef.current),
    [canvasShellSize],
  );
  const eraserCursor = useMemo(() => createEraserCursor(eraserSize), [eraserSize]);

  // 预览批注统一打 source === "preview" 标签，便于离开预览页时单独清掉，不污染制作文档。
  const handleAddDrawLine = useCallback(
    (line: Omit<LineNode, "id" | "name">) => addDrawLine(line, "preview"),
    [addDrawLine],
  );

  // 橡皮擦在预览页只擦“预览批注”：命中项必须是 source === "preview" 的 line 节点，
  // 制作页里本身的 brush 笔迹（source === "brush"）不受影响。
  const erasableFilter = useCallback(
    (id: string) => {
      const node = activePage.nodeMap[id];

      return node?.kind === "line" && node.source === "preview";
    },
    [activePage],
  );

  const noop = useCallback(() => {}, []);

  // 预览只读：选择/位置回写都置空，实际写回在 hook 内部也已被 readOnly 拦截。
  useLeaferCanvas({
    erasableFilter,
    magnifierContainerRef: canvasShellRef,
    onAddDrawLine: handleAddDrawLine,
    onApplyEraserResult: applyEraserResult,
    onSelectNode: noop,
    onSelectNodes: noop,
    onUpdateNode: noop,
    onUpdateNodes: noop,
    page: activePage,
    readOnly: true,
    replayToken,
    showRuler: false,
    tool: {
      brushColor,
      brushSize,
      eraserSize,
      magnifierSize,
      magnifierZoom,
      mode: activeTool,
    },
    viewRef: canvasViewRef,
    viewSize: canvasViewSize,
  });

  /** 从头播放当前页所有节点动画。 */
  const handlePlayAnimations = useCallback(() => setReplayToken((token) => token + 1), []);

  /** 切换到指定页面并播放该页动画。 */
  const handleSelectPage = useCallback(
    (id: string) => {
      selectPage(id);
      setReplayToken((token) => token + 1);
    },
    [selectPage],
  );

  /** 一键清除全部预览批注（source === "preview"），保留制作内容。 */
  const handleClearNotes = useCallback(() => {
    clearPreviewNotes();
  }, [clearPreviewNotes]);

  // 离开预览页时清掉本轮演示产生的批注，避免回到制作页后还残留。
  useEffect(() => {
    return () => {
      useCanvasStore.getState().clearPreviewNotes();
    };
  }, []);

  /** 全屏切换：把整页容器切到浏览器全屏。 */
  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

    document.addEventListener("fullscreenchange", onChange);

    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // 键盘左右键翻页并播放动画。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const { activePageId: current, pageIds: ids } = useCanvasStore.getState();

      if (ids.length <= 1) return;

      const index = ids.indexOf(current);
      const next =
        ids[
          event.key === "ArrowRight"
            ? (index + 1) % ids.length
            : (index - 1 + ids.length) % ids.length
        ];

      handleSelectPage(next);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [handleSelectPage]);

  // 自动轮播：按间隔顺序播放各页。
  useEffect(() => {
    if (!autoplay) return;

    const timer = window.setInterval(
      () => {
        const { activePageId: current, pageIds: ids, selectPage: go } = useCanvasStore.getState();

        if (ids.length <= 1) return;

        const index = ids.indexOf(current);
        const next = ids[(index + 1) % ids.length];

        go(next);
        setReplayToken((token) => token + 1);
      },
      Math.max(1, autoplaySeconds) * 1000,
    );

    return () => window.clearInterval(timer);
  }, [autoplay, autoplaySeconds]);

  return (
    <div className="preview" ref={rootRef}>
      <header className="preview__header">
        <div className="preview__brand">
          <span className="preview__brand-icon" aria-hidden="true" />
          <h1>预览演示</h1>
        </div>
        <Space className="preview__actions">
          <Button icon={<CaretRightOutlined />} onClick={handlePlayAnimations}>
            播放动画
          </Button>
          <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>
            演示设置
          </Button>
          <Button onClick={() => navigate("/")}>返回制作</Button>
        </Space>
      </header>

      <main className="preview__body">
        <div
          className="preview__canvas-shell"
          ref={canvasShellRef}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="preview__canvas"
            data-tool={activeTool}
            ref={canvasViewRef}
            style={{ cursor: activeTool === "eraser" ? eraserCursor : undefined }}
          />
        </div>

        <PreviewToolbar
          activeTool={activeTool}
          brushColor={brushColor}
          brushSize={brushSize}
          collapsed={panelCollapsed}
          eraserSize={eraserSize}
          magnifierSize={magnifierSize}
          magnifierZoom={magnifierZoom}
          onChangeBrushColor={setBrushColor}
          onChangeBrushSize={setBrushSize}
          onChangeEraserSize={setEraserSize}
          onChangeMagnifierSize={setMagnifierSize}
          onChangeMagnifierZoom={setMagnifierZoom}
          onChangeTool={setActiveTool}
          onClearNotes={handleClearNotes}
          onToggleCollapsed={() => setPanelCollapsed((value) => !value)}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
        />

        <PreviewPageStrip
          activePageId={activePageId}
          collapsed={stripCollapsed}
          onSelectPage={handleSelectPage}
          onToggleCollapsed={() => setStripCollapsed((value) => !value)}
          pageIds={pageIds}
          pages={pages}
        />
      </main>

      <Drawer title="演示设置" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <div className="preview__settings-item">
          <span>自动轮播</span>
          <Switch checked={autoplay} onChange={setAutoplay} />
        </div>
        <div className="preview__settings-item">
          <span>轮播间隔（秒）</span>
          <InputNumber
            min={1}
            max={60}
            value={autoplaySeconds}
            onChange={(value) => setAutoplaySeconds(value ?? 5)}
          />
        </div>
        <p className="preview__settings-hint">
          画笔颜色、画笔粗细、橡皮擦粗细、放大镜参数在右侧工具面板中设置。切换页面或键盘左右键会从头播放该页动画。
        </p>
      </Drawer>
    </div>
  );
};

export default PreviewPage;
