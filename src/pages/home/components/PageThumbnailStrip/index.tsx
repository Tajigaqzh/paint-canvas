import { PlusOutlined } from "@ant-design/icons";
import { Button, Dropdown, Tooltip } from "antd";
import { useMemo } from "react";
import type { MenuProps } from "antd";
import type { CanvasPage } from "@/types";
import { usePageThumbnails } from "@/worker/page-thumbnail/usePageThumbnails";
import { ThumbnailCanvas } from "./ThumbnailCanvas";

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
  const thumbnails = usePageThumbnails(pages, pageIds);
  const orderedPages = useMemo(
    () => pageIds.map((id) => pages[id]).filter((page): page is CanvasPage => Boolean(page)),
    [pageIds, pages],
  );

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
