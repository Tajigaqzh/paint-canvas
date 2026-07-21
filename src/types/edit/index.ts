import type { IUI } from "leafer-ui";

export type EditorHandle = {
  /** 取消 Leafer 编辑器当前选择。 */
  cancel(): void;
  /** 监听 Leafer editor 插件事件。 */
  on(type: string, listener: (event: unknown) => void): void;
  /** 让 Leafer 编辑器显示单选或多选控制框。 */
  select(target: IUI | IUI[]): void;
};

export type EditableNodeUI = IUI & {
  /** Leafer UI 节点的批量属性更新方法，用于同步 store 数据。 */
  set(data: Record<string, number | string | boolean | undefined>): void;
};
