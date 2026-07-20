type CanvasContextMenuProps = {
  /** 当前选择是否可以打组。 */
  canGroup: boolean;
  /** 当前选择是否可以拆组。 */
  canUngroup: boolean;
  /** 菜单是否显示。 */
  open: boolean;
  /** 当前选中节点数量，用于限制单选层级操作。 */
  selectedCount: number;
  /** 菜单左上角 viewport X 坐标。 */
  x: number;
  /** 菜单左上角 viewport Y 坐标。 */
  y: number;
  /** 向上一层回调。 */
  onBringForward: () => void;
  /** 关闭菜单回调。 */
  onClose: () => void;
  /** 打组回调。 */
  onGroup: () => void;
  /** 向下一层回调。 */
  onSendBackward: () => void;
  /** 拆组回调。 */
  onUngroup: () => void;
};

function CanvasContextMenu({
  canGroup,
  canUngroup,
  open,
  selectedCount,
  x,
  y,
  onBringForward,
  onClose,
  onGroup,
  onSendBackward,
  onUngroup,
}: CanvasContextMenuProps) {
  if (!open) return null;

  return (
    <div className="canvas-context-menu" style={{ left: x, top: y }} onMouseLeave={onClose}>
      <button type="button" disabled={!canGroup} onClick={onGroup}>
        打组
      </button>
      <button type="button" disabled={!canUngroup} onClick={onUngroup}>
        拆分组
      </button>
      <span />
      <button type="button" disabled={selectedCount !== 1} onClick={onBringForward}>
        向上一层
      </button>
      <button type="button" disabled={selectedCount !== 1} onClick={onSendBackward}>
        向下一层
      </button>
    </div>
  );
}

export default CanvasContextMenu;
