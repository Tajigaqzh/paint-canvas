// RichTextPlus 插件导出
export { RichTextPlus } from "./richTextPlus";
export { RichTextPlusEditor } from "./richTextPlusEditor";
export type {
  IRichTextInputData,
  ICharStyle,
  IStyleRange,
  IFontWeightString,
  IRichTextFontWeight,
} from "./types";
export type {
  IPathAnchor,
  IPathAnchorConfig,
  IPathAnchorMenuConfig,
  IPathBezierConfig,
  IPathPoint,
  ITextCursorConfig,
  ITextPathConfig,
  ITextPathAlign,
  ITextPathDirection,
  ITextPathData,
  ITextPathGenerator,
  ITextPathGeneratorContext,
  ITextPathMode,
  ITextPathSide,
} from "./types";
export { TextPathMode } from "./types";
export {
  createRegularPolygonPath,
  layoutGlyphsOnPath,
  normalizePolygonSides,
  pointAtPathDistance,
  resolveCirclePathStartAngle,
  sampleBezierPath,
  sampleCirclePath,
} from "./pathLayout";
export {
  FONT_WEIGHT_STRING_VALUES,
  resolveFontWeightForCanvas,
  numericFontWeightToNamed,
  fontWeightToPanelValue,
  graphemeSplit,
} from "./utils";

import { Plugin } from "leafer-ui";
Plugin.add("RichTextPlusEditor", "editor");

/**
 * 安装插件（注册内部编辑器）
 * 引入本包时已自动注册，仅需在未通过主入口引入时调用
 */
export function install(): void {
  Plugin.add("RichTextPlusEditor", "editor");
}
