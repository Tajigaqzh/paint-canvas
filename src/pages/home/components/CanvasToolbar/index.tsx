import {
  ClearOutlined,
  EditOutlined,
  RedoOutlined,
  SaveOutlined,
  SelectOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { Button, Select, Space, Tooltip } from "antd";
import type { CanvasToolMode } from "@/types";

type CanvasToolbarProps = {
  /** 当前画布交互工具。 */
  activeTool: CanvasToolMode;
  /** 当前画笔粗细。 */
  brushSize: number;
  /** 是否存在可重做历史。 */
  canRedo: boolean;
  /** 是否存在可撤销历史。 */
  canUndo: boolean;
  /** 当前橡皮擦粗细。 */
  eraserSize: number;
  /** 切换画布交互工具。 */
  onChangeTool: (tool: CanvasToolMode) => void;
  /** 修改画笔粗细。 */
  onChangeBrushSize: (size: number) => void;
  /** 修改橡皮擦粗细。 */
  onChangeEraserSize: (size: number) => void;
  /** 保存当前画布文档。 */
  onSave: () => void;
  /** 点击重做按钮时触发。 */
  onRedo: () => void;
  /** 点击撤销按钮时触发。 */
  onUndo: () => void;
};

const brushSizeOptions = [4, 8, 12, 20, 32].map((value) => ({
  label: `${value}px`,
  value,
}));

const eraserSizeOptions = [12, 20, 32, 48, 64].map((value) => ({
  label: `${value}px`,
  value,
}));

function CanvasToolbar({
  activeTool,
  brushSize,
  canRedo,
  canUndo,
  eraserSize,
  onChangeBrushSize,
  onChangeEraserSize,
  onChangeTool,
  onRedo,
  onSave,
  onUndo,
}: CanvasToolbarProps) {
  return (
    <Space className="canvas-maker__toolbar" size={12}>
      <Space.Compact>
        <Tooltip classNames={{ root: "canvas-maker__toolbar-tooltip" }} title="选择">
          <Button
            icon={<SelectOutlined />}
            type={activeTool === "select" ? "primary" : "default"}
            onClick={() => onChangeTool("select")}
          />
        </Tooltip>
        <Tooltip classNames={{ root: "canvas-maker__toolbar-tooltip" }} title="画笔">
          <Button
            icon={<EditOutlined />}
            type={activeTool === "brush" ? "primary" : "default"}
            onClick={() => onChangeTool("brush")}
          />
        </Tooltip>
        <Select
          classNames={{ popup: { root: "canvas-maker__toolbar-size-dropdown" } }}
          className="canvas-maker__toolbar-size"
          disabled={activeTool !== "brush"}
          options={brushSizeOptions}
          value={brushSize}
          onChange={onChangeBrushSize}
        />
        <Tooltip classNames={{ root: "canvas-maker__toolbar-tooltip" }} title="橡皮擦">
          <Button
            icon={<ClearOutlined />}
            type={activeTool === "eraser" ? "primary" : "default"}
            onClick={() => onChangeTool("eraser")}
          />
        </Tooltip>
        <Select
          classNames={{ popup: { root: "canvas-maker__toolbar-size-dropdown" } }}
          className="canvas-maker__toolbar-size"
          disabled={activeTool !== "eraser"}
          options={eraserSizeOptions}
          value={eraserSize}
          onChange={onChangeEraserSize}
        />
      </Space.Compact>

      <Space.Compact>
        <Tooltip classNames={{ root: "canvas-maker__toolbar-tooltip" }} title="撤销">
          <Button disabled={!canUndo} icon={<UndoOutlined />} onClick={onUndo} />
        </Tooltip>
        <Tooltip classNames={{ root: "canvas-maker__toolbar-tooltip" }} title="重做">
          <Button disabled={!canRedo} icon={<RedoOutlined />} onClick={onRedo} />
        </Tooltip>
        <Tooltip classNames={{ root: "canvas-maker__toolbar-tooltip" }} title="保存">
          <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>
            保存
          </Button>
        </Tooltip>
      </Space.Compact>
    </Space>
  );
}

export default CanvasToolbar;
