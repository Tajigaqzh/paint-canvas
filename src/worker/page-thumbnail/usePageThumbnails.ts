/**
 * 多页缩略图 React hook：复用 PageThumbnailWorkerManager，在页面内容变化时按引用增量重绘。
 * 返回以页面 id 为键的缩略图状态表（bitmap / error），调用方直接渲染即可。
 *
 * 与 home 的 PageThumbnailStrip 共用同一套 worker 调度与脏检查逻辑，
 * 预览页只读展示时直接调用本 hook，不需要自己再维护 worker 生命周期。
 */
import { useEffect, useRef, useState } from "react";
import type { CanvasPage } from "@/types";
import { PageThumbnailWorkerManager } from "./workerManager";
import { collectDirtyPages } from "./dirtyPages";
import { THUMBNAIL_SIZE } from "./constants";

export type ThumbnailState = Record<
  string,
  {
    bitmap?: ImageBitmap;
    error?: string;
  }
>;

/** 缩略图重绘防抖时长：连续编辑（拖拽、调参滑块）会合并成一次重绘。 */
const THUMBNAIL_DEBOUNCE_MS = 200;

/** 释放缩略图使用的 ImageBitmap，避免页面切换或重渲染时积累位图资源。 */
const closeBitmap = (bitmap?: ImageBitmap) => {
  if (!bitmap) return;

  bitmap.close();
};

/**
 * 管理多页缩略图：首帧立即渲染，后续的连续改动走防抖合并重绘。
 * 页面内容按引用不可变更新，所以只在页面对象真正变化时重绘对应页。
 */
export const usePageThumbnails = (
  pages: Record<string, CanvasPage>,
  pageIds: string[],
): ThumbnailState => {
  const managerRef = useRef<PageThumbnailWorkerManager | null>(null);
  const revisionRef = useRef(0);
  /** 首帧立即渲染，后续的连续改动再走防抖，避免打开页面时缩略图延迟。 */
  const firstFlushRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** 已渲染缩略图的镜像，卸载时统一释放位图。 */
  const thumbnailsRef = useRef<ThumbnailState>({});
  const [thumbnails, setThumbnails] = useState<ThumbnailState>({});
  /** 与外部保持引用一致，flush 时用来取最新页面对象。 */
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  /** 上一轮对比用的页面字典与顺序，用来判断哪些页发生了变化。 */
  const prevPagesRef = useRef<Record<string, CanvasPage>>({});
  const prevPageIdsRef = useRef<string[]>([]);
  /** 累积待重绘 / 待删除的页，防抖期间多次改动会合并。 */
  const dirtyRef = useRef<Set<string>>(new Set());
  const removedRef = useRef<string[]>([]);

  /** 只把变化的页发给 worker 重绘，并把结果合并进现有缩略图。 */
  const flush = () => {
    const manager = managerRef.current;
    const dirtyIds = [...dirtyRef.current];
    const removedIds = [...removedRef.current];

    dirtyRef.current = new Set();
    removedRef.current = [];
    timerRef.current = undefined;
    firstFlushRef.current = false;

    if (!manager || (dirtyIds.length === 0 && removedIds.length === 0)) return;

    const revision = (revisionRef.current += 1);
    const pagesToRender = dirtyIds
      .map((id) => pagesRef.current[id])
      .filter((page): page is CanvasPage => Boolean(page));

    Promise.all(pagesToRender.map((page) => manager.renderPage(page, THUMBNAIL_SIZE)))
      .then((results) => {
        // 期间又有新改动，旧批次直接丢弃，避免覆盖最新缩略图。
        if (revisionRef.current !== revision) {
          results.forEach((result) => closeBitmap(result.bitmap));

          return;
        }

        const next: ThumbnailState = { ...thumbnailsRef.current };

        removedIds.forEach((id) => {
          closeBitmap(next[id]?.bitmap);
          delete next[id];
        });

        results.forEach((result) => {
          if (result.error) {
            console.error("缩略图渲染失败", result.pageId, result.error);

            return;
          }

          const previous = next[result.pageId];

          if (previous?.bitmap && previous.bitmap !== result.bitmap) {
            closeBitmap(previous.bitmap);
          }

          next[result.pageId] = { bitmap: result.bitmap };
        });

        thumbnailsRef.current = next;
        setThumbnails(next);
      })
      .catch(() => {
        // 单次批量任务失败时保留旧缩略图，下一次状态变化会重新渲染。
      });
  };

  /** 防抖调度：首帧立即执行，之后等改动停止一段时间再合并重绘。 */
  const scheduleFlush = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(flush, firstFlushRef.current ? 0 : THUMBNAIL_DEBOUNCE_MS);
  };

  useEffect(() => {
    // worker 与调用方一一对应，组件卸载时同时终止任务并释放当前位图。
    managerRef.current = new PageThumbnailWorkerManager();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      managerRef.current?.terminate();
      Object.values(thumbnailsRef.current).forEach((thumbnail) => {
        closeBitmap(thumbnail.bitmap);
      });
    };
  }, []);

  useEffect(() => {
    const { dirtyIds, removedIds } = collectDirtyPages(
      prevPagesRef.current,
      pages,
      prevPageIdsRef.current,
      pageIds,
    );

    dirtyIds.forEach((id) => dirtyRef.current.add(id));
    if (removedIds.length > 0) {
      removedRef.current = [...new Set([...removedRef.current, ...removedIds])];
    }

    prevPagesRef.current = pages;
    prevPageIdsRef.current = pageIds;

    if (dirtyRef.current.size === 0 && removedRef.current.length === 0) return;

    scheduleFlush();
  }, [pages, pageIds]);

  return thumbnails;
};
