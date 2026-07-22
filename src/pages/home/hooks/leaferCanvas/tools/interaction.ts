import type { PointerLikeEvent } from "../shared/types";

/**
 * 判断一次点击是否是“追加/切换选择”。
 *
 * Leafer 事件和原始 DOM 事件在不同浏览器里字段位置不完全一致，所以同时兼容
 * event.ctrlKey / metaKey / shiftKey 和 event.origin 上的同名字段。
 */
export const isAdditiveSelect = (event: PointerLikeEvent) =>
  Boolean(
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.origin?.ctrlKey ||
    event.origin?.metaKey ||
    event.origin?.shiftKey,
  );
