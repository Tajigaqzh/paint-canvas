import {
  ClearOutlined,
  DeleteOutlined,
  EditOutlined,
  FullscreenOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SelectOutlined,
  ZoomInOutlined,
} from "@ant-design/icons";
import { Button, Select, Tooltip } from "antd";
import { useAppTranslation } from "@/i18n/useAppTranslation";
import type { CanvasToolMode } from "@/types";
import {
  BRUSH_COLORS,
  BRUSH_SIZES,
  ERASER_SIZES,
  MAGNIFIER_SIZES,
  MAGNIFIER_ZOOMS,
} from "./presets";

type PreviewToolbarProps = {
  /** 当前工具模式（预览页只用到 brush / eraser / magnifier）。 */
  activeTool: CanvasToolMode;
  /** 当前画笔颜色。 */
  brushColor: string;
  /** 当前画笔粗细。 */
  brushSize: number;
  /** 当前橡皮擦粗细。 */
  eraserSize: number;
  /** 当前放大镜镜片直径。 */
  magnifierSize: number;
  /** 当前放大镜放大倍数。 */
  magnifierZoom: number;
  /** 切换工具模式。 */
  onChangeTool: (tool: CanvasToolMode) => void;
  /** 修改画笔颜色。 */
  onChangeBrushColor: (color: string) => void;
  /** 修改画笔粗细。 */
  onChangeBrushSize: (size: number) => void;
  /** 修改橡皮擦粗细。 */
  onChangeEraserSize: (size: number) => void;
  /** 修改放大镜镜片直径。 */
  onChangeMagnifierSize: (size: number) => void;
  /** 修改放大镜放大倍数。 */
  onChangeMagnifierZoom: (zoom: number) => void;
  /** 一键清除全部批注。 */
  onClearNotes: () => void;
  /** 切换全屏。 */
  onToggleFullscreen: () => void;
  /** 当前是否处于全屏状态。 */
  isFullscreen?: boolean;
  /** 面板是否收起。 */
  collapsed: boolean;
  /** 切换面板展开 / 收起。 */
  onToggleCollapsed: () => void;
};

const ToolButton = ({
  active,
  icon,
  title,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}) => (
  <Tooltip title={title}>
    <Button
      icon={icon}
      type={active ? "primary" : "default"}
      onClick={onClick}
      style={{ width: 38, height: 38 }}
    />
  </Tooltip>
);

/**
 * 预览页右侧悬浮工具面板，可整体收起。
 * 汇集画笔 / 橡皮擦 / 放大镜工具，以及画笔颜色、画笔粗细、橡皮擦粗细、放大镜参数、
 * 清除批注和全屏等演示相关控制。
 */
export default function PreviewToolbar({
  activeTool,
  brushColor,
  brushSize,
  eraserSize,
  magnifierSize,
  magnifierZoom,
  onChangeTool,
  onChangeBrushColor,
  onChangeBrushSize,
  onChangeEraserSize,
  onChangeMagnifierSize,
  onChangeMagnifierZoom,
  onClearNotes,
  onToggleFullscreen,
  isFullscreen,
  collapsed,
  onToggleCollapsed,
}: PreviewToolbarProps) {
  const { t } = useAppTranslation();
  if (collapsed) {
    return (
      <div className="preview__panel preview__panel--collapsed">
        <Tooltip title={t("expandTools")}>
          <Button
            icon={<MenuUnfoldOutlined />}
            onClick={onToggleCollapsed}
            style={{ width: 38, height: 38 }}
          />
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="preview__panel">
      <div className="preview__panel-title">
        <span>{t("presentationTools")}</span>
        <Tooltip title={t("collapsePanel")}>
          <Button icon={<MenuFoldOutlined />} onClick={onToggleCollapsed} type="text" />
        </Tooltip>
      </div>

      <div className="preview__panel-section">
        <span className="preview__panel-label">{t("tools")}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <ToolButton
            active={activeTool === "select"}
            icon={<SelectOutlined />}
            title={t("pointerNoDrawing")}
            onClick={() => onChangeTool("select")}
          />
          <ToolButton
            active={activeTool === "brush"}
            icon={<EditOutlined />}
            title={t("brush")}
            onClick={() => onChangeTool("brush")}
          />
          <ToolButton
            active={activeTool === "eraser"}
            icon={<ClearOutlined />}
            title={t("eraser")}
            onClick={() => onChangeTool("eraser")}
          />
          <ToolButton
            active={activeTool === "magnifier"}
            icon={<ZoomInOutlined />}
            title={t("magnifier")}
            onClick={() => onChangeTool("magnifier")}
          />
        </div>
      </div>

      <div className="preview__panel-section">
        <span className="preview__panel-label">{t("brushColor")}</span>
        <div className="preview__swatches">
          {BRUSH_COLORS.map((color) => (
            <button
              key={color}
              className={`preview__swatch${brushColor === color ? " preview__swatch--active" : ""}`}
              style={{ background: color }}
              onClick={() => onChangeBrushColor(color)}
              aria-label={`${t("brushColor")} ${color}`}
            />
          ))}
        </div>
      </div>

      <div className="preview__panel-section">
        <span className="preview__panel-label">{t("brushSize")}</span>
        <Select
          options={BRUSH_SIZES.map((value) => ({ label: `${value}px`, value }))}
          value={brushSize}
          onChange={onChangeBrushSize}
          style={{ width: "100%" }}
        />
      </div>

      <div className="preview__panel-section">
        <span className="preview__panel-label">{t("eraserSize")}</span>
        <Select
          options={ERASER_SIZES.map((value) => ({ label: `${value}px`, value }))}
          value={eraserSize}
          onChange={onChangeEraserSize}
          style={{ width: "100%" }}
        />
      </div>

      <div className="preview__panel-section">
        <span className="preview__panel-label">{t("magnifier")}</span>
        <Select
          options={MAGNIFIER_SIZES.map((value) => ({ label: t("lensValuePx", { value }), value }))}
          value={magnifierSize}
          onChange={onChangeMagnifierSize}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <Select
          options={MAGNIFIER_ZOOMS.map((value) => ({ label: `${value}x`, value }))}
          value={magnifierZoom}
          onChange={onChangeMagnifierZoom}
          style={{ width: "100%" }}
        />
      </div>

      <div className="preview__panel-section">
        <Button danger icon={<DeleteOutlined />} onClick={onClearNotes} block>
          {t("clearAnnotations")}
        </Button>
        <Button
          icon={<FullscreenOutlined />}
          onClick={onToggleFullscreen}
          block
          type={isFullscreen ? "primary" : "default"}
        >
          {t("presentFullScreen")}
        </Button>
      </div>
    </div>
  );
}
