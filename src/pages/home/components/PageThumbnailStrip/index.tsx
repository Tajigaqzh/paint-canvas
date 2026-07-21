import { PlusOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CanvasPage } from "@/types";
import { CanvasThumbnailWorkerManager } from "@/worker/thumbnail/workerManager";

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

const closeBitmap = (bitmap?: ImageBitmap) => {
  if (!bitmap) return;

  bitmap.close();
};

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

function PageThumbnailStrip({
  activePageId,
  onAddPage,
  onSelectPage,
  pageIds,
  pages,
}: PageThumbnailStripProps) {
  const managerRef = useRef<CanvasThumbnailWorkerManager | null>(null);
  const revisionRef = useRef(0);
  const thumbnailsRef = useRef<ThumbnailState>({});
  const [thumbnails, setThumbnails] = useState<ThumbnailState>({});
  const orderedPages = useMemo(
    () => pageIds.map((id) => pages[id]).filter((page): page is CanvasPage => Boolean(page)),
    [pageIds, pages],
  );

  useEffect(() => {
    managerRef.current = new CanvasThumbnailWorkerManager();

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
