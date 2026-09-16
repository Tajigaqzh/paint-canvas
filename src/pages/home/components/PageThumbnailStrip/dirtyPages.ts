import type { CanvasPage } from "@/types";

/**
 * 对比前后两份页面字典，找出需要重绘的页面和已删除的页面。
 *
 * store 每次提交都会按引用不可变更新文档：只有真正改动的页面会拿到新对象，
 * 其余页面保持同一引用。因此用引用相等判断“是否变化”，比深比较便宜得多，
 * 也避免了纯选中 / 层级切换这类不影响缩略图内容的改动误触发全量重绘。
 */
export const collectDirtyPages = (
  prevPages: Record<string, CanvasPage>,
  nextPages: Record<string, CanvasPage>,
  prevPageIds: string[],
  nextPageIds: string[],
): { dirtyIds: string[]; removedIds: string[] } => {
  const dirtyIds = new Set<string>();

  for (const id of nextPageIds) {
    if (prevPages[id] !== nextPages[id]) {
      dirtyIds.add(id);
    }
  }

  const removedIds = prevPageIds.filter((id) => !nextPages[id]);

  return { dirtyIds: [...dirtyIds], removedIds };
};
