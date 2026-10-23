import { splitGraphemes } from "./graphemes";

export type CurvedTextDirection = "clockwise" | "counterclockwise";
export type CurvedTextAlign = "start" | "center" | "end";

export type CurvedTextStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: string;
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
  const totalSweep = Math.abs((bendAngle * Math.PI) / 180);
  const advances = graphemes.map((grapheme, index) => {
    const style = getGlyphStyle(index, defaultStyle, styleRuns);
    return Math.max(0, toFinite(measureGrapheme({ grapheme, index, style }), 0));
  });
  const totalAdvance =
    advances.reduce((sum, advance) => sum + advance, 0) +
    Math.max(0, graphemes.length - 1) * letterSpacing;
  const safeTotalAdvance = totalAdvance || graphemes.length;
  const align = options.align ?? "center";
  const alignOffset = align === "start" ? totalSweep / 2 : align === "end" ? -totalSweep / 2 : 0;
  let distance = 0;

  const glyphs = graphemes.map((grapheme, index) => {
    const advance = advances[index];
    const style = getGlyphStyle(index, defaultStyle, styleRuns);
    const centerDistance = distance + advance / 2;
    const angle = (centerDistance / safeTotalAdvance - 0.5) * totalSweep + alignOffset;
    const signedAngle = sign * angle;
    const absoluteStart = (startAngle * Math.PI) / 180;
    const theta = absoluteStart + signedAngle;
    const glyph = {
      advance,
      angle: (signedAngle * 180) / Math.PI,
      grapheme,
      index,
      rotation: (theta * 180) / Math.PI + sign * 90,
      style,
      x: radius * Math.cos(theta),
      y: radius * Math.sin(theta),
    };

    distance += advance + letterSpacing;
    return glyph;
  });

  const xs = glyphs.map(({ x }) => x);
  const ys = glyphs.map(({ y }) => y);

  return {
    bendAngle,
    direction,
    glyphs,
    height: Math.max(...ys) - Math.min(...ys),
    radius,
    width: Math.max(...xs) - Math.min(...xs),
  };
};
