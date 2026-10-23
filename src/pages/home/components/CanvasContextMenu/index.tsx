import { useAppTranslation } from "@/i18n/useAppTranslation";

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
  /** 删除当前选中节点回调。 */
  onRemove: () => void;
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
  onRemove,
  onSendBackward,
  onUngroup,
}: CanvasContextMenuProps) {
  const { t } = useAppTranslation();
  if (!open) return null;

  return (
    <div className="canvas-context-menu" style={{ left: x, top: y }} onMouseLeave={onClose}>
      <button type="button" disabled={!canGroup} onClick={onGroup}>
        {t("groupObjects")}
      </button>
      <button type="button" disabled={!canUngroup} onClick={onUngroup}>
        {t("ungroup")}
      </button>
      <span />
      <button type="button" disabled={selectedCount !== 1} onClick={onBringForward}>
        {t("bringForward")}
      </button>
      <button type="button" disabled={selectedCount !== 1} onClick={onSendBackward}>
        {t("sendBackward")}
      </button>
      <span />
      <button type="button" disabled={selectedCount === 0} onClick={onRemove}>
        {t("delete")}
      </button>
    </div>
  );
}

export default CanvasContextMenu;
