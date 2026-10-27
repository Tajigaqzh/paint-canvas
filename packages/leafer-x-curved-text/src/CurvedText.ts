import { Group, Text } from "@leafer-ui/core";
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

const DEFAULT_SELECTION_FILL = "#1677ff";

/** 以单个字素簇为子 Text 的 Leafer 弧形富文本对象。 */
export class CurvedText extends Group {
  readonly kind = "curvedText" as const;
  private textValue: string;
  private layoutValue: CurvedTextConfig["layout"];
  private defaultStyleValue: CurvedTextStyle;
  private styleRunsValue: NonNullable<CurvedTextConfig["styleRuns"]>;
  private measureGrapheme: NonNullable<CurvedTextConfig["measureGrapheme"]>;
  private glyphs: Array<InstanceType<typeof Text>> = [];
  private glyphIndexes = new WeakMap<object, number>();
  private selection: CharacterSelection | undefined;
  private dragStart: number | undefined;
  private destroyedValue = false;
  private characterEditingValue: boolean;
  private selectionFillValue: CurvedTextGlyphInput["fill"];
  private events = new Emitter<CurvedTextEvents>();

  constructor(config: CurvedTextConfig) {
    const {
      text,
      layout,
      defaultStyle = {},
      styleRuns = [],
      measureGrapheme,
      characterEditing = false,
      selectionFill = DEFAULT_SELECTION_FILL,
      ...groupConfig
    } = config;
    super({ ...groupConfig, editable: true, tag: "curvedText" });
    this.textValue = text;
    this.layoutValue = { ...layout };
    this.defaultStyleValue = { ...defaultStyle };
    this.styleRunsValue = styleRuns.map((run) => ({ ...run, style: { ...run.style } }));
    this.clipStyleRuns();
    this.measureGrapheme = measureGrapheme ?? createCanvasGraphemeMeasurer();
    this.characterEditingValue = characterEditing;
    this.selectionFillValue = selectionFill;
    this.set({ draggable: !characterEditing, editable: !characterEditing });
    super.on("pointer.down", this.handleGroupPointerDown);
    super.on("pointer.move", this.handleGroupPointerMove);
    super.on("pointer.up", this.handleGlyphPointerUp);
    super.on("pointer.cancel", this.handleGlyphPointerUp);
    super.on("tap", this.handleGroupTap);
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
    // 内部字符编辑期间让指针只作用于字符，不让 Leafer Editor 拖动整个 Group。
    this.set({ draggable: !value, editable: !value });
    if (!value) this.clearCharacterSelection();
  }

  get selectionFill() {
    return this.selectionFillValue;
  }

  set selectionFill(value: CurvedTextGlyphInput["fill"]) {
    this.selectionFillValue = value;
    this.updateSelectionPaint();
  }

  setText(text: string) {
    if (this.textValue === text) return;
    this.textValue = text;
    this.clipStyleRuns();
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
    this.clipStyleRuns();
    this.clampSelection();
    this.renderGlyphs();
  }

  /** 将样式应用到当前选区；没有选区时更新整体默认样式。 */
  setCharacterStyle(style: Partial<CurvedTextStyle>) {
    if (!this.selection || this.selection.start === this.selection.end) {
      this.defaultStyleValue = { ...this.defaultStyleValue, ...style };
    } else {
      const { start, end } = this.selection;
      this.styleRunsValue = this.applyStyleRun(start, end, style);
    }
    this.renderGlyphs();
    return this;
  }

  /** `setCharacterStyle` 的语义别名，便于宿主工具栏按操作命名调用。 */
  applyStyleToSelection(style: Partial<CurvedTextStyle>) {
    return this.setCharacterStyle(style);
  }

  selectAll() {
    this.setCharacterSelection({ start: 0, end: this.glyphs.length });
    return this;
  }

  get defaultStyle() {
    return { ...this.defaultStyleValue };
  }

  get styleRuns() {
    return this.styleRunsValue.map((run) => ({ ...run, style: { ...run.style } }));
  }

  getCharacterStyle(index: number) {
    const count = splitGraphemes(this.textValue, this.layoutValue.locale).length;
    const normalizedIndex = Math.trunc(index);
    if (normalizedIndex < 0 || normalizedIndex >= count) return undefined;
    return { ...this.defaultStyleValue, ...this.getStyleAt(normalizedIndex) };
  }

  get layout() {
    return { ...this.layoutValue };
  }

  setCharacterSelection(selection: CharacterSelection) {
    const count = this.glyphs.length;
    const start = Math.max(0, Math.min(count, Math.trunc(selection.start)));
    const end = Math.max(start, Math.min(count, Math.trunc(selection.end)));
    if (start === end) {
      this.clearCharacterSelection();
      return;
    }
    this.selection = { start, end };
    this.updateSelectionPaint();
    this.events.emit("character-selection-change", { ...this.selection });
  }

  clearCharacterSelection() {
    if (!this.selection) return;
    this.selection = undefined;
    this.updateSelectionPaint();
    this.events.emit("character-selection-change", { start: 0, end: 0 });
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
    const groupData = { ...super.toJSON(options) } as Record<string, unknown>;
    delete groupData.children;
    return {
      ...groupData,
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
      const input: CurvedTextGlyphInput = {
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
      };
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
          ? this.selectionFillValue
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
    // 在 Group 冒泡阶段 current 是外层 Group，优先使用真正命中的 target。
    const glyph = target.target ?? target.current;
    return glyph ? this.glyphIndexes.get(glyph) : undefined;
  }

  private handleGlyphPointerDown = (event: unknown) => {
    if (!this.characterEditingValue) return;
    this.stopPointerPropagation(event);
    this.capturePointer(event);
    const index = this.findGlyphIndex(event);
    if (index === undefined) return;
    this.dragStart = index;
    this.setCharacterSelection({ start: index, end: index + 1 });
  };

  private handleGlyphPointerMove = (event: unknown) => {
    if (!this.characterEditingValue || this.dragStart === undefined) return;
    this.stopPointerPropagation(event);
    const index = this.findGlyphIndex(event);
    if (index === undefined) return;
    const nextSelection = {
      start: Math.min(this.dragStart, index),
      end: Math.max(this.dragStart, index) + 1,
    };
    this.setCharacterSelection(nextSelection);
  };

  private handleGlyphPointerUp = () => {
    this.dragStart = undefined;
  };

  private handleGroupPointerDown = (event: unknown) => {
    if (!this.characterEditingValue) return;
    this.stopPointerPropagation(event);
    this.capturePointer(event);
    const index = this.findGlyphIndex(event) ?? this.findNearestGlyphIndex(event);
    if (index === undefined) return;
    this.dragStart = index;
    this.setCharacterSelection({ start: index, end: index + 1 });
  };

  private handleGroupTap = (event: unknown) => {
    if (!this.characterEditingValue) return;
    // 字符编辑模式下 tap 也归内部编辑器处理，避免宿主 Editor 重新选中/拖动外层节点。
    this.stopPointerPropagation(event);
  };

  private handleGroupPointerMove = (event: unknown) => {
    if (!this.characterEditingValue || this.dragStart === undefined) return;
    this.stopPointerPropagation(event);
    const index = this.findGlyphIndex(event) ?? this.findNearestGlyphIndex(event);
    if (index === undefined) return;
    this.setCharacterSelection({
      start: Math.min(this.dragStart, index),
      end: Math.max(this.dragStart, index) + 1,
    });
  };

  private findNearestGlyphIndex(event: unknown) {
    const point = event as { x?: number; y?: number; point?: { x?: number; y?: number } };
    const x = point.x ?? point.point?.x;
    const y = point.y ?? point.point?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y) || this.glyphs.length === 0) return undefined;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    this.glyphs.forEach((glyph, index) => {
      const dx = (glyph.x ?? 0) - x!;
      const dy = (glyph.y ?? 0) - y!;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }

  private stopPointerPropagation(event: unknown) {
    const pointerEvent = event as {
      stop?: () => void;
      stopPropagation?: () => void;
      origin?: {
        preventDefault?: () => void;
        stopImmediatePropagation?: () => void;
        stopPropagation?: () => void;
      };
    };
    pointerEvent.stop?.();
    pointerEvent.stopPropagation?.();
    pointerEvent.origin?.preventDefault?.();
    pointerEvent.origin?.stopImmediatePropagation?.();
    pointerEvent.origin?.stopPropagation?.();
  }

  private capturePointer(event: unknown) {
    const pointerEvent = event as {
      capture?: () => void;
      setPointerCapture?: (pointerId: number) => void;
      pointerId?: number;
      origin?: {
        capture?: () => void;
        setPointerCapture?: (pointerId: number) => void;
        pointerId?: number;
      };
    };
    pointerEvent.capture?.();
    const pointerId = pointerEvent.pointerId ?? pointerEvent.origin?.pointerId;
    if (pointerId === undefined) return;
    pointerEvent.setPointerCapture?.(pointerId);
    pointerEvent.origin?.setPointerCapture?.(pointerId);
  }

  private clipStyleRuns() {
    const length = splitGraphemes(this.textValue, this.layoutValue.locale).length;
    this.styleRunsValue = this.styleRunsValue
      .map((run) => ({
        ...run,
        start: Math.max(0, Math.min(length, Math.trunc(run.start))),
        end: Math.max(0, Math.min(length, Math.trunc(run.end))),
        style: { ...run.style },
      }))
      .filter((run) => run.end > run.start);
  }

  private applyStyleRun(start: number, end: number, style: Partial<CurvedTextStyle>) {
    const boundaries = new Set([start, end]);
    this.styleRunsValue.forEach((run) => {
      if (run.end > start && run.start < end) {
        boundaries.add(Math.max(start, run.start));
        boundaries.add(Math.min(end, run.end));
      }
    });
    const points = [...boundaries].sort((a, b) => a - b);
    const next: NonNullable<CurvedTextConfig["styleRuns"]> = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const segmentStart = points[index];
      const segmentEnd = points[index + 1];
      if (segmentEnd <= segmentStart) continue;
      const existing = this.getStyleOverrideAt(segmentStart);
      next.push({ start: segmentStart, end: segmentEnd, style: { ...existing, ...style } });
    }
    this.styleRunsValue.forEach((run) => {
      if (run.end <= start || run.start >= end) next.push({ ...run, style: { ...run.style } });
    });
    return next
      .sort((a, b) => a.start - b.start)
      .map((run) => ({ ...run, style: { ...run.style } }));
  }

  private getStyleOverrideAt(index: number) {
    return this.styleRunsValue.reduce(
      (style, run) => (index >= run.start && index < run.end ? { ...style, ...run.style } : style),
      {} as CurvedTextStyle,
    );
  }
}
