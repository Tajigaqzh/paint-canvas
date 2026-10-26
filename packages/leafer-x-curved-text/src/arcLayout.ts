import { splitGraphemes } from "./graphemes";
import type { IFill, IFontWeight, IShadowEffect, IStroke } from "@leafer-ui/interface";

export type CurvedTextDirection = "clockwise" | "counterclockwise";
export type CurvedTextAlign = "start" | "center" | "end";

export type CurvedTextStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: IFontWeight;
  fontStyle?: string;
  fill?: IFill;
  stroke?: IStroke;
  strokeWidth?: number | number[];
  shadow?: string | IShadowEffect | IShadowEffect[];
  [key: string]: unknown;
};

export type CurvedTextStyleRun = {
  start: number;
  end: number;
  style: Partial<CurvedTextStyle>;
};

export type GraphemeMeasureRequest = {
  grapheme: string;
  index: number;
  style: CurvedTextStyle;
};

/** 宿主应按字素簇和最终字体样式返回 advance width，单位为画布局部坐标。 */
export type GraphemeMeasurer = (request: GraphemeMeasureRequest) => number;

export type ArcTextLayoutOptions = {
  bendAngle: number;
  direction?: CurvedTextDirection;
  radius: number;
  startAngle?: number;
  align?: CurvedTextAlign;
  letterSpacing?: number;
  defaultStyle?: CurvedTextStyle;
  styleRuns?: CurvedTextStyleRun[];
  locale?: string;
};

export type ArcGlyphLayout = {
  grapheme: string;
  index: number;
  x: number;
  y: number;
  rotation: number;
  angle: number;
  advance: number;
  style: CurvedTextStyle;
};

export type ArcTextLayoutResult = {
  glyphs: ArcGlyphLayout[];
  width: number;
  height: number;
  bendAngle: number;
  direction: CurvedTextDirection;
  radius: number;
};

const toFinite = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) ? value : fallback;

/** 将切线角度归一化，避免 Leafer 在 180/360 度边界把字符翻转到另一侧。 */
const normalizeRotation = (degrees: number) => {
  let rotation = degrees % 360;
  if (rotation > 180) rotation -= 360;
  if (rotation <= -180) rotation += 360;
  return rotation;
};

const getGlyphStyle = (
  index: number,
  defaultStyle: CurvedTextStyle,
  styleRuns: CurvedTextStyleRun[],
) =>
  styleRuns.reduce(
    (style, run) => (index >= run.start && index < run.end ? { ...style, ...run.style } : style),
    defaultStyle,
  );

/** 将字素簇按测量宽度比例排到圆弧上，返回以对象原点为中心的局部坐标。 */
export const layoutArcText = (
  text: string,
  options: ArcTextLayoutOptions,
  measureGrapheme: GraphemeMeasurer,
): ArcTextLayoutResult => {
  const graphemes = splitGraphemes(text, options.locale);
  const direction = options.direction ?? "clockwise";
  const bendAngle = Math.max(0, Math.min(360, toFinite(options.bendAngle, 0)));
  const radius = Math.max(0, toFinite(options.radius, 0));
  const startAngle = toFinite(options.startAngle, -90);
  const letterSpacing = toFinite(options.letterSpacing, 0);
  const defaultStyle = options.defaultStyle ?? {};
  const styleRuns = options.styleRuns ?? [];

  if (graphemes.length === 0 || bendAngle === 0 || radius === 0) {
    let cursor = 0;
    const glyphs = graphemes.map((grapheme, index) => {
      const style = getGlyphStyle(index, defaultStyle, styleRuns);
      const advance = Math.max(0, toFinite(measureGrapheme({ grapheme, index, style }), 0));
      const glyph = {
        advance,
        angle: 0,
        grapheme,
        index,
        rotation: 0,
        style,
        x: cursor + advance / 2,
        y: 0,
      };
      cursor += advance + letterSpacing;
      return glyph;
    });

    const width = Math.max(0, cursor - letterSpacing);

    return { bendAngle, direction, glyphs, height: 0, radius, width };
  }

  const sign = direction === "clockwise" ? 1 : -1;
  const requestedSweep = Math.abs((bendAngle * Math.PI) / 180);
  const advances = graphemes.map((grapheme, index) => {
    const style = getGlyphStyle(index, defaultStyle, styleRuns);
    return Math.max(0, toFinite(measureGrapheme({ grapheme, index, style }), 0));
  });
  const totalAdvance =
    advances.reduce((sum, advance) => sum + advance, 0) +
    Math.max(0, graphemes.length - 1) * letterSpacing;
  const safeTotalAdvance = totalAdvance || graphemes.length;
  // 半径决定单位字距对应的圆心角；bendAngle 作为最大弯曲范围约束，
  // 这样缩小半径会真实改变每个字素的切线角度，而不是只改变离圆心的距离。
  const minimumRadius = safeTotalAdvance / Math.max(requestedSweep, 1e-6);
  const layoutRadius = Math.max(radius, minimumRadius);
  const totalSweep = Math.min(requestedSweep, safeTotalAdvance / Math.max(layoutRadius, 1e-6));
  const align = options.align ?? "center";
  const alignOffset = align === "start" ? totalSweep / 2 : align === "end" ? -totalSweep / 2 : 0;
  const absoluteStart = (startAngle * Math.PI) / 180;
  let distance = 0;

  const glyphs = graphemes.map((grapheme, index) => {
    const advance = advances[index];
    const style = getGlyphStyle(index, defaultStyle, styleRuns);
    const centerDistance = distance + advance / 2;
    const angle = (centerDistance / safeTotalAdvance - 0.5) * totalSweep + alignOffset;
    const signedAngle = sign * angle;
    const theta = absoluteStart + signedAngle;
    const glyph = {
      advance,
      angle: (signedAngle * 180) / Math.PI,
      grapheme,
      index,
      // 字符基线沿圆弧切线排列。方向只决定弧线位置，保持文字阅读方向一致；
      // 这样修改字距、半径或方向后，所有字符都会重新按当前圆弧中心计算切线。
      rotation: normalizeRotation((theta * 180) / Math.PI + 90),
      style,
      x: layoutRadius * Math.cos(theta),
      y: layoutRadius * Math.sin(theta),
    };

    distance += advance + letterSpacing;
    return glyph;
  });

  // 对齐点属于业务对象原点，而不是圆心。这样调整半径时，start/center/end
  // 锚点保持不动，字符只在锚点周围改变弧线曲率。
  const anchorIndex = align === "start" ? 0 : align === "end" ? glyphs.length - 1 : -1;
  const anchorAngle =
    anchorIndex >= 0
      ? (startAngle * Math.PI) / 180 + sign * glyphs[anchorIndex].angle * (Math.PI / 180)
      : absoluteStart;
  const anchorX = layoutRadius * Math.cos(anchorAngle);
  const anchorY = layoutRadius * Math.sin(anchorAngle);
  glyphs.forEach((glyph) => {
    glyph.x -= anchorX;
    glyph.y -= anchorY;
  });

  const xs = glyphs.map(({ x }) => x);
  const ys = glyphs.map(({ y }) => y);

  return {
    bendAngle,
    direction,
    glyphs,
    height: Math.max(...ys) - Math.min(...ys),
    radius: layoutRadius,
    width: Math.max(...xs) - Math.min(...xs),
  };
};
