import { Group, Text } from "@leafer-ui/core";
import type { IText } from "@leafer-ui/interface";
import { layoutArcText, type CurvedTextStyle } from "./arcLayout";
import { splitGraphemes } from "./graphemes";
import { Emitter } from "./emitter";
import { createCanvasGraphemeMeasurer } from "./measureText";
import type {
  CharacterSelection,
  CurvedTextConfig,
  CurvedTextData,
  CurvedTextEvents,
  CurvedTextGlyphInput,
} from "./types";

const SELECTED_FILL = "#1677ff";

/** 以单个字素簇为子 Text 的 Leafer 弧形富文本对象。 */
export class CurvedText extends Group {
  readonly kind = "curvedText" as const;
  private textValue: string;
  private layoutValue: CurvedTextConfig["layout"];
  private defaultStyleValue: CurvedTextStyle;
  private styleRunsValue: NonNullable<CurvedTextConfig["styleRuns"]>;
  private measureGrapheme: NonNullable<CurvedTextConfig["measureGrapheme"]>;
  private glyphs: IText[] = [];
  private glyphIndexes = new WeakMap<object, number>();
  private selection: CharacterSelection | undefined;
  private dragStart: number | undefined;
  private destroyedValue = false;
  private characterEditingValue: boolean;
  private events = new Emitter<CurvedTextEvents>();

  constructor(config: CurvedTextConfig) {
    const {
      text,
      layout,
      defaultStyle = {},
      styleRuns = [],
      measureGrapheme,
      characterEditing = false,
      ...groupConfig
    } = config;
    super({ ...groupConfig, editable: true, tag: "curvedText" });
    this.textValue = text;
    this.layoutValue = { ...layout };
    this.defaultStyleValue = { ...defaultStyle };
    this.styleRunsValue = styleRuns.map((run) => ({ ...run, style: { ...run.style } }));
    this.measureGrapheme = measureGrapheme ?? createCanvasGraphemeMeasurer();
    this.characterEditingValue = characterEditing;
    this.renderGlyphs();
  }

  get text() {
    return this.textValue;
  }

  get characterSelection() {
    return this.selection ? { ...this.selection } : undefined;
  }

  get characterEditing() {
    return this.characterEditingValue;
  }

  set characterEditing(value: boolean) {
    this.characterEditingValue = value;
    if (!value) this.clearCharacterSelection();
  }

  setText(text: string) {
    if (this.textValue === text) return;
    this.textValue = text;
    this.clampSelection();
    this.renderGlyphs();
  }

  setLayout(layout: Partial<CurvedTextConfig["layout"]>) {
    this.layoutValue = { ...this.layoutValue, ...layout };
    this.renderGlyphs();
  }

  setStyles(
    defaultStyle: CurvedTextStyle,
    styleRuns: NonNullable<CurvedTextConfig["styleRuns"]> = [],
  ) {
    this.defaultStyleValue = { ...defaultStyle };
    this.styleRunsValue = styleRuns.map((run) => ({ ...run, style: { ...run.style } }));
    this.clampSelection();
    this.renderGlyphs();
  }

  setCharacterSelection(selection: CharacterSelection) {
    const count = this.glyphs.length;
    const start = Math.max(0, Math.min(count, Math.trunc(selection.start)));
    const end = Math.max(start, Math.min(count, Math.trunc(selection.end)));
    this.selection = { start, end };
    this.updateSelectionPaint();
    this.events.emit("character-selection-change", { ...this.selection });
  }

  clearCharacterSelection() {
    if (!this.selection) return;
    this.selection = undefined;
    this.updateSelectionPaint();
    if (!this.destroyedValue) this.events.emit("character-selection-change", { start: 0, end: 0 });
  }

  on<K extends keyof CurvedTextEvents>(type: K, listener: (event: CurvedTextEvents[K]) => void) {
    this.events.on(type, listener);
    return this;
  }

  off<K extends keyof CurvedTextEvents>(type: K, listener: (event: CurvedTextEvents[K]) => void) {
    this.events.off(type, listener);
    return this;
  }

  toJSON(options?: Parameters<Group["toJSON"]>[0]): CurvedTextData {
    return {
      ...super.toJSON(options),
      kind: "curvedText",
      text: this.textValue,
      layout: { ...this.layoutValue },
      defaultStyle: { ...this.defaultStyleValue },
      styleRuns: this.styleRunsValue.map((run) => ({ ...run, style: { ...run.style } })),
    } as CurvedTextData;
  }

  destroy(): void {
    if (this.destroyedValue) return;
    this.destroyedValue = true;
    this.clearCharacterSelection();
    this.glyphs = [];
    this.glyphIndexes = new WeakMap();
    this.dragStart = undefined;
    this.events.clearListeners();
    super.destroy();
  }

  private renderGlyphs() {
    const result = layoutArcText(
      this.textValue,
      { ...this.layoutValue, defaultStyle: this.defaultStyleValue, styleRuns: this.styleRunsValue },
      this.measureGrapheme,
    );
    this.removeAll();
    this.glyphIndexes = new WeakMap();
    this.glyphs = result.glyphs.map((glyph) => {
      const input = {
        ...glyph.style,
        align: "center",
        editable: false,
        draggable: false,
        fill: (glyph.style.fill as CurvedTextGlyphInput["fill"]) ?? "#111827",
        hittable: true,
        rotation: glyph.rotation,
        text: glyph.grapheme,
        verticalAlign: "middle",
        x: glyph.x,
        y: glyph.y,
      } as CurvedTextGlyphInput;
      const ui = new Text(input);
      this.glyphIndexes.set(ui, glyph.index);
      ui.on("pointer.down", this.handleGlyphPointerDown);
      ui.on("pointer.move", this.handleGlyphPointerMove);
      ui.on("pointer.up", this.handleGlyphPointerUp);
      ui.on("pointer.cancel", this.handleGlyphPointerUp);
      this.add(ui);
      return ui;
    });
    this.updateSelectionPaint();
  }

  private clampSelection() {
    if (!this.selection) return;
    const length = splitGraphemes(this.textValue, this.layoutValue.locale).length;
    this.selection = {
      start: Math.min(this.selection.start, length),
      end: Math.min(this.selection.end, length),
    };
    if (this.selection.start === this.selection.end) this.selection = undefined;
  }

  private updateSelectionPaint() {
    this.glyphs.forEach((glyph, index) => {
      const style = this.getStyleAt(index);
      glyph.set({
        fill: (this.selection && index >= this.selection.start && index < this.selection.end
          ? SELECTED_FILL
          : (style.fill ?? "#111827")) as CurvedTextGlyphInput["fill"],
        fontFamily: style.fontFamily ?? "sans-serif",
        fontSize: style.fontSize ?? 16,
        fontStyle: style.fontStyle ?? "normal",
        fontWeight: (style.fontWeight as CurvedTextGlyphInput["fontWeight"]) ?? "normal",
        shadow: style.shadow as CurvedTextGlyphInput["shadow"],
        stroke: style.stroke as CurvedTextGlyphInput["stroke"],
        strokeWidth: style.strokeWidth as CurvedTextGlyphInput["strokeWidth"],
      });
    });
  }

  private getStyleAt(index: number) {
    return this.styleRunsValue.reduce(
      (style, run) => (index >= run.start && index < run.end ? { ...style, ...run.style } : style),
      this.defaultStyleValue,
    );
  }

  private findGlyphIndex(event: unknown) {
    const target = event as { current?: object; target?: object };
    const glyph = target.current ?? target.target;
    return glyph ? this.glyphIndexes.get(glyph) : undefined;
  }

  private handleGlyphPointerDown = (event: unknown) => {
    if (!this.characterEditingValue) return;
    const index = this.findGlyphIndex(event);
    if (index === undefined) return;
    this.dragStart = index;
    this.setCharacterSelection({ start: index, end: index + 1 });
  };

  private handleGlyphPointerMove = (event: unknown) => {
    if (!this.characterEditingValue || this.dragStart === undefined) return;
    const index = this.findGlyphIndex(event);
    if (index === undefined) return;
    this.selection = {
      start: Math.min(this.dragStart, index),
      end: Math.max(this.dragStart, index) + 1,
    };
    this.updateSelectionPaint();
    this.events.emit("character-selection-change", { ...this.selection });
  };

  private handleGlyphPointerUp = () => {
    this.dragStart = undefined;
  };
}
