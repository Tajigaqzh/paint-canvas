import type { CanvasPage } from "@/types";
import { renderNode } from "./node";
import type { PageImages, RenderContext } from "./types";

/**
 * 渲染整页缩略图并返回 ImageBitmap。
 * 缩略图只包含白色画布和画布内元素，外层灰色工作区背景不会参与绘制。
 *
 * 原理：
 * worker 内使用 OffscreenCanvas，不阻塞主线程。
 * 先按缩略图尺寸创建离屏画布，再把页面 viewport 等比缩放进去。
 * 绘制完成后 transferToImageBitmap()，把位图所有权转交给主线程显示。
 */
export const renderPage = (page: CanvasPage, width: number, height: number, images: PageImages) => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("当前浏览器无法创建 OffscreenCanvas 2D 上下文");
  }

  const scale = Math.min(width / page.viewport.width, height / page.viewport.height);
  const boardX = Math.max((width - page.viewport.width * scale) / 2, 0);
  const boardY = Math.max((height - page.viewport.height * scale) / 2, 0);

  paintPageBoard(context, page, width, height, scale, boardX, boardY);
  page.rootIds.forEach((nodeId) => {
    renderNode(page, nodeId, context, images);
  });
  context.restore();

  return canvas.transferToImageBitmap();
};

const paintPageBoard = (
  context: RenderContext,
  page: CanvasPage,
  width: number,
  height: number,
  scale: number,
  boardX: number,
  boardY: number,
) => {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.save();

  /**
   * 把 1920 x 1080 的画布按比例缩放到缩略图尺寸中。
   * boardX / boardY 用来让画布在缩略图容器中居中。
   */
  context.translate(boardX, boardY);
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, page.viewport.width, page.viewport.height);
  context.strokeStyle = "#d9dee8";
  context.lineWidth = 1 / scale;
  context.strokeRect(0, 0, page.viewport.width, page.viewport.height);
  context.beginPath();
  context.rect(0, 0, page.viewport.width, page.viewport.height);
  context.clip();
};
