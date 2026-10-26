import type {
  IFill,
  IFontWeight,
  IGroupInputData,
  IShadowEffect,
  IStroke,
  ITextInputData,
} from "@leafer-ui/interface";
import type { ArcTextLayoutOptions, CurvedTextStyle, CurvedTextStyleRun } from "./arcLayout";

export type CurvedTextLayout = Omit<ArcTextLayoutOptions, "defaultStyle" | "styleRuns">;

export type CurvedTextConfig = Omit<IGroupInputData, "children"> & {
  text: string;
  layout: CurvedTextLayout;
  defaultStyle?: CurvedTextStyle;
  styleRuns?: CurvedTextStyleRun[];
  characterEditing?: boolean;
  /** 字符选区的临时高亮填充，不会写入业务序列化数据。 */
  selectionFill?: IFill;
  measureGrapheme?: (request: {
    grapheme: string;
    index: number;
    style: CurvedTextStyle;
  }) => number;
};

export type CurvedTextData = Omit<IGroupInputData, "children"> & {
  kind: "curvedText";
  text: string;
  layout: CurvedTextLayout;
  defaultStyle: CurvedTextStyle;
  styleRuns: CurvedTextStyleRun[];
};

export type CharacterSelection = { start: number; end: number };

export type CurvedTextEvents = {
  "character-selection-change": CharacterSelection;
};

export type CurvedTextGlyphInput = ITextInputData & {
  fill?: IFill;
  fontWeight?: IFontWeight;
  shadow?: string | IShadowEffect | IShadowEffect[];
  stroke?: IStroke;
  strokeWidth?: number | number[];
  rotation: number;
  x: number;
  y: number;
};
