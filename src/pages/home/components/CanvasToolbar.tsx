import { RedoOutlined, SaveOutlined, UndoOutlined } from "@ant-design/icons";
import { Button, Space, Tooltip } from "antd";

type CanvasToolbarProps = {
  /** 是否存在可重做历史。 */
  canRedo: boolean;
  /** 是否存在可撤销历史。 */
  canUndo: boolean;
  /** 点击重做按钮时触发。 */
  onRedo: () => void;
  /** 点击撤销按钮时触发。 */
  onUndo: () => void;
};

function CanvasToolbar({ canRedo, canUndo, onRedo, onUndo }: CanvasToolbarProps) {
  return (
    <Space.Compact className="canvas-maker__toolbar">
      <Tooltip classNames={{ root: "canvas-maker__toolbar-tooltip" }} title="撤销">
        <Button disabled={!canUndo} icon={<UndoOutlined />} onClick={onUndo} />
      </Tooltip>
      <Tooltip classNames={{ root: "canvas-maker__toolbar-tooltip" }} title="重做">
        <Button disabled={!canRedo} icon={<RedoOutlined />} onClick={onRedo} />
      </Tooltip>
      <Tooltip classNames={{ root: "canvas-maker__toolbar-tooltip" }} title="保存">
        <Button type="primary" icon={<SaveOutlined />}>
          保存
        </Button>
      </Tooltip>
    </Space.Compact>
  );
}

export default CanvasToolbar;
