import type { CurvedTextStyle } from "./arcLayout";

export const getCanvasFont = (style: CurvedTextStyle) => {
  const fontStyle = style.fontStyle ?? "normal";
  const fontWeight = style.fontWeight ?? "normal";
  const fontSize = style.fontSize ?? 16;
  const fontFamily = style.fontFamily ?? "sans-serif";

  return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
};

export const createCanvasGraphemeMeasurer = (context?: CanvasRenderingContext2D) => {
  let canvasContext = context;

  return ({ grapheme, style }: { grapheme: string; style: CurvedTextStyle }) => {
    if (!canvasContext) {
      const canvas = globalThis.document?.createElement("canvas");
      canvasContext = canvas?.getContext("2d") ?? undefined;
    }

    if (!canvasContext) throw new Error("无法创建 Canvas 2D 测量上下文");

    canvasContext.font = getCanvasFont(style);
    return canvasContext.measureText(grapheme).width;
  };
};
