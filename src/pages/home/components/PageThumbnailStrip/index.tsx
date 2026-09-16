import { PlusOutlined } from "@ant-design/icons";
import { Button, Dropdown, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuProps } from "antd";
import type { CanvasPage } from "@/types";
import { PageThumbnailWorkerManager } from "@/worker/page-thumbnail";
import { collectDirtyPages } from "./dirtyPages";

type PageThumbnailStripProps = {
  activePageId: string;
  onAddPage: () => void;
  onDuplicatePage: (id: string) => void;
  onInsertBlankPage: (id: string) => void;
  onRemovePage: (id: string) => void;
  onSelectPage: (id: string) => void;
  pageIds: string[];
  pages: Record<string, CanvasPage>;
};

type ThumbnailState = Record<
  string,
  {
    bitmap?: ImageBitmap;
    error?: string;
  }
>;

/** 缩略图重绘防抖时长：连续编辑（拖拽、调参滑块）会合并成一次重绘。 */
const THUMBNAIL_DEBOUNCE_MS = 200;

const THUMBNAIL_SIZE = {
  height: 78,
  width: 138,
};

/** 释放缩略图使用的 ImageBitmap，避免页面切换或重渲染时积累位图资源。 */
const closeBitmap = (bitmap?: ImageBitmap) => {
  if (!bitmap) return;

  bitmap.close();
};

/** 将 worker 返回的 ImageBitmap 绘制到缩略图 canvas 中。 */
function ThumbnailCanvas({ bitmap }: { bitmap?: ImageBitmap }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !bitmap) return;

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");

    context?.clearRect(0, 0, canvas.width, canvas.height);
    context?.drawImage(bitmap, 0, 0);
  }, [bitmap]);

  return (
    <canvas
      aria-hidden="true"
      className="page-thumbnail__canvas"
      height={THUMBNAIL_SIZE.height}
      ref={canvasRef}
      width={THUMBNAIL_SIZE.width}
    />
  );
}

/** 展示页面缩略图、处理页面切换，并管理缩略图 worker 的生命周期。 */
function PageThumbnailStrip({
  activePageId,
  onAddPage,
  onDuplicatePage,
  onInsertBlankPage,
  onRemovePage,
  onSelectPage,
  pageIds,
  pages,
}: PageThumbnailStripProps) {
  const managerRef = useRef<PageThumbnailWorkerManager | null>(null);
  const revisionRef = useRef(0);
  /** 首帧立即渲染，后续的连续改动再走防抖，避免打开页面时缩略图延迟。 */
  const firstFlushRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** 已渲染缩略图的镜像，卸载时统一释放位图。 */
  const thumbnailsRef = useRef<ThumbnailState>({});
  const [thumbnails, setThumbnails] = useState<ThumbnailState>({});
  /** 与 store 保持引用一致，flush 时用来取最新页面对象。 */
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  /** 上一轮对比用的页面字典与顺序，用来判断哪些页发生了变化。 */
  const prevPagesRef = useRef<Record<string, CanvasPage>>({});
  const prevPageIdsRef = useRef<string[]>([]);
  /** 累积待重绘 / 待删除的页，防抖期间多次改动会合并。 */
  const dirtyRef = useRef<Set<string>>(new Set());
  const removedRef = useRef<string[]>([]);
  const orderedPages = useMemo(
    () => pageIds.map((id) => pages[id]).filter((page): page is CanvasPage => Boolean(page)),
    [pageIds, pages],
  );

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
    // worker 与页面条一一对应，组件卸载时同时终止任务并释放当前位图。
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

  /** 缩略图右键菜单：复制当前页、插入空白页、删除当前页（最后一页不可删）。 */
  const buildPageMenu = (pageId: string): MenuProps => ({
    items: [
      { key: "duplicate", label: "复制当前页" },
      { key: "insert", label: "插入空白页" },
      { type: "divider" },
      { disabled: pageIds.length <= 1, key: "delete", label: "删除当前页" },
    ],
    onClick: ({ key }) => {
      if (key === "duplicate") onDuplicatePage(pageId);
      else if (key === "insert") onInsertBlankPage(pageId);
      else if (key === "delete") onRemovePage(pageId);
    },
  });

  return (
    <footer className="page-thumbnail-strip">
      <div className="page-thumbnail-strip__scroller">
        {orderedPages.map((page, index) => {
          const thumbnail = thumbnails[page.id];

          return (
            <Dropdown key={page.id} menu={buildPageMenu(page.id)} trigger={["contextMenu"]}>
              <button
                className="page-thumbnail"
                data-active={page.id === activePageId}
                type="button"
                onClick={() => onSelectPage(page.id)}
              >
                <span className="page-thumbnail__index">{index + 1}</span>
                <span className="page-thumbnail__preview">
                  <ThumbnailCanvas bitmap={thumbnail?.bitmap} />
                  {thumbnail?.error && (
                    <span className="page-thumbnail__error" title={thumbnail.error}>
                      渲染失败
                    </span>
                  )}
                </span>
                <span className="page-thumbnail__name">{page.name}</span>
              </button>
            </Dropdown>
          );
        })}
      </div>

      <Tooltip classNames={{ root: "canvas-maker__toolbar-tooltip" }} title="新增页面">
        <Button className="page-thumbnail-strip__add" icon={<PlusOutlined />} onClick={onAddPage} />
      </Tooltip>
    </footer>
  );
}

export default PageThumbnailStrip;
