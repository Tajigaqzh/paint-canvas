import { LeftOutlined, RightOutlined, UpOutlined } from "@ant-design/icons";
import { Button } from "antd";
import type { CanvasPage } from "@/types";
import { usePageThumbnails } from "@/worker/page-thumbnail/usePageThumbnails";
import { ThumbnailCanvas } from "@/pages/home/components/PageThumbnailStrip/ThumbnailCanvas";

type PreviewPageStripProps = {
  /** 全部页面字典，key 是页面 ID。 */
  pages: Record<string, CanvasPage>;
  /** 页面顺序。 */
  pageIds: string[];
  /** 当前激活页面 ID。 */
  activePageId: string;
  /** 切换到指定页面。 */
  onSelectPage: (id: string) => void;
  /** 面板是否收起（收起后只显示展开按钮）。 */
  collapsed: boolean;
  /** 切换展开 / 收起。 */
  onToggleCollapsed: () => void;
};

/**
 * 预览页底部多页缩略图切换条，可整体收起；也支持键盘左右键翻页（在预览页内监听）。
 * 切换页面会触发该页动画从头播放。缩略图复用制作页的 page-thumbnail worker 渲染。
 */
export default function PreviewPageStrip({
  pages,
  pageIds,
  activePageId,
  onSelectPage,
  collapsed,
  onToggleCollapsed,
}: PreviewPageStripProps) {
  const thumbnails = usePageThumbnails(pages, pageIds);

  if (collapsed) {
    return (
      <div className="preview__strip preview__strip--collapsed">
        <Button size="small" onClick={onToggleCollapsed}>
          页码
        </Button>
      </div>
    );
  }

  const currentIndex = pageIds.indexOf(activePageId);

  return (
    <div className="preview__strip">
      <Button
        icon={<LeftOutlined />}
        disabled={pageIds.length <= 1}
        onClick={() => onSelectPage(pageIds[(currentIndex - 1 + pageIds.length) % pageIds.length])}
      />
      <div className="preview__page-thumbs">
        {pageIds.map((id, index) => {
          const page = pages[id];
          const thumbnail = thumbnails[id];

          return (
            <button
              key={id}
              className={`preview__page-thumb${id === activePageId ? " preview__page-thumb--active" : ""}`}
              type="button"
              onClick={() => onSelectPage(id)}
              title={page?.name}
            >
              <span className="preview__page-thumb-index">{index + 1}</span>
              <span className="preview__page-thumb-preview">
                <ThumbnailCanvas bitmap={thumbnail?.bitmap} />
                {thumbnail?.error && (
                  <span className="preview__page-thumb-error" title={thumbnail.error}>
                    渲染失败
                  </span>
                )}
              </span>
              <span className="preview__page-thumb-name">{page?.name}</span>
            </button>
          );
        })}
      </div>
      <Button
        icon={<RightOutlined />}
        disabled={pageIds.length <= 1}
        onClick={() => onSelectPage(pageIds[(currentIndex + 1) % pageIds.length])}
      />
      <Button icon={<UpOutlined />} title="收起" onClick={onToggleCollapsed} />
    </div>
  );
}
