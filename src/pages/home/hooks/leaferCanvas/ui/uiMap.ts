import type { IUI } from "leafer-ui";
import type { ManagedNodeUI } from "@/types";

/** Editor 事件给的是 UI 实例，用托管索引反查业务 nodeId。 */
export const findNodeIdByUI = (uiMap: Map<string, ManagedNodeUI>, target: IUI) =>
  [...uiMap.entries()].find(([, ui]) => ui === target)?.[0];
