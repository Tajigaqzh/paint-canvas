import { PlusOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CanvasPage } from "@/types";
import { PageThumbnailWorkerManager } from "@/worker/page-thumbnail";

type PageThumbnailStripProps = {
  activePageId: string;
  onAddPage: () => void;
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
  onSelectPage,
  pageIds,
  pages,
}: PageThumbnailStripProps) {
  const managerRef = useRef<PageThumbnailWorkerManager | null>(null);
  const revisionRef = useRef(0);
  const thumbnailsRef = useRef<ThumbnailState>({});
  const [thumbnails, setThumbnails] = useState<ThumbnailState>({});
  const orderedPages = useMemo(
    () => pageIds.map((id) => pages[id]).filter((page): page is CanvasPage => Boolean(page)),
    [pageIds, pages],
  );

  useEffect(() => {
    // worker 与页面条一一对应，组件卸载时同时终止任务并释放当前位图。
    managerRef.current = new PageThumbnailWorkerManager();

    return () => {
      managerRef.current?.terminate();
      Object.values(thumbnailsRef.current).forEach((thumbnail) => {
        closeBitmap(thumbnail.bitmap);
      });
    };
  }, []);

  useEffect(() => {
    const manager = managerRef.current;

    if (!manager || orderedPages.length === 0) return;

    // 每次页面数据变化都递增版本号，丢弃返回较晚的旧批次，避免覆盖最新缩略图。
    const revision = revisionRef.current + 1;

    revisionRef.current = revision;

    manager
      .renderPages(orderedPages, THUMBNAIL_SIZE)
      .then((results) => {
        if (revisionRef.current !== revision) {
          results.forEach((result) => closeBitmap(result.bitmap));
          return;
        }

        results.forEach((result) => {
          if (result.error) {
            console.error("缩略图渲染失败", result.pageId, result.error);
          }
        });

        const next = Object.fromEntries(
          results.map((result) => [
            result.pageId,
            {
              bitmap: result.bitmap,
              error: result.error,
            },
          ]),
        );

        Object.entries(thumbnailsRef.current).forEach(([pageId, thumbnail]) => {
          if (thumbnail.bitmap !== next[pageId]?.bitmap) {
            closeBitmap(thumbnail.bitmap);
          }
        });
        thumbnailsRef.current = next;
        setThumbnails(next);
      })
      .catch(() => {
        // 单次批量任务失败时保留旧缩略图，下一次状态变化会重新渲染。
      });
  }, [orderedPages]);

  return (
    <footer className="page-thumbnail-strip">
      <div className="page-thumbnail-strip__scroller">
        {orderedPages.map((page, index) => {
          const thumbnail = thumbnails[page.id];

          return (
            <button
              className="page-thumbnail"
              data-active={page.id === activePageId}
              key={page.id}
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
