import type { CanvasPage } from "@/types";
import { isImageNode } from "../images";
import {
  fillAndStrokeNode,
  getCornerRadiusValues,
  renderRoundRect,
  strokeCurrentPath,
  withNodeTransform,
  withStrokeStyle,
} from "./context";
import { renderEllipseNode } from "./ellipse";
import { renderLineNode } from "./line";
import { renderRegularPolygonPath, renderStarPath } from "./polygon";
import type { PageImages, RenderContext } from "./types";

/**
 * 根据节点类型分发到对应的绘制函数。
 * group 会递归绘制 childrenIds，普通节点会先应用自身坐标和旋转。
 */
export const renderNode = (
  page: CanvasPage,
  nodeId: string,
  context: RenderContext,
  images: PageImages,
) => {
  const node = page.nodeMap[nodeId];

  if (!node) return;

  if (node.kind === "group") {
    withNodeTransform(context, node, () => {
      node.childrenIds.forEach((childId) => {
        renderNode(page, childId, context, images);
      });
    });
    return;
  }

  if (node.kind === "ellipse") {
    withNodeTransform(context, node, () => {
      renderEllipseNode(context, node);
    });
    return;
  }

  if (node.kind === "line") {
    withNodeTransform(context, node, () => {
      renderLineNode(context, node);
    });
    return;
  }

  if (node.kind === "polygon") {
    withNodeTransform(context, node, () => {
      renderRegularPolygonPath(context, node.width, node.height, node.sides);
      fillAndStrokeNode(context, node);
    });
    return;
  }

  if (node.kind === "star") {
    withNodeTransform(context, node, () => {
      renderStarPath(context, node);
      fillAndStrokeNode(context, node);
    });
    return;
  }

  if (node.kind === "text") {
    withNodeTransform(context, node, () => {
      context.fillStyle = node.fill ?? "#111827";
      context.font = `${node.fontWeight ?? 400} ${node.fontSize}px sans-serif`;
      context.textBaseline = "top";
      context.fillText(node.text, 0, 0);

      withStrokeStyle(context, node, () => {
        context.strokeText(node.text, 0, 0);
      });
    });
    return;
  }

  if (isImageNode(node)) {
    withNodeTransform(context, node, () => {
      const bitmap = images.get(node.src);

      if (bitmap) {
        context.drawImage(bitmap, 0, 0, node.width, node.height);
      } else {
        context.fillStyle = "#e5e7eb";
        context.fillRect(0, 0, node.width, node.height);
      }

      context.beginPath();
      context.rect(0, 0, node.width, node.height);
      strokeCurrentPath(context, node);
    });
    return;
  }

  withNodeTransform(context, node, () => {
    renderRoundRect(context, node.width, node.height, getCornerRadiusValues(node.cornerRadius));
    fillAndStrokeNode(context, node);
  });
};
