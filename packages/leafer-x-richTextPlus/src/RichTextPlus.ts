// RichTextPlus 主类 - 继承 UI，完全自定义
import type {
  IAxis,
  IFill,
  ILeaferCanvas,
  IOverflow,
  IStroke,
  ITextAlign,
  ITextCase,
  ITextDecoration,
  ITextWrap,
  IUnitData,
  IVerticalAlign,
} from "leafer-ui";
import { boundsType, dataProcessor, dataType, registerUI, surfaceType, UI } from "leafer-ui";
import { RichTextData } from "./richTextData";
import type {
  ICharMetrics,
  ICharStyle,
  ICursorLocation,
  ILineMetrics,
  IPathAnchor,
  IPathAnchorConfig,
  IPathBezierConfig,
  ITextCursorConfig,
  ITextPathConfig,
  IRichTextInputData,
  IStyleRange,
  ITextPathAlign,
  ITextPathData,
  ITextPathDirection,
  ITextPathGenerator,
  ITextPathMode,
  ITextPathSide,
  StyleMap,
} from "./types";
import { TextPathMode } from "./types";
import { RE_CJK, RE_PUNCTUATION, RE_WORD_BOUNDARY, RICHTEXT_DEFAULTS } from "./constants";
import { buildFontString, graphemeSplit, isLeaferAfterChar, measureTextWidth } from "./utils";
import { EditingManager } from "./editingManager";
import {
  getPathBounds,
  getPathCaret,
  createRegularPolygonPath,
  type IPathGlyphLayout,
  layoutGlyphsOnPath,
  movePathAnchor,
  normalizePolygonSides,
  resolveCirclePathStartAngle,
  sampleBezierPath,
  sampleCirclePath,
} from "./pathLayout";

/** 撤销栈快照 */
interface IRichTextSnapshot {
  text: string;
  styles: StyleMap;
  selection: [number, number];
  time: number;
  /** 'input' 表示由连续键入产生，可与后续键入合并 */
  kind: "input" | "other";
}

/** 撤销栈上限，避免长时间编辑内存无界增长 */
const UNDO_STACK_LIMIT = 200;
/** 连续输入合并窗口（ms） */
const UNDO_COALESCE_MS = 600;
const PATH_APPEARANCE_KEYS = [
  "cursorColor",
  "cursorWidth",
  "textPath",
  "pathRadius",
  "pathSides",
  "pathStartAngle",
  "pathDirection",
  "pathSide",
  "pathAlign",
  "pathClosed",
  "pathAnchors",
  "pathEditing",
  "pathGuideColor",
  "pathGuideWidth",
  "pathAnchorFill",
  "pathAnchorStroke",
  "pathAnchorActiveFill",
  "pathAnchorRadius",
  "pathAnchorLineWidth",
  "pathHandleFill",
  "pathHandleStroke",
  "pathHandleSize",
  "pathHandleLineWidth",
  "pathAnchorMenuEnabled",
  "pathAnchorMenuBackground",
  "pathAnchorMenuColor",
  "pathAnchorMenuDeleteColor",
  "pathAnchorMenuBorderColor",
  "pathAnchorMenuBorderRadius",
  "pathAnchorMenuFontSize",
  "pathAnchorMenuPadding",
  "pathAnchorMenuShadow",
] as const;

const PATH_CONFIG_FIELDS = {
  textCursor: { color: "cursorColor", width: "cursorWidth" },
  textPath: {
    mode: "textPath",
    radius: "pathRadius",
    sideCount: "pathSides",
    startAngle: "pathStartAngle",
    direction: "pathDirection",
    side: "pathSide",
    align: "pathAlign",
    closed: "pathClosed",
    anchors: "pathAnchors",
    editing: "pathEditing",
  },
  bezier: {
    guideColor: "pathGuideColor",
    guideWidth: "pathGuideWidth",
    handleFill: "pathHandleFill",
    handleStroke: "pathHandleStroke",
    handleSize: "pathHandleSize",
    handleLineWidth: "pathHandleLineWidth",
  },
  anchor: {
    fill: "pathAnchorFill",
    activeFill: "pathAnchorActiveFill",
    stroke: "pathAnchorStroke",
    radius: "pathAnchorRadius",
    lineWidth: "pathAnchorLineWidth",
  },
  menu: {
    enabled: "pathAnchorMenuEnabled",
    background: "pathAnchorMenuBackground",
    color: "pathAnchorMenuColor",
    deleteColor: "pathAnchorMenuDeleteColor",
    borderColor: "pathAnchorMenuBorderColor",
    borderRadius: "pathAnchorMenuBorderRadius",
    fontSize: "pathAnchorMenuFontSize",
    padding: "pathAnchorMenuPadding",
    shadow: "pathAnchorMenuShadow",
  },
} as const;

const flattenPathConfig = (data: any): Record<string, unknown> => {
  if (!data || typeof data !== "object") return {};
  const flattened: Record<string, unknown> = {};
  const assign = (source: any, fields: Record<string, string>) => {
    if (!source) return;
    Object.entries(fields).forEach(([key, field]) => {
      if (source[key] !== undefined) flattened[field] = source[key];
    });
  };
  assign(data.textCursor, PATH_CONFIG_FIELDS.textCursor);
  assign(data.textPath, PATH_CONFIG_FIELDS.textPath);
  assign(data.bezier, PATH_CONFIG_FIELDS.bezier);
  assign(data.anchor, PATH_CONFIG_FIELDS.anchor);
  assign(data.anchor?.menu, PATH_CONFIG_FIELDS.menu);
  return flattened;
};

const expandPathConfig = (data: any): Record<string, unknown> => {
  if (!data || typeof data !== "object") return {};
  if (!data.textPath || typeof data.textPath !== "object" || data.textPath.sideCount === undefined)
    return data;
  return {
    ...data,
    textPath: { ...data.textPath, sideCount: normalizePolygonSides(data.textPath.sideCount) },
  };
};

/** 稳定序列化（对象 key 排序），用于样式比较 */
function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${key}:${stableStringify(value[key])}`).join(",")}}`;
}

/** setFullTextStyles 中已同步到元素级属性的 key（字符级覆盖需要清除） */
const ELEMENT_MIRRORED_STYLE_KEYS = new Set([
  "fontSize",
  "fontFamily",
  "fontWeight",
  "fill",
  "stroke",
  "strokeWidth",
  "strokeAlign",
  "strokeWidthFixed",
  "strokeCap",
  "strokeJoin",
  "dashPattern",
  "dashOffset",
  "shadow",
  "innerShadow",
  "italic",
  "textCase",
  "textDecoration",
  "letterSpacing",
]);

@registerUI()
export class RichTextPlus extends UI {
  public get __tag() {
    return "RichTextPlus";
  }

  @dataProcessor(RichTextData)
  declare public __: any; // 使用 any 避免类型冲突（letterSpacing/lineHeight 支持 IUnitData）

  // ============ 数据属性（响应式）============

  // 文本内容，支持换行。
  @boundsType("")
  declare public text: string;

  // 默认字号，单位为业务坐标像素；可被字符级样式覆盖。
  @boundsType(RICHTEXT_DEFAULTS.fontSize)
  declare public fontSize: number;

  // 默认字体族，按 CSS font-family 格式填写。
  @boundsType(RICHTEXT_DEFAULTS.fontFamily)
  declare public fontFamily: string;

  // 默认字重，兼容 Leafer 字重数值和常用字重名称。
  @boundsType(RICHTEXT_DEFAULTS.fontWeight)
  declare public fontWeight: any;

  // 默认文字填充，可使用纯色或 Leafer 支持的填充。
  @surfaceType(RICHTEXT_DEFAULTS.fill)
  declare public fill: IFill;

  // 默认文字描边，可使用纯色或 Leafer 支持的描边。
  @surfaceType(RICHTEXT_DEFAULTS.stroke)
  declare public stroke: IStroke;

  // 默认文字描边宽度，单位为业务坐标像素。
  @boundsType(RICHTEXT_DEFAULTS.strokeWidth)
  declare public strokeWidth: number;

  // 默认描边相对字形轮廓的位置。
  @boundsType(RICHTEXT_DEFAULTS.strokeAlign)
  declare public strokeAlign: "inside" | "center" | "outside";

  // 默认描边端点形状。
  @boundsType(RICHTEXT_DEFAULTS.strokeCap)
  declare public strokeCap: "none" | "round" | "square";

  // 默认描边拐角连接形状。
  @boundsType(RICHTEXT_DEFAULTS.strokeJoin)
  declare public strokeJoin: "miter" | "bevel" | "round";

  // 默认描边虚线间隔；undefined 表示实线。
  @boundsType(RICHTEXT_DEFAULTS.dashPattern)
  declare public dashPattern: number[] | undefined;

  // 默认虚线起始偏移，单位为业务坐标像素。
  @boundsType(RICHTEXT_DEFAULTS.dashOffset)
  declare public dashOffset: number;

  // 默认外阴影效果。
  @surfaceType(RICHTEXT_DEFAULTS.shadow)
  declare public shadow: any;

  // 默认内阴影效果。
  @surfaceType(RICHTEXT_DEFAULTS.innerShadow)
  declare public innerShadow: any;

  // 默认是否使用斜体。
  @boundsType(RICHTEXT_DEFAULTS.italic)
  declare public italic: boolean;

  // 默认大小写转换方式。
  @surfaceType(RICHTEXT_DEFAULTS.textCase)
  declare public textCase: ITextCase;

  // 默认文字装饰，如下划线或删除线。
  @surfaceType(RICHTEXT_DEFAULTS.textDecoration)
  declare public textDecoration: ITextDecoration;

  // 默认字符间距，支持数值或 Leafer 单位对象。
  @boundsType(RICHTEXT_DEFAULTS.letterSpacing)
  declare public letterSpacing: number | IUnitData;

  // 默认行高，支持数值或 Leafer 单位对象。
  @boundsType(RICHTEXT_DEFAULTS.lineHeight)
  declare public lineHeight: number | IUnitData;

  // 默认自动换行策略。
  @boundsType(RICHTEXT_DEFAULTS.textWrap)
  declare public textWrap: ITextWrap;

  // 默认文本溢出处理方式。
  @boundsType(RICHTEXT_DEFAULTS.textOverflow)
  declare public textOverflow: IOverflow | string;

  // 段首缩进，单位为业务坐标像素。
  @boundsType(RICHTEXT_DEFAULTS.paraIndent)
  declare public paraIndent: number;

  // 段落之间的额外间距，单位为业务坐标像素。
  @boundsType(RICHTEXT_DEFAULTS.paraSpacing)
  declare public paraSpacing: number;

  // 默认水平对齐方式。
  @boundsType(RICHTEXT_DEFAULTS.textAlign)
  declare public textAlign: ITextAlign;

  // 固定高度文本框中的默认垂直对齐方式。
  @boundsType(RICHTEXT_DEFAULTS.verticalAlign)
  declare public verticalAlign: IVerticalAlign;

  // 自动调整尺寸时是否根据对齐方式补偿文字位置。
  @dataType(RICHTEXT_DEFAULTS.autoSizeAlign)
  declare public autoSizeAlign: boolean;

  // 文本内边距，顺序和单位遵循 Leafer padding 约定。
  @boundsType(RICHTEXT_DEFAULTS.padding)
  declare public padding: number | number[];

  // 路径、光标和控制点设置通过分组对象暴露。
  @boundsType({})
  declare public textPath: ITextPathConfig;

  // 光标配置
  @boundsType({})
  declare public textCursor: ITextCursorConfig;

  // 贝塞尔曲线配置
  @boundsType({})
  declare public bezier: IPathBezierConfig;

  // 路径控制点配置
  @boundsType({})
  declare public anchor: IPathAnchorConfig;

  // 固定文本框宽度；autoWidth 为 true 时由内容决定。
  @boundsType(0)
  declare public width: number;

  // 固定文本框高度；autoHeight 为 true 时由内容决定。
  @boundsType(0)
  declare public height: number;

  // 是否根据文本内容自动计算宽度。
  @boundsType(RICHTEXT_DEFAULTS.autoWidth)
  declare public autoWidth: boolean;

  // 是否根据文本内容自动计算高度。
  @boundsType(RICHTEXT_DEFAULTS.autoHeight)
  declare public autoHeight: boolean;

  // 是否允许进入文本编辑模式。
  @boundsType(true)
  declare public editable: boolean;

  // 文本选区背景颜色。
  @surfaceType(RICHTEXT_DEFAULTS.selectionColor)
  declare public selectionColor: string;

  // 内部绘制算法沿用短访问器，实际存储统一落在四个分组属性中。
  // 路径模式
  private get _pathMode(): ITextPathMode {
    return this.textPath?.mode ?? TextPathMode.None;
  }
  private set _pathMode(value: ITextPathMode) {
    this.textPath = { ...this.textPath, mode: value };
  }

  // 路径半径
  private get pathRadius(): number {
    return this.textPath?.radius ?? 120;
  }
  private set pathRadius(value: number) {
    this.textPath = { ...this.textPath, radius: value };
  }
  // 路径边数
  private get pathSides(): number {
    return normalizePolygonSides(this.textPath?.sideCount ?? 3);
  }

  // 路径起始角度
  private get pathStartAngle(): number {
    return this.textPath?.startAngle ?? -90;
  }
  private set pathStartAngle(value: number) {
    this.textPath = { ...this.textPath, startAngle: value };
  }
  private get pathDirection(): ITextPathDirection {
    return this.textPath?.direction ?? "forward";
  }
  private set pathDirection(value: ITextPathDirection) {
    this.textPath = { ...this.textPath, direction: value };
  }
  private get pathSide(): ITextPathSide {
    return this.textPath?.side ?? "outer";
  }
  private set pathSide(value: ITextPathSide) {
    this.textPath = { ...this.textPath, side: value };
  }
  private get pathAlign(): ITextPathAlign {
    return this.textPath?.align ?? "center";
  }
  private set pathAlign(value: ITextPathAlign) {
    this.textPath = { ...this.textPath, align: value };
  }
  private get pathClosed(): boolean {
    return this.textPath?.closed ?? false;
  }
  private set pathClosed(value: boolean) {
    this.textPath = { ...this.textPath, closed: value };
  }
  private get pathAnchors(): IPathAnchor[] {
    return this.textPath?.anchors ?? [];
  }
  private set pathAnchors(value: IPathAnchor[]) {
    this.textPath = { ...this.textPath, anchors: value };
  }
  private get pathEditing(): boolean {
    return this.textPath?.editing ?? false;
  }
  private set pathEditing(value: boolean) {
    this.textPath = { ...this.textPath, editing: value };
  }
  private _pathGenerator?: ITextPathGenerator;
  private get cursorColor(): string {
    return this.textCursor?.color ?? RICHTEXT_DEFAULTS.cursorColor;
  }
  private set cursorColor(value: string) {
    this.textCursor = { ...this.textCursor, color: value };
  }
  private get cursorWidth(): number {
    return this.textCursor?.width ?? RICHTEXT_DEFAULTS.cursorWidth;
  }
  private set cursorWidth(value: number) {
    this.textCursor = { ...this.textCursor, width: value };
  }
  private get pathGuideColor(): string {
    return this.bezier?.guideColor ?? RICHTEXT_DEFAULTS.pathGuideColor;
  }
  private set pathGuideColor(value: string) {
    this.bezier = { ...this.bezier, guideColor: value };
  }
  private get pathGuideWidth(): number {
    return this.bezier?.guideWidth ?? RICHTEXT_DEFAULTS.pathGuideWidth;
  }
  private set pathGuideWidth(value: number) {
    this.bezier = { ...this.bezier, guideWidth: value };
  }
  private get pathHandleFill(): string {
    return this.bezier?.handleFill ?? RICHTEXT_DEFAULTS.pathHandleFill;
  }
  private set pathHandleFill(value: string) {
    this.bezier = { ...this.bezier, handleFill: value };
  }
  private get pathHandleStroke(): string {
    return this.bezier?.handleStroke ?? RICHTEXT_DEFAULTS.pathHandleStroke;
  }
  private set pathHandleStroke(value: string) {
    this.bezier = { ...this.bezier, handleStroke: value };
  }
  private get pathHandleSize(): number {
    return this.bezier?.handleSize ?? RICHTEXT_DEFAULTS.pathHandleSize;
  }
  private set pathHandleSize(value: number) {
    this.bezier = { ...this.bezier, handleSize: value };
  }
  private get pathHandleLineWidth(): number {
    return this.bezier?.handleLineWidth ?? RICHTEXT_DEFAULTS.pathHandleLineWidth;
  }
  private set pathHandleLineWidth(value: number) {
    this.bezier = { ...this.bezier, handleLineWidth: value };
  }
  private get pathAnchorFill(): string {
    return this.anchor?.fill ?? RICHTEXT_DEFAULTS.pathAnchorFill;
  }
  private set pathAnchorFill(value: string) {
    this.anchor = { ...this.anchor, fill: value };
  }
  private get pathAnchorActiveFill(): string {
    return this.anchor?.activeFill ?? RICHTEXT_DEFAULTS.pathAnchorActiveFill;
  }
  private set pathAnchorActiveFill(value: string) {
    this.anchor = { ...this.anchor, activeFill: value };
  }
  private get pathAnchorStroke(): string {
    return this.anchor?.stroke ?? RICHTEXT_DEFAULTS.pathAnchorStroke;
  }
  private set pathAnchorStroke(value: string) {
    this.anchor = { ...this.anchor, stroke: value };
  }
  private get pathAnchorRadius(): number {
    return this.anchor?.radius ?? RICHTEXT_DEFAULTS.pathAnchorRadius;
  }
  private set pathAnchorRadius(value: number) {
    this.anchor = { ...this.anchor, radius: value };
  }
  private get pathAnchorLineWidth(): number {
    return this.anchor?.lineWidth ?? RICHTEXT_DEFAULTS.pathAnchorLineWidth;
  }
  private set pathAnchorLineWidth(value: number) {
    this.anchor = { ...this.anchor, lineWidth: value };
  }
  private get pathAnchorMenuEnabled(): boolean {
    return this.anchor?.menu?.enabled ?? RICHTEXT_DEFAULTS.pathAnchorMenuEnabled;
  }
  private set pathAnchorMenuEnabled(value: boolean) {
    this.anchor = { ...this.anchor, menu: { ...this.anchor?.menu, enabled: value } };
  }
  private get pathAnchorMenuBackground(): string {
    return this.anchor?.menu?.background ?? RICHTEXT_DEFAULTS.pathAnchorMenuBackground;
  }
  private set pathAnchorMenuBackground(value: string) {
    this.anchor = { ...this.anchor, menu: { ...this.anchor?.menu, background: value } };
  }
  private get pathAnchorMenuColor(): string {
    return this.anchor?.menu?.color ?? RICHTEXT_DEFAULTS.pathAnchorMenuColor;
  }
  private set pathAnchorMenuColor(value: string) {
    this.anchor = { ...this.anchor, menu: { ...this.anchor?.menu, color: value } };
  }
  private get pathAnchorMenuDeleteColor(): string {
    return this.anchor?.menu?.deleteColor ?? RICHTEXT_DEFAULTS.pathAnchorMenuDeleteColor;
  }
  private set pathAnchorMenuDeleteColor(value: string) {
    this.anchor = { ...this.anchor, menu: { ...this.anchor?.menu, deleteColor: value } };
  }
  private get pathAnchorMenuBorderColor(): string {
    return this.anchor?.menu?.borderColor ?? RICHTEXT_DEFAULTS.pathAnchorMenuBorderColor;
  }
  private set pathAnchorMenuBorderColor(value: string) {
    this.anchor = { ...this.anchor, menu: { ...this.anchor?.menu, borderColor: value } };
  }
  private get pathAnchorMenuBorderRadius(): number {
    return this.anchor?.menu?.borderRadius ?? RICHTEXT_DEFAULTS.pathAnchorMenuBorderRadius;
  }
  private set pathAnchorMenuBorderRadius(value: number) {
    this.anchor = { ...this.anchor, menu: { ...this.anchor?.menu, borderRadius: value } };
  }
  private get pathAnchorMenuFontSize(): number {
    return this.anchor?.menu?.fontSize ?? RICHTEXT_DEFAULTS.pathAnchorMenuFontSize;
  }
  private set pathAnchorMenuFontSize(value: number) {
    this.anchor = { ...this.anchor, menu: { ...this.anchor?.menu, fontSize: value } };
  }
  private get pathAnchorMenuPadding(): string {
    return this.anchor?.menu?.padding ?? RICHTEXT_DEFAULTS.pathAnchorMenuPadding;
  }
  private set pathAnchorMenuPadding(value: string) {
    this.anchor = { ...this.anchor, menu: { ...this.anchor?.menu, padding: value } };
  }
  private get pathAnchorMenuShadow(): string {
    return this.anchor?.menu?.shadow ?? RICHTEXT_DEFAULTS.pathAnchorMenuShadow;
  }
  private set pathAnchorMenuShadow(value: string) {
    this.anchor = { ...this.anchor, menu: { ...this.anchor?.menu, shadow: value } };
  }

  // 字符级样式（用于导入/导出 JSON），set 时触发更新以保持响应式
  public get styles(): any {
    return this._serializeStyles();
  }

  public set styles(value: any) {
    if (value) {
      this._deserializeStyles(value);
      this.__layout.boxChanged || this.__layout.boxChange();
      this.forceUpdate();
      this.forceRender();
    }
  }

  // 编辑状态
  public isEditing = false;
  public selectionStart = 0;
  public selectionEnd = 0;

  // 回调函数
  public onEditingEntered?: () => void;
  public onEditingExited?: () => void;
  public onSelectionChange?: (selection: { start: number; end: number } | undefined) => void;
  public onPathChange?: (path: ITextPathData) => void;

  // 内部数据
  private _graphemes: string[] = []; // 字符数组
  private _lines: string[][] = []; // 行数组
  private _lineMetrics: ILineMetrics[] = []; // 行度量
  private _styles: StyleMap = new Map(); // 样式映射
  private _hiddenTextarea: HTMLTextAreaElement | null = null; // 隐藏文本区域
  private _cursorOpacity = 1; // 光标透明度
  private _cursorTimer: number | null = null; // 光标定时器
  private _inComposition = false; // 是否处于组合输入中
  private _compositionSnapshotRecorded = false; // 组合输入快照是否已记录
  private _paragraphEndLines: Set<number> = new Set(); // 段落结束行集合
  private _lineHasNewline: boolean[] = []; // 行是否包含换行符
  private _paragraphNewlineFlags: boolean[] = []; // 段落换行标志
  private _measureCanvas: HTMLCanvasElement; // 测量 canvas
  private _measureCtx: CanvasRenderingContext2D; // 测量 canvas 上下文
  private _lastScaleSignX = 1; // 最后一次缩放符号 X
  private _lastScaleSignY = 1; // 最后一次缩放符号 Y
  private _needsFlipRenderBounds = false; // 是否需要翻转渲染边界
  private _lastWorldRenderBounds: { x: number; y: number; width: number; height: number } | null =
    null; // 最后一次世界渲染边界
  private _shadowCanvas: HTMLCanvasElement | null = null; // 阴影 canvas
  private _shadowCtx: CanvasRenderingContext2D | null = null; // 阴影 canvas 上下文

  // 选区锚点（用于 Shift 扩展选区）
  private _selectionAnchor: number | null = null; // 选区锚点
  private _isMouseDown = false; // 是否鼠标按下

  /** 光标亲和性：true 表示光标停在软换行行尾而不是下一行行首 */
  private _caretUpstream = false; // 光标亲和性：true 表示光标停在软换行行尾而不是下一行行首
  /** 上下移动时记忆的目标 x（列），避免经过短行后列位丢失 */
  private _goalX: number | null = null; // 目标 x 值

  // 记录双击位置（用于 Editor 触发 enterEditing 时定位光标）
  private _pendingCursorPosition: number | null = null;

  // Undo/Redo
  private _undoStack: IRichTextSnapshot[] = [];
  private _redoStack: IRichTextSnapshot[] = [];

  // 待应用的线性样式（文本变化过程中的临时存储）
  private _pendingLinearStyles: Map<number, ICharStyle> | null = null;

  /** 撤销恢复期间跳过 2D→线性 样式迁移（快照坐标已与恢复后的分行一致） */
  private _skipStyleMigration = false;

  // 标记：避免循环更新
  private _isUpdatingBounds = false;

  // 调试模式：显示基线和行框
  public debugMode = false;
  private _pathDragIndex: number | null = null;
  private _pathDragHandle: "anchor" | "in" | "out" = "anchor";
  private _selectedPathAnchorIndex: number | null = null;
  private _configuredPathAppearance = new Set<(typeof PATH_APPEARANCE_KEYS)[number]>();
  private _lastPathAnchorClick: { index: number; time: number } | null = null;
  private _handledPointerDownEvents = new WeakSet<object>();
  private _pathAnchorMenuElement: HTMLDivElement | null = null;
  private _onSelectedPathAnchorKeyDown = (event: KeyboardEvent): void => {
    if (this._selectedPathAnchorIndex === null) return;
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!this.pathAnchorMenuEnabled) this.removePathAnchor(this._selectedPathAnchorIndex);
  };
  private _onPathAnchorMenuOutsidePointerDown = (event: PointerEvent): void => {
    if (this._pathAnchorMenuElement?.contains(event.target as Node)) return;
    this._hidePathAnchorMenu();
  };
  private _pathChangedDuringDrag = false;
  private _pathGlyphs: IPathGlyphLayout[] = [];

  // 保存原始 draggable 状态（进入编辑时临时禁用）
  private _savedDraggable: boolean | IAxis | undefined;

  /** 点击属性面板时置位，避免 hidden textarea blur 后抢回焦点导致 select 无法展开 */
  private _panelMouseDown = false;

  private _onDocMouseDownCaptureForPanel = (e: MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("[data-rt-panel]") || t?.closest?.(".panel")) {
      this._panelMouseDown = true;
    } else {
      this._panelMouseDown = false;
    }
  };

  constructor(data?: IRichTextInputData) {
    super(expandPathConfig(data) as IRichTextInputData);
    this._trackPathAppearance(data);

    // ⚠️ 必须先创建测量 canvas，再处理样式（避免 _splitLinesWithWrap 报错）
    this._measureCanvas = document.createElement("canvas");
    this._measureCtx = this._measureCanvas.getContext("2d")!;

    // 保存回调
    if (data?.onEditingEntered) this.onEditingEntered = data.onEditingEntered;
    if (data?.onEditingExited) this.onEditingExited = data.onEditingExited;
    if (data?.onSelectionChange) this.onSelectionChange = data.onSelectionChange;
    if (data?.onPathChange) this.onPathChange = data.onPathChange;
    this.pathEditing = !!data?.textPath?.editing;

    // 导入样式数据（支持两种格式）
    if (data?.styleRanges) {
      // 推荐格式：range-based（简洁，兼容 Figma）
      this._loadFromStyleRanges(data.styleRanges);
    } else if (data?.styles) {
      // 兼容格式：index-based（旧格式）
      this._deserializeStyles(data.styles);
    }

    // 启用边界框命中检测
    this.hitBox = true;

    // 指定使用 RichTextPlusEditor 作为内部编辑器
    this.editInner = "RichTextPlusEditor";

    // 绑定事件
    this._bindEvents();

    this.editConfig = { lockRatio: "corner", ...this.editConfig };

    // 与 Leafer Text 一致：确保首次渲染时 renderBounds 被正确计算
    this.__layout.renderChanged || this.__layout.renderChange();
  }

  public set(data: any, transition?: any): void {
    this._trackPathAppearance(data);
    super.set(expandPathConfig(data) as any, transition);
    if (data?.textPath?.editing !== undefined && this._hiddenTextarea) {
      this.setPathEditing(!!data.textPath.editing);
    }
  }

  private _trackPathAppearance(data: any): void {
    if (!this._configuredPathAppearance || !data || typeof data !== "object") return;
    const values = { ...data, ...flattenPathConfig(data) };
    PATH_APPEARANCE_KEYS.forEach((key) => {
      if (values[key] !== undefined) this._configuredPathAppearance.add(key);
    });
  }

  // ============ Leafer 生命周期方法 ============

  /**
   * renderSpread 控制 Leafer 是否调用 __updateRenderBounds。
   * 必须返回正值，否则 renderBounds 被重置为 boxBounds，溢出文本被裁剪且拖动留残影。
   */
  __updateRenderSpread(): number {
    const shadowExpand = this._getContentShadowExpand();
    return Math.max(shadowExpand, 1);
  }

  /**
   * 计算边界（必须实现）
   */
  __updateBoxBounds(): void {
    if (this._isUpdatingBounds) return;
    this._isUpdatingBounds = true;

    // ⚠️ 必须 try/finally：中途抛异常若不复位标记，元素将永久不再重新布局
    try {
      this._updateGraphemes();
      this._measureText();

      if (this._pathMode !== TextPathMode.None) {
        const pathBounds = this._getPathBounds();
        const box = this.__layout.boxBounds;
        box.x = pathBounds.x;
        box.y = pathBounds.y;
        box.width = Math.max(1, pathBounds.width);
        box.height = Math.max(1, pathBounds.height);
        return;
      }

      const box = this.__layout.boxBounds;
      const computed = this._getTextBounds();

      // 宽度：autoWidth 时使用计算值，否则优先使用设置值
      const width =
        this.autoWidth || !this.width || this.width <= 0 ? computed.width : Math.abs(this.width);

      // 高度：autoHeight 时使用计算值，否则优先使用设置值
      const height =
        this.autoHeight || !this.height || this.height <= 0
          ? computed.height
          : Math.abs(this.height);

      // ✅ 关键：自动宽高模式下，实时更新 width/height 属性值
      // 这样切换为固定宽高时，值不会丢失
      if (this.autoWidth && computed.width > 0 && this.width !== computed.width) {
        this.__.width = computed.width; // 直接设置到数据层，避免触发 boxChange
      }
      if (this.autoHeight && computed.height > 0 && this.height !== computed.height) {
        this.__.height = computed.height;
      }

      box.x = 0;
      box.y = 0;
      box.width = width;
      box.height = height;

      this._updateFlipRenderFlag();
    } finally {
      this._isUpdatingBounds = false;
    }
  }

  __scaleResize(scaleX: number, scaleY: number): void {
    const editor =
      (this as any).app?.editor ??
      (this.leafer as any)?.app?.editor ??
      (this.leafer as any)?.editor;
    const direction = editor?.dragPoint?.direction;
    const isHorizontalSide =
      direction === 3 || direction === 7 || direction === "right" || direction === "left";
    const isVerticalSide =
      direction === 1 || direction === 5 || direction === "top" || direction === "bottom";
    const isCorner =
      direction === 0 ||
      direction === 2 ||
      direction === 4 ||
      direction === 6 ||
      direction === "top-left" ||
      direction === "top-right" ||
      direction === "bottom-right" ||
      direction === "bottom-left";
    const hasDirection = direction !== undefined && direction !== null;
    const epsilon = 1e-6;
    const widthChanged = Math.abs(scaleX - 1) > epsilon;
    const heightChanged = Math.abs(scaleY - 1) > epsilon;

    if (isCorner) {
      this._scaleResizeFontSize(Math.abs(scaleX));
      return;
    }

    if (isHorizontalSide) {
      this.autoWidth = false;
      this.autoHeight = true;
    } else if (isVerticalSide) {
      this.autoHeight = false;
    } else if (hasDirection) {
      this.autoWidth = false;
      this.autoHeight = false;
    } else {
      if (widthChanged) this.autoWidth = false;
      if (heightChanged) this.autoHeight = false;
      if (widthChanged && !heightChanged) this.autoHeight = true;
    }

    (UI as any).prototype.__scaleResize.call(this, scaleX, scaleY);
  }

  private _scaleResizeFontSize(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-6) return;

    const linearStyles = this._convertStylesToLinear();
    for (const [index, style] of linearStyles) {
      const resized = { ...style };
      if (typeof resized.fontSize === "number") resized.fontSize *= scale;
      resized.letterSpacing = this._scalePixelUnit(resized.letterSpacing, scale);
      linearStyles.set(index, resized);
    }
    this._pendingLinearStyles = linearStyles.size ? linearStyles : null;

    this.fontSize *= scale;
    this.padding = Array.isArray(this.padding)
      ? this.padding.map((value) => value * scale)
      : this.padding * scale;
    this.lineHeight = this._scalePixelUnit(this.lineHeight, scale)!;
    this.letterSpacing = this._scalePixelUnit(this.letterSpacing, scale)!;

    if (!this.autoWidth) this.width = Math.abs(this.width * scale);
    if (!this.autoHeight) this.height = Math.abs(this.height * scale);

    this._relayout();
  }

  private _scalePixelUnit(
    value: number | IUnitData | undefined,
    scale: number,
  ): number | IUnitData | undefined {
    if (typeof value === "number") return value * scale;
    if (value?.type === "px") return { ...value, value: value.value * scale };
    return value;
  }

  /**
   * 更新翻转状态（用于扩展渲染边界，避免翻转残影）
   */
  private _updateFlipRenderFlag(): void {
    const signX = (this.scaleX ?? 1) < 0 ? -1 : 1;
    const signY = (this.scaleY ?? 1) < 0 ? -1 : 1;

    if (signX !== this._lastScaleSignX || signY !== this._lastScaleSignY) {
      this._needsFlipRenderBounds = true;
      this._lastScaleSignX = signX;
      this._lastScaleSignY = signY;
      this.__layout.renderChange();
    }
  }

  /**
   * 更新渲染边界（扩展翻转时的旧区域，避免残影）
   */
  __updateRenderBounds(): void {
    const { renderBounds, boxBounds } = this.__layout;
    if (!renderBounds) return;

    // 阴影扩展
    const shadowExpand = this._getContentShadowExpand();

    if (this.textOverflow === "show") {
      // textOverflow='show'：renderBounds = union(boxBounds, contentBounds) + shadow
      const content = this._getContentRenderBounds();
      const minX = Math.min(boxBounds.x, content.x);
      const minY = Math.min(boxBounds.y, content.y);
      const maxX = Math.max(boxBounds.x + boxBounds.width, content.x + content.width);
      const maxY = Math.max(boxBounds.y + boxBounds.height, content.y + content.height);
      renderBounds.x = minX - shadowExpand;
      renderBounds.y = minY - shadowExpand;
      renderBounds.width = maxX - minX + shadowExpand * 2;
      renderBounds.height = maxY - minY + shadowExpand * 2;
    } else {
      renderBounds.x = boxBounds.x - shadowExpand;
      renderBounds.y = boxBounds.y - shadowExpand;
      renderBounds.width = boxBounds.width + shadowExpand * 2;
      renderBounds.height = boxBounds.height + shadowExpand * 2;
    }

    this._updateFlipRenderFlag();

    if (this._needsFlipRenderBounds && this._lastWorldRenderBounds) {
      const worldMatrix = (this.worldTransform || (this as any).__world) as any;
      const lastLocal = this._transformBoundsToLocal(this._lastWorldRenderBounds, worldMatrix);

      const minX = Math.min(renderBounds.x, lastLocal.x);
      const minY = Math.min(renderBounds.y, lastLocal.y);
      const maxX = Math.max(renderBounds.x + renderBounds.width, lastLocal.x + lastLocal.width);
      const maxY = Math.max(renderBounds.y + renderBounds.height, lastLocal.y + lastLocal.height);

      renderBounds.x = minX - 1;
      renderBounds.y = minY - 1;
      renderBounds.width = maxX - minX + 2;
      renderBounds.height = maxY - minY + 2;

      this._needsFlipRenderBounds = false;
    }

    const worldMatrix = (this.worldTransform || (this as any).__world) as any;
    this._lastWorldRenderBounds = this._transformBounds(renderBounds, worldMatrix);
  }

  private _getContentRenderBounds(): { x: number; y: number; width: number; height: number } {
    const padding = this._parsePadding(this.padding);

    if (!this._lineMetrics.length) {
      return {
        x: 0,
        y: 0,
        width: (this.width || 0) + padding.left + padding.right,
        height: (this.height || 0) + padding.top + padding.bottom,
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let lineIdx = 0; lineIdx < this._lineMetrics.length; lineIdx++) {
      const line = this._lineMetrics[lineIdx];
      if (!line.chars.length) {
        minY = Math.min(minY, line.y);
        maxY = Math.max(maxY, line.y + line.height);
        continue;
      }

      const firstChar = line.chars[0];
      const lastChar = line.chars[line.chars.length - 1];
      const lastLetterSpacing = this._parseLetterSpacing(
        lastChar.style.letterSpacing,
        lastChar.style.fontSize!,
      );

      minX = Math.min(minX, firstChar.x);
      maxX = Math.max(maxX, lastChar.x + lastChar.width + lastLetterSpacing);
      minY = Math.min(minY, line.y);
      maxY = Math.max(maxY, line.y + line.height);
    }

    if (!isFinite(minX) || !isFinite(maxX)) {
      minX = 0;
      maxX = 0;
    }
    if (!isFinite(minY) || !isFinite(maxY)) {
      minY = 0;
      maxY = 0;
    }

    const strokeExpand = this._getStrokeExpand();
    // 注意：阴影扩展由 __updateRenderBounds 统一处理，这里只处理描边
    return {
      x: minX + padding.left - strokeExpand,
      y: minY + padding.top - strokeExpand,
      width: maxX - minX + padding.left + padding.right + strokeExpand * 2,
      height: maxY - minY + padding.top + padding.bottom + strokeExpand * 2,
    };
  }

  private _transformBounds(
    bounds: { x: number; y: number; width: number; height: number },
    matrix: any,
  ): { x: number; y: number; width: number; height: number } {
    if (!matrix) return { ...bounds };
    const { a, b, c, d, e, f } = matrix;
    const x1 = bounds.x;
    const y1 = bounds.y;
    const x2 = bounds.x + bounds.width;
    const y2 = bounds.y + bounds.height;

    const p1x = a * x1 + c * y1 + e;
    const p1y = b * x1 + d * y1 + f;
    const p2x = a * x2 + c * y1 + e;
    const p2y = b * x2 + d * y1 + f;
    const p3x = a * x1 + c * y2 + e;
    const p3y = b * x1 + d * y2 + f;
    const p4x = a * x2 + c * y2 + e;
    const p4y = b * x2 + d * y2 + f;

    const minX = Math.min(p1x, p2x, p3x, p4x);
    const minY = Math.min(p1y, p2y, p3y, p4y);
    const maxX = Math.max(p1x, p2x, p3x, p4x);
    const maxY = Math.max(p1y, p2y, p3y, p4y);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private _transformBoundsToLocal(
    bounds: { x: number; y: number; width: number; height: number },
    matrix: any,
  ): { x: number; y: number; width: number; height: number } {
    if (!matrix) return { ...bounds };
    const { a, b, c, d, e, f } = matrix;
    const det = a * d - b * c;
    if (!det) return { ...bounds };

    const ia = d / det;
    const ib = -b / det;
    const ic = -c / det;
    const id = a / det;
    const ie = (c * f - d * e) / det;
    const iff = (b * e - a * f) / det;

    const x1 = bounds.x;
    const y1 = bounds.y;
    const x2 = bounds.x + bounds.width;
    const y2 = bounds.y + bounds.height;

    const p1x = ia * x1 + ic * y1 + ie;
    const p1y = ib * x1 + id * y1 + iff;
    const p2x = ia * x2 + ic * y1 + ie;
    const p2y = ib * x2 + id * y1 + iff;
    const p3x = ia * x1 + ic * y2 + ie;
    const p3y = ib * x1 + id * y2 + iff;
    const p4x = ia * x2 + ic * y2 + ie;
    const p4y = ib * x2 + id * y2 + iff;

    const minX = Math.min(p1x, p2x, p3x, p4x);
    const minY = Math.min(p1y, p2y, p3y, p4y);
    const maxX = Math.max(p1x, p2x, p3x, p4x);
    const maxY = Math.max(p1y, p2y, p3y, p4y);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * 绘制碰撞路径（必须实现）
   */
  __drawHitPath(hitCanvas: ILeaferCanvas): void {
    const { context } = hitCanvas;
    const { x, y, width, height } = this.__layout.boxBounds;

    context.beginPath();
    context.rect(x, y, width, height);
  }

  /**
   * 自定义绘制（核心）
   */
  __draw(canvas: ILeaferCanvas): void {
    const ctx = canvas.context as CanvasRenderingContext2D;

    ctx.save();

    if (this._pathMode !== TextPathMode.None) {
      if (this.isEditing && this.selectionStart !== this.selectionEnd) this._drawPathSelection(ctx);
      this._drawPathText(ctx);
      if (this.isEditing && this.selectionStart === this.selectionEnd) this._drawPathCursor(ctx);
      if (this.isEditing && this.pathEditing) this._drawPathControls(ctx);
      ctx.restore();
      return;
    }

    // 1. 绘制选区背景
    if (this.isEditing && this.selectionStart !== this.selectionEnd) {
      this._drawSelection(ctx);
    }

    // 2. 绘制文本
    this._drawText(ctx);

    // 3. 绘制光标
    if (this.isEditing && this.selectionStart === this.selectionEnd) {
      this._drawCursor(ctx);
    }

    ctx.restore();
  }

  // ============ 文本测量与布局 ============

  private _updateGraphemes(): void {
    const text = String(this.text || "");
    this._graphemes = graphemeSplit(text);

    // ⚠️ 关键：在重新分行前，确保样式为线性格式
    // 避免换行导致样式丢失（行号/列号会变化）
    const hadStyles = this._styles.size > 0;

    // 撤销恢复期间：快照的 2D 坐标与恢复后的分行一致，不能做迁移
    if (this._skipStyleMigration) {
      this._pendingLinearStyles = null;
      this._lines = this._splitLines();
      return;
    }

    // 文本长度未变（只是宽度/换行规则变化）或有存量样式 → 先转成线性索引再重排
    if (!this._pendingLinearStyles && hadStyles) {
      this._pendingLinearStyles = this._convertStylesToLinear();
    }

    // 重新分行（可能改变行号/列号）
    // _splitLinesWithWrap 会使用 _pendingLinearStyles 来获取字符样式
    this._lines = this._splitLines();

    // 应用样式（转换为新的 2D 坐标）
    if (this._pendingLinearStyles) {
      this._applyPendingStyles();
    }
  }

  /**
   * 将 2D 样式 Map 转换为线性样式 Map（用于保存/恢复）
   */
  private _convertStylesToLinear(): Map<number, ICharStyle> {
    const linear = new Map<number, ICharStyle>();

    for (const [lineIdx, lineMap] of this._styles.entries()) {
      for (const [charIdx, style] of lineMap.entries()) {
        const linearIndex = this._locationToLinear(lineIdx, charIdx);
        linear.set(linearIndex, style);
      }
    }

    return linear;
  }

  private _splitLines(): string[][] {
    if (!this._graphemes.length) return [[]];

    const layoutWidth = Math.abs(this.width || 0);

    // 如果启用了自动宽度，或 textWrap 是 'none'，或没有设置宽度，只按 \n 分行
    if (this.autoWidth || this.textWrap === "none" || layoutWidth <= 0) {
      return this._splitLinesByNewline();
    }

    // 自动换行逻辑（固定宽度 + textWrap 非 none）
    return this._splitLinesWithWrap();
  }

  /**
   * 按换行符分行（不考虑宽度）
   */
  private _splitLinesByNewline(): string[][] {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    this._paragraphEndLines.clear();
    this._lineHasNewline = [];
    this._paragraphNewlineFlags = [];

    for (const char of this._graphemes) {
      if (char === "\n") {
        lines.push(currentLine);
        this._lineHasNewline.push(true);
        this._paragraphNewlineFlags.push(true);
        this._paragraphEndLines.add(lines.length - 1);
        currentLine = [];
      } else {
        currentLine.push(char);
      }
    }
    lines.push(currentLine);
    this._lineHasNewline.push(false);
    this._paragraphNewlineFlags.push(false);
    this._paragraphEndLines.add(lines.length - 1);

    return lines.length ? lines : [[]];
  }

  /**
   * 带自动换行的分行逻辑
   */
  private _splitLinesWithWrap(): string[][] {
    const lines: string[][] = [];
    const paragraphs = this._splitLinesByNewline(); // 先按 \n 分段
    this._paragraphEndLines.clear();
    this._lineHasNewline = [];
    const paragraphNewlineFlags = this._paragraphNewlineFlags;

    const padding = this._parsePadding(this.padding);
    const maxWidth = Math.max(0, Math.abs(this.width || 0) - padding.left - padding.right);

    // 临时保存当前的线性字符索引（用于获取字符级样式）
    let linearCharIndex = 0;

    for (let paraIdx = 0; paraIdx < paragraphs.length; paraIdx++) {
      const para = paragraphs[paraIdx];
      if (para.length === 0) {
        lines.push([]);
        this._lineHasNewline.push(!!paragraphNewlineFlags[paraIdx]);
        this._paragraphEndLines.add(lines.length - 1);
        linearCharIndex++; // 换行符
        continue;
      }

      let currentLine: string[] = [];
      let currentWidth = 0;
      const paraStartLineIndex = lines.length;

      // 首行缩进（与 _measureText 的 _isParagraphStart 口径一致：每个段落首行都缩进）
      // 仅作用于段落第一行，续行不缩进
      const indent = this.paraIndent;
      let isFirstLineOfPara = true;

      for (let i = 0; i < para.length; i++) {
        const char = para[i];

        // ✅ 关键修复：使用字符实际样式的字号来估算宽度
        const charStyle = this._getStyleAtLinearIndex(linearCharIndex);
        const charFontSize = charStyle?.fontSize || this.fontSize;
        const charFontFamily = charStyle?.fontFamily || this.fontFamily;
        const charFontWeight = charStyle?.fontWeight || this.fontWeight;
        const charItalic = charStyle?.italic || this.italic;
        const charLetterSpacing = this._parseLetterSpacing(
          charStyle?.letterSpacing ?? this.letterSpacing,
          charFontSize,
        );

        // 与绘制/测量保持一致：textCase 会改变字形宽度
        const displayChar = this._applyTextCase(
          char,
          charStyle?.textCase ?? this.textCase,
          this._isWordStartInLine(para, i),
        );

        const charWidth = measureTextWidth(
          this._measureCtx,
          displayChar,
          charFontSize,
          charFontFamily,
          charFontWeight,
          charItalic,
        );

        // 检查是否需要换行（charWidth 含 letterSpacing，与 Leafer 一致）
        const charAdvance = charWidth + charLetterSpacing;
        const availableWidth = maxWidth - (isFirstLineOfPara ? indent : 0);
        const shouldWrap = currentWidth + charAdvance > availableWidth && currentLine.length > 0;
        if (shouldWrap) {
          if (this.textWrap === "normal" && isLeaferAfterChar(char)) {
            // 中文排版：闭合标点跟随上一行，避免 “，。！？）】” 等打头。
            currentLine.push(char);
            currentWidth += charAdvance;
          } else {
            lines.push(currentLine);
            this._lineHasNewline.push(false);
            currentLine = [char];
            currentWidth = charAdvance;
            isFirstLineOfPara = false;
          }
        } else {
          currentLine.push(char);
          currentWidth += charAdvance;
        }

        linearCharIndex++;
      }

      if (currentLine.length > 0) {
        lines.push(currentLine);
        this._lineHasNewline.push(false);
      }
      // 只有本段落确实产生了行时，才把段末换行标记写到本段最后一行，
      // 否则会污染上一段落的标记，导致 _linearToLocation 整体错位。
      if (this._lineHasNewline.length && lines.length > paraStartLineIndex) {
        this._lineHasNewline[this._lineHasNewline.length - 1] = !!paragraphNewlineFlags[paraIdx];
      }
      this._paragraphEndLines.add(lines.length - 1);

      linearCharIndex++; // 换行符
    }

    return lines.length ? lines : [[]];
  }

  /**
   * 获取线性索引位置的字符样式（用于换行计算）
   */
  private _getStyleAtLinearIndex(linearIndex: number): ICharStyle | null {
    // 优先从 pendingLinearStyles 获取（这是线性格式的样式）
    if (this._pendingLinearStyles?.has(linearIndex)) {
      return this._pendingLinearStyles.get(linearIndex)!;
    }

    // 如果没有 pendingLinearStyles，返回 null，使用基础样式
    return null;
  }

  private _isParagraphStart(lineIdx: number): boolean {
    return lineIdx > 0 && this._paragraphEndLines.has(lineIdx - 1);
  }

  private _measureText(): void {
    this._lineMetrics = [];

    let y = 0;

    for (let lineIdx = 0; lineIdx < this._lines.length; lineIdx++) {
      const line = this._lines[lineIdx];
      const chars: ICharMetrics[] = [];

      // 首行缩进（仅第一行或段首行，与 Leafer paraStart 一致）
      const indent = lineIdx === 0 || this._isParagraphStart(lineIdx) ? this.paraIndent : 0;
      let x = indent;

      // 行内最大字号：决定行盒高度与基线（混合字号时不能只用元素级 fontSize）
      let maxFontSize = 0;

      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        const char = line[charIdx];
        const style = this._getCharStyle(lineIdx, charIdx);

        // ⚠️ 测量必须与绘制使用同一字形，否则 textCase 会导致字符重叠
        const displayChar = this._applyTextCase(
          char,
          style.textCase,
          this._isWordStartInLine(line, charIdx),
        );

        const width = measureTextWidth(
          this._measureCtx,
          displayChar,
          style.fontSize!,
          style.fontFamily!,
          style.fontWeight,
          style.italic,
        );

        // 字间距
        const letterSpacing = this._parseLetterSpacing(style.letterSpacing, style.fontSize!);

        if (style.fontSize! > maxFontSize) maxFontSize = style.fontSize!;

        chars.push({ char, x, width, style });
        x += width + letterSpacing;
      }

      // 空行按元素级字号计算行盒
      if (!maxFontSize) maxFontSize = this.fontSize;

      // 行高按行内最大字号计算（percent 行高在混合字号时才正确）
      const lineHeightValue = this._parseLineHeight(this.lineHeight, maxFontSize);

      // Leafer 公式: baseLine = lineHeight - (lineHeight - fontSize * 0.7) / 2
      const baseline = lineHeightValue - (lineHeightValue - maxFontSize * 0.7) / 2;

      // 段落间距：在段首行之前加（与 Leafer 一致：先 starY += paraSpacing 再 row.y = starY）
      if (lineIdx > 0 && this._isParagraphStart(lineIdx)) {
        y += this.paraSpacing;
      }

      this._lineMetrics.push({
        chars,
        y,
        height: lineHeightValue,
        baseline,
        maxFontSize,
        indent,
        alignOffset: 0,
      });
      y += lineHeightValue;
    }

    // 垂直对齐（与 Leafer layoutText 一致）
    this._applyVerticalAlign();

    // 应用文本对齐（调整字符 x 坐标）
    this._applyTextAlignToMetrics();
  }

  /**
   * 判断行内某字符是否是单词首字符（用于 textCase: 'title'）
   */
  private _isWordStartInLine(line: string[], charIdx: number): boolean {
    if (charIdx === 0) return true;
    return RE_WORD_BOUNDARY.test(line[charIdx - 1]);
  }

  /**
   * 样式变更后的重排：字号/字间距变化会影响换行，必须重新分行而不能只重新测量。
   */
  private _relayout(): void {
    this._updateGraphemes();
    this._measureText();
    this.__layout.boxChanged || this.__layout.boxChange();
    this.forceUpdate();
    this.forceRender();
  }

  private _applyVerticalAlign(): void {
    if (!this._lineMetrics.length) return;
    const va = this.verticalAlign || "top";
    if (va === "top") return;

    const padding = this._parsePadding(this.padding);
    const containerHeight =
      !this.autoHeight && this.height ? Math.abs(this.height) - padding.top - padding.bottom : 0;
    if (containerHeight <= 0) return;

    const lastLine = this._lineMetrics[this._lineMetrics.length - 1];
    const realHeight = lastLine.y + lastLine.height;

    let offsetY = 0;
    if (va === "middle") {
      offsetY = (containerHeight - realHeight) / 2;
    } else if (va === "bottom") {
      offsetY = containerHeight - realHeight;
    }

    if (offsetY !== 0) {
      for (const line of this._lineMetrics) {
        line.y += offsetY;
      }
    }
  }

  /**
   * 应用文本对齐到字符位置（两端对齐需要调整字符间距）
   * autoWidth 时按最长行做参照，保证多行自动宽度文本也能居中/右对齐（与 Figma 一致）
   */
  private _applyTextAlignToMetrics(): void {
    const align = this.textAlign || "left";
    if (align === "left") {
      for (const line of this._lineMetrics) line.alignOffset = 0;
      return;
    }

    const containerWidth = this._getAlignContainerWidth();
    if (containerWidth <= 0) {
      for (const line of this._lineMetrics) line.alignOffset = 0;
      return;
    }

    for (let lineIdx = 0; lineIdx < this._lineMetrics.length; lineIdx++) {
      const line = this._lineMetrics[lineIdx];

      const { alignOffset, extraSpacing } = this._getAlignOffsetAndSpacing(
        line,
        lineIdx,
        containerWidth,
      );

      // 空行也要记录 alignOffset，否则光标/选区会跳到最左侧
      line.alignOffset = alignOffset;

      // 应用对齐偏移和两端对齐间距
      if (alignOffset !== 0 || extraSpacing !== 0) {
        let cumulativeSpacing = 0;
        for (let i = 0; i < line.chars.length; i++) {
          line.chars[i].x += alignOffset + cumulativeSpacing;
          cumulativeSpacing += extraSpacing;
        }
      }
    }
  }

  /**
   * 对齐参照宽度：固定宽度用 width - padding；autoWidth 用最长行宽
   */
  private _getAlignContainerWidth(): number {
    const padding = this._parsePadding(this.padding);

    if (!this.autoWidth) {
      return Math.abs(this.width || 0) - padding.left - padding.right;
    }

    let maxLineWidth = 0;
    for (const line of this._lineMetrics) {
      const w = this._getLineContentWidth(line);
      if (w > maxLineWidth) maxLineWidth = w;
    }
    return maxLineWidth;
  }

  /**
   * 行内容宽度（不含行末字间距，与排版惯例一致，避免右对齐多出一个 spacing）
   * 注意：必须在应用 alignOffset 之前调用，或用于同一次对齐计算内部。
   */
  private _getLineContentWidth(line: ILineMetrics): number {
    if (!line.chars.length) return line.indent;
    const lastChar = line.chars[line.chars.length - 1];
    return lastChar.x + lastChar.width;
  }

  /**
   * 解析 letterSpacing — 与 Leafer UnitConvert.number 一致：
   *   纯数字 → px
   *   {type:'percent', value} → value × fontSize
   */
  private _parseLetterSpacing(
    letterSpacing: number | IUnitData | undefined,
    fontSize: number,
  ): number {
    if (letterSpacing == null) return 0;
    if (typeof letterSpacing === "number") return letterSpacing;
    if (typeof letterSpacing === "object" && letterSpacing.type === "percent") {
      return letterSpacing.value * fontSize;
    }
    return (letterSpacing as IUnitData).value ?? 0;
  }

  /**
   * 解析 lineHeight — 与 Leafer UnitConvert.number(lineHeight, fontSize) 完全一致：
   *   纯数字 → 直接当 px
   *   {type:'percent', value} → value × fontSize
   *   其他对象 → value 当 px
   * 默认值 {type:'percent', value:1.5} 即 1.5×fontSize
   */
  private _parseLineHeight(lineHeight: number | IUnitData, fontSize: number): number {
    if (typeof lineHeight === "number") return lineHeight || fontSize;
    if (typeof lineHeight === "object") {
      if (lineHeight.type === "percent") return lineHeight.value * fontSize || fontSize;
      return lineHeight.value || fontSize;
    }
    return fontSize;
  }

  private _getTextBounds(): { width: number; height: number } {
    const padding = this._parsePadding(this.padding);
    const layoutWidth = Math.abs(this.width || 0);
    const strokeExpand = this._getStrokeExpand();

    if (!this._lineMetrics.length) {
      const baseHeight = this._parseLineHeight(this.lineHeight, this.fontSize);
      const baseWidth = this.autoWidth ? 100 : layoutWidth || 100;
      return {
        width: baseWidth + padding.left + padding.right + strokeExpand * 2,
        height: baseHeight + padding.top + padding.bottom + strokeExpand * 2,
      };
    }

    // 计算内容实际宽度
    const contentWidth = Math.max(
      ...this._lineMetrics.map((line) => {
        if (!line.chars.length) return 0;
        const lastChar = line.chars[line.chars.length - 1];
        const letterSpacing = this._parseLetterSpacing(
          lastChar.style.letterSpacing,
          lastChar.style.fontSize!,
        );
        return lastChar.x + lastChar.width + letterSpacing;
      }),
      0,
    );

    // 宽度：autoWidth 时使用内容宽度，否则取 max(内容宽度, 设置宽度)
    const finalWidth = this.autoWidth ? contentWidth : Math.max(contentWidth, layoutWidth);

    // 用最后一行的 y + height 计算总高度（包含 paraSpacing）
    const lastLine = this._lineMetrics[this._lineMetrics.length - 1];
    const totalHeight = lastLine ? lastLine.y + lastLine.height : 0;

    return {
      width: finalWidth + padding.left + padding.right + strokeExpand * 2 || 100,
      height:
        totalHeight + padding.top + padding.bottom + strokeExpand * 2 ||
        this._parseLineHeight(this.lineHeight, this.fontSize),
    };
  }

  private _getPathSamples() {
    if (this._pathMode === TextPathMode.Circle) {
      const textLength = this._lineMetrics.reduce(
        (sum, line) =>
          sum +
          line.chars.reduce(
            (lineSum, char) =>
              lineSum +
              char.width +
              this._parseLetterSpacing(char.style.letterSpacing, char.style.fontSize!),
            0,
          ),
        0,
      );
      const radius = Math.max(this.pathRadius, textLength / (Math.PI * 2));
      // 圆形路径是完整一圈；center 对齐的路径中点比起点多 180°。
      // pathStartAngle 表示文字的视觉锚点，默认 -90° 应直接位于圆的上方。
      const pathAngle = resolveCirclePathStartAngle(this.pathStartAngle, this.pathAlign);
      return sampleCirclePath(radius, pathAngle);
    }
    if (this._pathMode === TextPathMode.Polygon) {
      return sampleBezierPath(
        createRegularPolygonPath(this.pathSides, this.pathRadius, this.pathStartAngle),
        true,
      );
    }
    if (this._pathGenerator) {
      const textLength = this._lineMetrics.reduce(
        (sum, line) =>
          sum +
          line.chars.reduce(
            (lineSum, char) =>
              lineSum +
              char.width +
              this._parseLetterSpacing(char.style.letterSpacing, char.style.fontSize!),
            0,
          ),
        0,
      );
      return sampleBezierPath(
        this._pathGenerator({ textLength, textPath: { ...this.textPath } }),
        this.pathClosed,
      );
    }
    return sampleBezierPath(this.pathAnchors ?? [], this.pathClosed);
  }

  private _getPathGlyphLayouts(): IPathGlyphLayout[] {
    const chars = this._lineMetrics.flatMap((line) => line.chars);
    const samples = this._getPathSamples();
    const layouts = layoutGlyphsOnPath(
      samples,
      chars.map(
        (char) =>
          char.width + this._parseLetterSpacing(char.style.letterSpacing, char.style.fontSize!),
      ),
      { align: this.pathAlign, direction: this.pathDirection, side: this.pathSide },
    );
    this._pathGlyphs = layouts.map((glyph, index) => ({
      ...glyph,
      rotation: glyph.rotation + ((chars[index]?.style.rotation ?? 0) * Math.PI) / 180,
    }));
    return this._pathGlyphs;
  }

  private _getPathChars() {
    return this._lineMetrics.flatMap((line, lineIndex) =>
      line.chars.map((char, charIndex) => ({
        char,
        charIndex,
        lineIndex,
        linearIndex: this._locationToLinear(lineIndex, charIndex),
      })),
    );
  }

  private _getPathBounds(): { x: number; y: number; width: number; height: number } {
    const samples = this._getPathSamples();
    const glyphs = this._getPathGlyphLayouts();
    const fontSize = Math.max(
      this.fontSize,
      ...this._lineMetrics.flatMap((line) =>
        line.chars.map((char) => char.style.fontSize ?? this.fontSize),
      ),
    );
    const anchors = (
      this._pathMode === TextPathMode.Custom ? (this.pathAnchors ?? []) : []
    ).flatMap((anchor) => [
      anchor,
      ...(anchor.handleIn
        ? [{ x: anchor.x + anchor.handleIn.x, y: anchor.y + anchor.handleIn.y }]
        : []),
      ...(anchor.handleOut
        ? [{ x: anchor.x + anchor.handleOut.x, y: anchor.y + anchor.handleOut.y }]
        : []),
    ]);
    const points = [...samples, ...glyphs, ...anchors];
    if (!points.length) return { x: 0, y: 0, width: 1, height: Math.max(1, fontSize) };
    const controlPadding = this.pathEditing
      ? Math.max(
          this.pathAnchorRadius + this.pathAnchorLineWidth / 2,
          this.pathHandleSize / 2 + this.pathHandleLineWidth / 2,
        )
      : 0;
    return getPathBounds(points, Math.max(fontSize + this._getStrokeExpand(), controlPadding));
  }

  private _drawPathText(ctx: CanvasRenderingContext2D): void {
    const chars = this._getPathChars();
    const glyphs = this._getPathGlyphLayouts();
    ctx.textBaseline = "alphabetic";
    glyphs.forEach((glyph, index) => {
      const item = chars[index];
      if (!item) return;
      const style = item.char.style;
      const displayChar = this._applyTextCase(item.char.char, style.textCase, true);
      ctx.save();
      ctx.translate(glyph.x, glyph.y);
      ctx.rotate(glyph.rotation);
      ctx.font = buildFontString(
        style.fontSize!,
        style.fontFamily!,
        style.fontWeight,
        style.italic,
      );
      const fill = this._getFillStyle(ctx, style.fill, this.__layout.boxBounds);
      ctx.fillStyle = fill;
      ctx.fillText(displayChar, -item.char.width / 2, 0);
      const strokeWidth = style.strokeWidth ?? 0;
      if (style.stroke && strokeWidth > 0) {
        ctx.strokeStyle = this._getFillStyle(ctx, style.stroke, this.__layout.boxBounds);
        ctx.lineWidth = strokeWidth;
        ctx.strokeText(displayChar, -item.char.width / 2, 0);
      }
      ctx.restore();
    });
  }

  private _drawPathSelection(ctx: CanvasRenderingContext2D): void {
    const glyphs = this._getPathGlyphLayouts();
    const chars = this._getPathChars();
    ctx.fillStyle = this.selectionColor;
    for (let index = this.selectionStart; index < this.selectionEnd; index++) {
      const glyph = glyphs[index];
      const char = chars[index]?.char;
      if (!glyph || !char) continue;
      ctx.save();
      ctx.translate(glyph.x, glyph.y);
      ctx.rotate(glyph.rotation);
      ctx.fillRect(-char.width / 2, -char.style.fontSize!, char.width, char.style.fontSize!);
      ctx.restore();
    }
  }

  private _drawPathCursor(ctx: CanvasRenderingContext2D): void {
    const glyphs = this._getPathGlyphLayouts();
    const chars = this._getPathChars();
    if (!glyphs.length) return;

    const atEnd = this.selectionStart > 0;
    const index = Math.min(Math.max(0, this.selectionStart - (atEnd ? 1 : 0)), glyphs.length - 1);
    const glyph = glyphs[index];
    const item = chars[index];
    if (!item) return;

    const advance =
      item.char.width +
      this._parseLetterSpacing(item.char.style.letterSpacing, item.char.style.fontSize!);
    const caret = getPathCaret(this._getPathSamples(), glyph, advance, {
      atEnd,
      direction: this.pathDirection,
      side: this.pathSide,
      rotation: ((item.char.style.rotation ?? 0) * Math.PI) / 180,
    });
    const height = item.char.style.fontSize ?? this.fontSize;
    const normalX = Math.cos(caret.rotation) * height;
    const normalY = Math.sin(caret.rotation) * height;

    ctx.save();
    ctx.globalAlpha = this._cursorOpacity;
    ctx.beginPath();
    ctx.moveTo(caret.x, caret.y);
    ctx.lineTo(caret.x + normalX, caret.y + normalY);
    ctx.strokeStyle = this.cursorColor;
    ctx.lineWidth = this.cursorWidth;
    ctx.stroke();
    ctx.restore();
  }

  private _drawPathControls(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const samples = this._getPathSamples();
    if (samples.length > 1) {
      ctx.beginPath();
      samples.forEach((sample, index) =>
        index ? ctx.lineTo(sample.x, sample.y) : ctx.moveTo(sample.x, sample.y),
      );
      ctx.strokeStyle = this.pathGuideColor;
      ctx.lineWidth = this.pathGuideWidth;
      ctx.stroke();
    }
    const anchors =
      this._pathMode === TextPathMode.Circle
        ? [{ x: 0, y: -this.pathRadius }]
        : this._pathMode === TextPathMode.Polygon
          ? createRegularPolygonPath(this.pathSides, this.pathRadius, this.pathStartAngle)
          : (this.pathAnchors ?? []);
    anchors.forEach((anchor, index) => {
      if ("handleIn" in anchor && anchor.handleIn) {
        this._drawPathHandle(ctx, anchor, anchor.handleIn);
      }
      if ("handleOut" in anchor && anchor.handleOut) {
        this._drawPathHandle(ctx, anchor, anchor.handleOut);
      }
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, this.pathAnchorRadius, 0, Math.PI * 2);
      ctx.fillStyle =
        index === this._selectedPathAnchorIndex ? this.pathAnchorActiveFill : this.pathAnchorFill;
      ctx.strokeStyle = this.pathAnchorStroke;
      ctx.lineWidth = this.pathAnchorLineWidth;
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  private _drawPathHandle(
    ctx: CanvasRenderingContext2D,
    anchor: IPathAnchor,
    handle: { x: number; y: number },
  ): void {
    const x = anchor.x + handle.x;
    const y = anchor.y + handle.y;
    const halfSize = this.pathHandleSize / 2;
    ctx.strokeStyle = this.pathHandleStroke;
    ctx.fillStyle = this.pathHandleFill;
    ctx.lineWidth = this.pathHandleLineWidth;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillRect(x - halfSize, y - halfSize, this.pathHandleSize, this.pathHandleSize);
    ctx.strokeRect(x - halfSize, y - halfSize, this.pathHandleSize, this.pathHandleSize);
  }

  // ============ 样式管理 ============

  private _getCharStyle(lineIdx: number, charIdx: number): ICharStyle {
    const lineStyles = this._styles.get(lineIdx);
    const charStyle = lineStyles?.get(charIdx) || {};

    // 基础样式（从元素属性获取默认值，字符级样式可覆盖）
    const result: ICharStyle = {
      fill: this.fill,
      stroke: this.stroke,
      strokeWidth: this.strokeWidth,
      strokeAlign: this.strokeAlign,
      strokeWidthFixed: this.strokeWidthFixed,
      strokeCap: this.strokeCap,
      strokeJoin: this.strokeJoin,
      dashPattern: this.dashPattern,
      dashOffset: this.dashOffset,
      shadow: (this as any).shadow,
      innerShadow: (this as any).innerShadow,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight as any,
      italic: this.italic,
      textCase: this.textCase,
      textDecoration: this.textDecoration,
      letterSpacing: this.letterSpacing,
      ...charStyle,
    };

    return result;
  }

  public setSelectionStyles(style: Partial<ICharStyle>): void {
    if (this.selectionStart === this.selectionEnd) return;

    this._recordSnapshot();

    // 确保文本已分割
    if (!this._graphemes.length || !this._lines.length) {
      this._updateGraphemes();
    }

    for (let i = this.selectionStart; i < this.selectionEnd; i++) {
      const { lineIndex, charIndex } = this._linearToLocation(i);

      if (!this._styles.has(lineIndex)) {
        this._styles.set(lineIndex, new Map());
      }

      const lineStyles = this._styles.get(lineIndex)!;
      const existing = lineStyles.get(charIndex) || {};
      lineStyles.set(charIndex, { ...existing, ...style });
    }

    this._relayout();
  }

  /** 由宿主数据源同步字符样式范围；运行时仍展开为逐字样式表。 */
  public setStyleRanges(ranges: IStyleRange[] = []): void {
    const current = this._compressToStyleRanges();
    if (JSON.stringify(current) === JSON.stringify(ranges)) return;
    this._loadFromStyleRanges(ranges);
    this._relayout();
  }

  public getStyleRanges(): IStyleRange[] {
    return this._compressToStyleRanges();
  }

  // ============ 坐标转换 ============

  private _linearToLocation(index: number, upstream = false): ICursorLocation {
    if (!this._lines.length) return { lineIndex: 0, charIndex: 0 };

    let charCount = 0;

    for (let lineIndex = 0; lineIndex < this._lines.length; lineIndex++) {
      const lineLength = this._lines[lineIndex].length;
      const hasNewline = !!this._lineHasNewline[lineIndex];

      // 软换行（无 \n）：边界位置默认属于下一行首字符，用严格 <
      // 硬换行（有 \n）：边界位置是行尾（\n 前），用 <=
      // upstream（行尾亲和）：软换行边界也归属本行行尾，解决“点击/End 键落到下一行”的问题
      const inclusive = hasNewline || upstream;
      if (inclusive ? index <= charCount + lineLength : index < charCount + lineLength) {
        return { lineIndex, charIndex: index - charCount };
      }
      charCount += lineLength + (hasNewline ? 1 : 0);
    }

    return {
      lineIndex: this._lines.length - 1,
      charIndex: this._lines[this._lines.length - 1]?.length || 0,
    };
  }

  /** 光标所在位置的定位（考虑亲和性） */
  private _caretLocation(index: number): ICursorLocation {
    return this._linearToLocation(index, this._caretUpstream);
  }

  private _locationToLinear(lineIndex: number, charIndex: number): number {
    let index = 0;
    for (let i = 0; i < lineIndex && i < this._lines.length; i++) {
      const hasNewline = !!this._lineHasNewline[i];
      index += this._lines[i].length + (hasNewline ? 1 : 0);
    }
    return index + charIndex;
  }

  private _pointerToIndex(x: number, y: number): number {
    if (!this._lineMetrics.length) return 0;

    if (this._pathMode !== TextPathMode.None) {
      const glyphs = this._getPathGlyphLayouts();
      const chars = this._getPathChars();
      if (!glyphs.length) return 0;
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      glyphs.forEach((glyph, index) => {
        const dx = x - glyph.x;
        const dy = y - glyph.y;
        const value = dx * dx + dy * dy;
        if (value < nearestDistance) {
          nearest = index;
          nearestDistance = value;
        }
      });
      const glyph = glyphs[nearest];
      const along =
        (x - glyph.x) * Math.cos(glyph.rotation) + (y - glyph.y) * Math.sin(glyph.rotation);
      return Math.min(
        this._graphemes.length,
        (chars[nearest]?.linearIndex ?? nearest) + (along >= 0 ? 1 : 0),
      );
    }

    // 获取 padding 和调整坐标
    const padding = this._parsePadding(this.padding);
    const adjustedX = x - padding.left;
    const adjustedY = y - padding.top;

    const lineIndex = this._pointerToLineIndex(adjustedY);
    const line = this._lineMetrics[lineIndex];
    if (!line) return 0;

    const charIndex = this._xToCharIndex(line, adjustedX);

    // 点击软换行行的右侧空白时，光标应停在本行行尾而非下一行行首
    this._caretUpstream =
      charIndex >= line.chars.length &&
      line.chars.length > 0 &&
      !this._lineHasNewline[lineIndex] &&
      lineIndex < this._lineMetrics.length - 1;
    this._goalX = null;

    return this._locationToLinear(lineIndex, charIndex);
  }

  /** y（已扣除 padding）→ 行号 */
  private _pointerToLineIndex(adjustedY: number): number {
    let lineIndex = 0;
    for (let i = 0; i < this._lineMetrics.length; i++) {
      const line = this._lineMetrics[i];
      if (adjustedY < line.y) break;
      if (adjustedY < line.y + line.height) {
        lineIndex = i;
        break;
      }
      lineIndex = i;
    }
    return Math.max(0, Math.min(lineIndex, this._lineMetrics.length - 1));
  }

  /** x（已扣除 padding）→ 行内字符下标（半宽命中） */
  private _xToCharIndex(line: ILineMetrics, adjustedX: number): number {
    if (!line.chars.length) return 0;

    for (let i = 0; i < line.chars.length; i++) {
      const char = line.chars[i];
      if (adjustedX < char.x + char.width / 2) return i;
    }
    return line.chars.length;
  }

  // ============ 渲染方法 ============

  private _drawText(ctx: CanvasRenderingContext2D): void {
    // 获取 padding（支持数组）
    const padding = this._parsePadding(this.padding);

    // 检查是否需要处理溢出
    const shouldClip =
      this.textOverflow === "hide" ||
      (typeof this.textOverflow === "string" && this.textOverflow !== "show");
    const hasFixedSize =
      (Math.abs(this.width || 0) > 0 && !this.autoWidth) ||
      (Math.abs(this.height || 0) > 0 && !this.autoHeight);

    const gradientBounds =
      this.textOverflow === "show" ? this._getContentRenderBounds() : this.__layout.boxBounds;

    // ========== 阶段1：在 clip 之外绘制外阴影 ==========
    // 与 Leafer 官方 Text 一致：阴影不受 textOverflow 裁剪影响
    this._drawTextShadows(ctx, padding, gradientBounds);

    // ========== 阶段2：设置 clip（如果需要），绘制文字/描边/内阴影 ==========
    if (shouldClip && hasFixedSize) {
      ctx.save();
      const { width, height } = this.__layout.boxBounds;
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
    }

    this._drawTextContent(ctx, padding, gradientBounds);

    if (shouldClip && hasFixedSize) {
      // 如果是自定义省略符（如 '...'），绘制在右下角
      if (
        typeof this.textOverflow === "string" &&
        this.textOverflow !== "show" &&
        this.textOverflow !== "hide"
      ) {
        const { width, height } = this.__layout.boxBounds;
        const padding = this._parsePadding(this.padding);
        ctx.fillStyle = this._fillToString(this.fill);
        ctx.font = buildFontString(this.fontSize, this.fontFamily, this.fontWeight, this.italic);
        ctx.textBaseline = "alphabetic";
        // 位置按字号计算，不能硬编码
        const ellipsisWidth = ctx.measureText(this.textOverflow).width;
        const ex = Math.max(0, width - padding.right - ellipsisWidth);
        const ey = Math.max(this.fontSize, height - padding.bottom - this.fontSize * 0.25);
        ctx.fillText(this.textOverflow, ex, ey);
      }
      ctx.restore();
    }
  }

  /**
   * 绘制外阴影（在 clip 之外调用，阴影不受文本框裁剪）
   * 与 Leafer 官方一致：整体绘制所有文字到离屏 canvas，
   * spread 以文本框中心为原点做缩放，阴影是整体效果。
   */
  private _drawTextShadows(
    ctx: CanvasRenderingContext2D,
    padding: { top: number; right: number; bottom: number; left: number },
    _gradientBounds: any,
  ): void {
    // 收集所有阴影 effect（取第一个字符或全局的 shadow 配置）
    const globalShadows = this._normalizeShadowEffects(this.shadow);
    if (!globalShadows.length) return;

    // 文本内容区域（用于计算 spread 缩放中心和离屏 canvas 大小）
    const box = this.__layout.boxBounds;
    const contentW = box.width || 100;
    const contentH = box.height || 50;

    for (const effect of globalShadows) {
      this._drawOuterShadowWhole(ctx, effect, padding, contentW, contentH);
    }
  }

  /**
   * 整体绘制一个外阴影效果（大偏移法，与 Leafer 官方等价）
   * 原理：把文字画到离屏 canvas 的很远位置，通过 shadowOffset 把阴影拉回到正常位置，
   * 原始文字在 canvas 外面被自然裁掉，不需要 destination-out 擦除。
   * spread 以文本框中心为原点缩放（与 Leafer 官方 getShadowTransform 一致）
   */
  private _drawOuterShadowWhole(
    ctx: CanvasRenderingContext2D,
    effect: any,
    padding: { top: number; right: number; bottom: number; left: number },
    contentW: number,
    contentH: number,
  ): void {
    const blur = typeof effect?.blur === "number" ? effect.blur : 0;
    const spread = typeof effect?.spread === "number" ? effect.spread : 0;
    const realOffsetX = typeof effect?.x === "number" ? effect.x : 0;
    const realOffsetY = typeof effect?.y === "number" ? effect.y : 0;
    const color =
      this._colorToString(effect?.color) ||
      this._fillToString(effect?.color) ||
      "rgba(0, 0, 0, 0.5)";
    const blendMode = effect?.blendMode;

    // 离屏 canvas 大小：只需要容纳阴影（内容区 + blur + spread + offset 的扩展）
    const margin =
      blur * 2 + Math.abs(spread) * 2 + Math.max(Math.abs(realOffsetX), Math.abs(realOffsetY)) + 20;
    const canvasW = Math.ceil(contentW + margin * 2);
    const canvasH = Math.ceil(contentH + margin * 2);

    const offCanvas = this._getOrCreateOffscreenCanvas(canvasW, canvasH);
    const offCtx = offCanvas.getContext("2d");
    if (!offCtx) return;

    offCtx.clearRect(0, 0, canvasW, canvasH);

    // 大偏移量：把原始文字画到 canvas 外面（Y 方向向上偏移）
    const bigOffset = canvasH + contentH + 500;

    // 阴影在离屏 canvas 中的目标位置偏移
    const ox = margin;
    const oy = margin;

    offCtx.save();
    offCtx.textBaseline = "alphabetic";

    // 设置阴影属性：
    // 原始文字画在 y - bigOffset 处（canvas 外面）
    // shadowOffsetY = bigOffset + realOffsetY，把阴影拉回到 y + realOffsetY 处（canvas 内部）
    offCtx.shadowColor = color;
    offCtx.shadowBlur = blur;
    offCtx.shadowOffsetX = realOffsetX;
    offCtx.shadowOffsetY = bigOffset + realOffsetY;

    // spread 缩放（以文本框中心为原点，与 Leafer 官方一致）
    if (spread !== 0) {
      const scaleX = 1 + (spread * 2) / Math.max(contentW, 1);
      const scaleY = 1 + (spread * 2) / Math.max(contentH, 1);
      const cx = ox + contentW / 2;
      const cy = oy + contentH / 2 - bigOffset; // 缩放中心也跟着偏移
      offCtx.translate(cx, cy);
      offCtx.scale(scaleX, scaleY);
      offCtx.translate(-cx, -cy);
    }

    // 绘制所有文字到 canvas 外面（y - bigOffset）
    // 基线按行内最大字号计算，见 _measureText
    for (let lineIdx = 0; lineIdx < this._lineMetrics.length; lineIdx++) {
      const line = this._lineMetrics[lineIdx];
      const baseline = line.y + line.baseline;

      for (let charIdx = 0; charIdx < line.chars.length; charIdx++) {
        const char = line.chars[charIdx];
        const { x, style } = char;
        const finalX = ox + x + padding.left;
        const finalY = oy + baseline + padding.top - bigOffset; // 画到 canvas 外面

        const displayChar = this._applyTextCase(
          char.char,
          style.textCase,
          this._isWordStartInLine(this._lines[lineIdx] || [], charIdx),
        );

        offCtx.font = buildFontString(
          style.fontSize!,
          style.fontFamily!,
          style.fontWeight,
          style.italic,
        );
        offCtx.fillStyle = color;
        offCtx.fillText(displayChar, finalX, finalY);
      }
    }

    offCtx.restore();

    // 将纯阴影画到主 canvas（原始文字在 canvas 外面已被裁掉，只剩阴影）
    ctx.save();
    if (blendMode) ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
    ctx.drawImage(offCanvas, 0, 0, canvasW, canvasH, -margin, -margin, canvasW, canvasH);
    ctx.restore();
  }

  private _offscreenCanvas: HTMLCanvasElement | null = null;

  private _getOrCreateOffscreenCanvas(w: number, h: number): HTMLCanvasElement {
    if (!this._offscreenCanvas) {
      this._offscreenCanvas = document.createElement("canvas");
    }
    if (this._offscreenCanvas.width < w) this._offscreenCanvas.width = w;
    if (this._offscreenCanvas.height < h) this._offscreenCanvas.height = h;
    return this._offscreenCanvas;
  }

  /**
   * 绘制文字内容（填充、描边、内阴影、装饰线）
   * 在 clip 区域内调用
   */
  private _drawTextContent(
    ctx: CanvasRenderingContext2D,
    padding: { top: number; right: number; bottom: number; left: number },
    gradientBounds: any,
  ): void {
    // 基线按行内最大字号计算（见 _measureText），混合字号时各行分别对齐
    ctx.textBaseline = "alphabetic";

    for (let lineIdx = 0; lineIdx < this._lineMetrics.length; lineIdx++) {
      const line = this._lineMetrics[lineIdx];
      const baseline = line.y + line.baseline;

      // 调试模式：绘制基线和行框
      if (this.debugMode) {
        ctx.save();

        ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(padding.left, line.y + padding.top, 500, line.height);

        ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, baseline + padding.top);
        ctx.lineTo(padding.left + 500, baseline + padding.top);
        ctx.stroke();

        ctx.restore();
      }

      const lineTop = line.y + padding.top;

      for (let charIdx = 0; charIdx < line.chars.length; charIdx++) {
        const char = line.chars[charIdx];
        const { x, style } = char;

        const finalX = x + padding.left;
        const finalY = baseline + padding.top;

        ctx.save();
        if (style.rotation) {
          ctx.translate(finalX + char.width / 2, finalY);
          ctx.rotate((style.rotation * Math.PI) / 180);
          ctx.translate(-(finalX + char.width / 2), -finalY);
        }

        // 背景色
        if (style.textBackgroundColor) {
          const charAscent = style.fontSize! * 0.85;
          const charDescent = style.fontSize! * 0.15;
          const bgY = baseline - charAscent;
          const bgHeight = charAscent + charDescent;

          ctx.fillStyle = style.textBackgroundColor;
          ctx.fillRect(finalX, bgY + padding.top, char.width, bgHeight);
        }

        let displayChar = this._applyTextCase(
          char.char,
          style.textCase,
          this._isWordStartInLine(this._lines[lineIdx] || [], charIdx),
        );

        const stroke = (style as any).stroke;
        const strokeWidth = (style as any).strokeWidth ?? 0;
        const strokeAlign = (style as any).strokeAlign ?? this.strokeAlign ?? "outside";
        const strokeCap = (style as any).strokeCap as "none" | "round" | "square" | undefined;
        const strokeJoin = (style as any).strokeJoin as "miter" | "bevel" | "round" | undefined;
        const dashPattern = (style as any).dashPattern as number[] | undefined;
        const dashOffset = (style as any).dashOffset as number | undefined;
        const fillStyle = this._getFillStyle(ctx, style.fill, gradientBounds);
        const hasStroke =
          stroke && strokeWidth > 0 && !(Array.isArray(stroke) && stroke.length === 0);

        ctx.font = buildFontString(
          style.fontSize!,
          style.fontFamily!,
          style.fontWeight,
          style.italic,
        );

        if (hasStroke) {
          if (strokeAlign === "inside") {
            ctx.fillStyle = fillStyle;
            ctx.fillText(displayChar, finalX, finalY);

            ctx.save();
            ctx.globalCompositeOperation = "source-atop";
            ctx.strokeStyle = this._getFillStyle(ctx, stroke, gradientBounds);
            ctx.lineWidth = strokeWidth;
            if (strokeCap) ctx.lineCap = strokeCap === "none" ? "butt" : strokeCap;
            if (strokeJoin) ctx.lineJoin = strokeJoin;
            if (dashPattern && ctx.setLineDash) ctx.setLineDash(dashPattern);
            if (typeof dashOffset === "number") ctx.lineDashOffset = dashOffset;
            ctx.strokeText(displayChar, finalX, finalY);
            if (dashPattern && ctx.setLineDash) ctx.setLineDash([]);
            ctx.restore();
          } else if (strokeAlign === "outside") {
            ctx.save();
            ctx.strokeStyle = this._getFillStyle(ctx, stroke, gradientBounds);
            ctx.lineWidth = strokeWidth;
            if (strokeCap) ctx.lineCap = strokeCap === "none" ? "butt" : strokeCap;
            if (strokeJoin) ctx.lineJoin = strokeJoin;
            if (dashPattern && ctx.setLineDash) ctx.setLineDash(dashPattern);
            if (typeof dashOffset === "number") ctx.lineDashOffset = dashOffset;
            ctx.strokeText(displayChar, finalX, finalY);
            if (dashPattern && ctx.setLineDash) ctx.setLineDash([]);
            ctx.restore();

            ctx.fillStyle = fillStyle;
            ctx.fillText(displayChar, finalX, finalY);
          } else {
            ctx.fillStyle = fillStyle;
            ctx.fillText(displayChar, finalX, finalY);

            ctx.save();
            ctx.strokeStyle = this._getFillStyle(ctx, stroke, gradientBounds);
            ctx.lineWidth = strokeWidth;
            if (strokeCap) ctx.lineCap = strokeCap === "none" ? "butt" : strokeCap;
            if (strokeJoin) ctx.lineJoin = strokeJoin;
            if (dashPattern && ctx.setLineDash) ctx.setLineDash(dashPattern);
            if (typeof dashOffset === "number") ctx.lineDashOffset = dashOffset;
            ctx.strokeText(displayChar, finalX, finalY);
            if (dashPattern && ctx.setLineDash) ctx.setLineDash([]);
            ctx.restore();
          }
        } else {
          ctx.fillStyle = fillStyle;
          ctx.fillText(displayChar, finalX, finalY);
        }

        // 内阴影（在文字内部，随文字裁剪）
        const innerShadows = this._normalizeShadowEffects(
          (style as any).innerShadow ?? this.innerShadow,
        );
        if (innerShadows.length) {
          for (const effect of innerShadows) {
            this._drawInnerShadowForChar(
              ctx,
              effect,
              displayChar,
              finalX,
              finalY,
              lineTop,
              line.height,
              char.width,
              ctx.font,
            );
          }
        }

        // 装饰线在行级统一绘制（见 _drawLineDecorations），
        // 避免逐字符绘制在字间距处断线

        ctx.restore();
      }

      this._drawLineDecorations(ctx, line, baseline, padding);
    }
  }

  /**
   * 行级绘制装饰线：把相邻且装饰相同的字符合并为一段，避免字间距处断线
   */
  private _drawLineDecorations(
    ctx: CanvasRenderingContext2D,
    line: ILineMetrics,
    baseline: number,
    padding: { top: number; right: number; bottom: number; left: number },
  ): void {
    const chars = line.chars;
    if (!chars.length) return;

    ctx.save();

    let runStart = -1;
    let runKey = "";

    const flush = (endIdx: number) => {
      if (runStart < 0) return;
      const startChar = chars[runStart];
      const endChar = chars[endIdx];
      const x1 = startChar.x + padding.left;
      // 段末取下一个字符起点，从而覆盖内部字间距；行尾不多出
      const x2 =
        (endIdx + 1 < chars.length ? chars[endIdx + 1].x : endChar.x + endChar.width) +
        padding.left;

      this._drawTextDecoration(
        ctx,
        startChar.style,
        x1,
        baseline + padding.top,
        x2 - x1,
        line.height,
      );
      runStart = -1;
      runKey = "";
    };

    for (let i = 0; i < chars.length; i++) {
      const key = this._decorationKey(chars[i].style);

      if (!key) {
        flush(i - 1);
        continue;
      }
      if (runStart < 0) {
        runStart = i;
        runKey = key;
        continue;
      }
      if (key !== runKey) {
        flush(i - 1);
        runStart = i;
        runKey = key;
      }
    }
    flush(chars.length - 1);

    ctx.restore();
  }

  /**
   * 装饰线归一化标识：无装饰返回空串，用于合并相邻字符
   */
  private _decorationKey(style: ICharStyle): string {
    let decoration: any = style.textDecoration;

    if ((!decoration || decoration === "none") && (style.underline || style.linethrough)) {
      decoration =
        style.underline && style.linethrough
          ? "under-delete"
          : style.underline
            ? "under"
            : "delete";
    }
    if (!decoration || decoration === "none") return "";

    const type = typeof decoration === "object" ? decoration.type : decoration;
    if (!type || type === "none") return "";

    const color =
      typeof decoration === "object" ? this._colorToString(decoration.color) : undefined;
    const offset = typeof decoration === "object" ? decoration.offset || 0 : 0;

    return `${type}|${color ?? this._fillToString(style.fill)}|${offset}|${style.fontSize}`;
  }

  /**
   * 应用文本大小写转换
   * @param isWordStart 是否为单词首字符（textCase: 'title' 需要）
   */
  private _applyTextCase(
    char: string,
    textCase: ITextCase | undefined,
    isWordStart = true,
  ): string {
    if (!textCase || textCase === "none") return char;

    switch (textCase) {
      case "upper":
        return char.toUpperCase();
      case "lower":
        return char.toLowerCase();
      case "title":
        // 词首大写，其余小写
        return isWordStart ? char.toUpperCase() : char.toLowerCase();
      default:
        return char;
    }
  }

  /**
   * 绘制文本装饰线（下划线、删除线）
   * @param y 基线位置
   * @param style 字符样式
   */
  private _drawTextDecoration(
    ctx: CanvasRenderingContext2D,
    style: ICharStyle,
    x: number,
    y: number,
    width: number,
    _lineHeight: number,
  ): void {
    // 优先使用新的 textDecoration，兼容旧的 underline/linethrough
    let decoration = style.textDecoration;
    let decorationColor: string = this._fillToString(style.fill);
    let decorationOffset = 0;

    // 兼容旧属性（decoration 为空或 'none' 时，回退到 underline/linethrough）
    if ((!decoration || decoration === "none") && (style.underline || style.linethrough)) {
      if (style.underline && style.linethrough) {
        decoration = "under-delete";
      } else if (style.underline) {
        decoration = "under";
      } else {
        decoration = "delete";
      }
    }

    if (!decoration || decoration === "none") return;

    // 解析 textDecoration
    if (typeof decoration === "object") {
      decorationColor = this._colorToString(decoration.color) || decorationColor;
      decorationOffset = decoration.offset || 0;
      decoration = decoration.type;
    }

    ctx.strokeStyle = decorationColor;
    // 线宽随字号缩放，避免大字号下装饰线过细
    const fontSize = style.fontSize || this.fontSize;
    ctx.lineWidth = Math.max(1, Math.round(fontSize / 16));

    // 下划线（基线下方）
    if (decoration === "under" || decoration === "under-delete") {
      // Figma 标准：下划线在基线下方约 fontSize 的 12%，可通过 offset 调整
      const underlineY = y + Math.max(2, fontSize * 0.12) + decorationOffset;
      ctx.beginPath();
      ctx.moveTo(x, underlineY);
      ctx.lineTo(x + width, underlineY);
      ctx.stroke();
    }

    // 删除线（字符中部）
    if (decoration === "delete" || decoration === "under-delete") {
      // Figma 标准：删除线在字符高度的中部
      // 中部 = 基线 - (fontSize * 0.35) 约为字符高度的中间位置
      const deleteY = y - fontSize * 0.35 + decorationOffset;
      ctx.beginPath();
      ctx.moveTo(x, deleteY);
      ctx.lineTo(x + width, deleteY);
      ctx.stroke();
    }
  }

  /**
   * 将 IColor 转换为 CSS 颜色字符串
   */
  private _colorToString(color: any): string | undefined {
    if (!color) return undefined;
    if (typeof color === "string") return color;
    // 处理 RGB/RGBA 对象
    if (typeof color === "object") {
      if ("r" in color && "g" in color && "b" in color) {
        const a = "a" in color ? color.a : 1;
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${a})`;
      }
    }
    return String(color);
  }

  /**
   * 将 IFill 转换为 CSS 颜色字符串（简化处理）
   * 完整支持：纯色字符串
   * 简化支持：纯色对象（ISolidPaint）
   * 暂不支持：渐变、图像（降级为默认色）
   */
  private _fillToString(fill: IFill | undefined): string {
    if (!fill) return "#000";

    if (typeof fill === "string") return fill;

    if (Array.isArray(fill)) {
      const firstVisible = fill.find((p) => (p as any)?.visible !== false) || fill[0];
      return this._fillToString(firstVisible as any);
    }

    if (typeof fill === "object") {
      if ("type" in fill && fill.type === "solid" && "color" in fill) {
        return this._colorToString((fill as any).color) || "#000";
      }

      if ("type" in fill && (fill as any).stops) {
        const stops = (fill as any).stops as any[];
        const firstStop = Array.isArray(stops) ? stops[0] : null;
        if (firstStop) {
          const color = typeof firstStop === "string" ? firstStop : firstStop.color;
          return this._colorToString(color) || "#000";
        }
      }

      return "#000";
    }

    return "#000";
  }

  private _getFillStyle(
    ctx: CanvasRenderingContext2D,
    fill: IFill | IStroke | undefined,
    bounds: { x: number; y: number; width: number; height: number },
  ): string | CanvasGradient {
    if (!fill) return "#000";

    if (typeof fill === "string") return fill;

    const paint = Array.isArray(fill)
      ? fill.find((p) => (p as any)?.visible !== false) || fill[0]
      : fill;

    if (typeof paint !== "object" || !("type" in paint)) {
      return "#000";
    }

    if (paint.type === "solid" && "color" in paint) {
      return this._colorToString((paint as any).color) || "#000";
    }

    if (paint.type === "linear" || paint.type === "radial") {
      return this._createGradient(ctx, paint as any, bounds);
    }

    return "#000";
  }

  private _createGradient(
    ctx: CanvasRenderingContext2D,
    paint: { type: string; from?: any; to?: any; stops: any[] },
    bounds: { x: number; y: number; width: number; height: number },
  ): CanvasGradient {
    const from = this._resolveGradientPoint(paint.from, bounds, "left");
    const to = this._resolveGradientPoint(paint.to, bounds, "right");

    let gradient: CanvasGradient;
    if (paint.type === "radial") {
      const radius =
        Math.hypot(to.x - from.x, to.y - from.y) || Math.max(bounds.width, bounds.height) / 2;
      gradient = ctx.createRadialGradient(from.x, from.y, 0, to.x, to.y, radius);
    } else {
      gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    }

    const stops = paint.stops || [];
    if (stops.length) {
      if (typeof stops[0] === "string") {
        const count = stops.length;
        stops.forEach((color: string, index: number) => {
          const offset = count === 1 ? 0 : index / (count - 1);
          gradient.addColorStop(offset, this._colorToString(color) || "#000");
        });
      } else {
        stops.forEach((stop: any) => {
          const offset = Math.max(0, Math.min(1, stop.offset ?? 0));
          gradient.addColorStop(offset, this._colorToString(stop.color) || "#000");
        });
      }
    }

    return gradient;
  }

  private _resolveGradientPoint(
    point: any,
    bounds: { x: number; y: number; width: number; height: number },
    fallbackAlign: string,
  ): { x: number; y: number } {
    if (!point) return this._alignToPoint(fallbackAlign, bounds);

    if (typeof point === "string") {
      return this._alignToPoint(point, bounds);
    }

    if (typeof point === "object") {
      const x = this._resolveUnit(point.x, bounds.width, 0);
      const y = this._resolveUnit(point.y, bounds.height, 0);
      return { x: bounds.x + x, y: bounds.y + y };
    }

    return this._alignToPoint(fallbackAlign, bounds);
  }

  private _resolveUnit(value: any, size: number, fallback: number): number {
    if (typeof value === "number") {
      return value >= 0 && value <= 1 ? value * size : value;
    }

    if (value && typeof value === "object" && "value" in value) {
      const v = Number(value.value);
      if (value.type === "percent") return v * size;
      return v;
    }

    return fallback;
  }

  private _alignToPoint(
    align: string,
    bounds: { x: number; y: number; width: number; height: number },
  ): { x: number; y: number } {
    const xLeft = bounds.x;
    const xCenter = bounds.x + bounds.width / 2;
    const xRight = bounds.x + bounds.width;
    const yTop = bounds.y;
    const yCenter = bounds.y + bounds.height / 2;
    const yBottom = bounds.y + bounds.height;

    switch (align) {
      case "top-left":
        return { x: xLeft, y: yTop };
      case "top":
        return { x: xCenter, y: yTop };
      case "top-right":
        return { x: xRight, y: yTop };
      case "right":
        return { x: xRight, y: yCenter };
      case "bottom-right":
        return { x: xRight, y: yBottom };
      case "bottom":
        return { x: xCenter, y: yBottom };
      case "bottom-left":
        return { x: xLeft, y: yBottom };
      case "left":
        return { x: xLeft, y: yCenter };
      case "center":
      default:
        return { x: xCenter, y: yCenter };
    }
  }

  private _hasValidStroke(): boolean {
    const s = this.stroke;
    return !!(s && !(Array.isArray(s) && s.length === 0));
  }

  private _getStrokeExpand(): number {
    if (!this._hasValidStroke()) return 0;
    const width = this.strokeWidth || 0;
    if (!width) return 0;
    const align = this.strokeAlign || "outside";
    if (align === "inside") return 0;
    if (align === "center") return width / 2;
    return width;
  }

  /**
   * 计算内容级阴影扩展（考虑 spread 缩放导致的额外扩展）
   */
  private _getContentShadowExpand(): number {
    const box = this.__layout.boxBounds;
    const contentW = box.width || 100;
    const contentH = box.height || 50;
    const contentSize = Math.max(contentW, contentH);

    let maxExpand = 0;
    const allShadows = this._normalizeShadowEffects(this.shadow);

    // 也收集字符级 shadow
    if (this._styles.size) {
      for (const lineStyles of this._styles.values()) {
        for (const style of lineStyles.values()) {
          const s = (style as any).shadow;
          if (s) {
            const effects = this._normalizeShadowEffects(s);
            for (const e of effects) allShadows.push(e);
          }
        }
      }
    }

    for (const effect of allShadows) {
      const blur = typeof effect?.blur === "number" ? effect.blur : 0;
      const spread = Math.abs(typeof effect?.spread === "number" ? effect.spread : 0);
      const offsetX = typeof effect?.x === "number" ? effect.x : 0;
      const offsetY = typeof effect?.y === "number" ? effect.y : 0;

      // spread 通过 scale 实现：scaleRatio = 1 + spread*2/contentSize
      // 实际超出距离 = contentSize * (scaleRatio - 1) / 2 = spread
      // 但缩放后 blur 扩散范围也变大：blurExpand * scaleRatio
      const scaleRatio = spread > 0 ? 1 + (spread * 2) / Math.max(contentSize, 1) : 1;
      const blurExpand = blur * 1.5 * scaleRatio;

      const top = spread + blurExpand + Math.abs(offsetY);
      const right = spread + blurExpand + Math.abs(offsetX);
      const bottom = spread + blurExpand + Math.abs(offsetY);
      const left = spread + blurExpand + Math.abs(offsetX);
      const expand = Math.max(top, right, bottom, left);
      if (expand > maxExpand) maxExpand = expand;
    }

    return maxExpand;
  }

  private _normalizeShadowEffects(shadow: any): any[] {
    if (!shadow) return [];
    const effects = Array.isArray(shadow) ? shadow : [shadow];
    return effects.filter((effect) => effect && effect.visible !== false);
  }

  // _applyShadowToContext 已移入离屏 canvas 逻辑中（_drawOuterShadowForChar / _drawInnerShadowForChar）

  private _getShadowContext(width: number, height: number): CanvasRenderingContext2D | null {
    if (!this._shadowCanvas) {
      this._shadowCanvas = document.createElement("canvas");
      this._shadowCtx = this._shadowCanvas.getContext("2d");
    }
    if (!this._shadowCanvas || !this._shadowCtx) return null;
    if (this._shadowCanvas.width !== width) this._shadowCanvas.width = width;
    if (this._shadowCanvas.height !== height) this._shadowCanvas.height = height;
    return this._shadowCtx;
  }

  private _drawInnerShadowForChar(
    ctx: CanvasRenderingContext2D,
    effect: any,
    displayChar: string,
    finalX: number,
    finalY: number,
    lineTop: number,
    lineHeight: number,
    charWidth: number,
    font: string,
  ): void {
    const blur = typeof effect?.blur === "number" ? effect.blur : 0;
    const spread = typeof effect?.spread === "number" ? effect.spread : 0;
    const offsetX = typeof effect?.x === "number" ? effect.x : 0;
    const offsetY = typeof effect?.y === "number" ? effect.y : 0;
    const pad = Math.max(
      2,
      blur + Math.max(0, spread) + Math.max(Math.abs(offsetX), Math.abs(offsetY)) + 2,
    );
    const width = Math.ceil(charWidth + pad * 2);
    const height = Math.ceil(lineHeight + pad * 2);
    const shadowCtx = this._getShadowContext(width, height);
    if (!shadowCtx) return;

    shadowCtx.clearRect(0, 0, width, height);
    shadowCtx.save();
    shadowCtx.font = font;
    shadowCtx.textBaseline = "alphabetic";

    const baselineOffset = finalY - lineTop;
    const baseX = pad;
    const baseY = pad + baselineOffset;

    // 1) 先绘制文字遮罩（spread > 0 时缩小遮罩，让内阴影扩展更多）
    shadowCtx.fillStyle = "#ffffff";
    if (spread > 0) {
      shadowCtx.strokeStyle = "#ffffff";
      shadowCtx.lineWidth = spread * 2;
      shadowCtx.lineJoin = "round";
      shadowCtx.strokeText(displayChar, baseX, baseY);
    }
    shadowCtx.fillText(displayChar, baseX, baseY);

    // 2) 通过 source-in 将阴影限制在文字内部
    shadowCtx.globalCompositeOperation = "source-in";
    shadowCtx.shadowColor =
      this._colorToString(effect?.color) ||
      this._fillToString(effect?.color) ||
      "rgba(0, 0, 0, 0.5)";
    shadowCtx.shadowBlur = blur;
    shadowCtx.shadowOffsetX = offsetX;
    shadowCtx.shadowOffsetY = offsetY;
    shadowCtx.fillStyle = shadowCtx.shadowColor as string;
    shadowCtx.fillRect(0, 0, width, height);

    shadowCtx.restore();

    ctx.save();
    if (effect?.blendMode) ctx.globalCompositeOperation = effect.blendMode;
    ctx.drawImage(this._shadowCanvas as HTMLCanvasElement, finalX - baseX, finalY - baseY);
    ctx.restore();
  }

  /**
   * 获取文本对齐偏移和两端对齐的额外间距
   */
  private _getAlignOffsetAndSpacing(
    line: ILineMetrics,
    lineIdx: number,
    containerWidth: number,
  ): { alignOffset: number; extraSpacing: number } {
    // 行宽不含行末字间距，避免右对齐/两端对齐超出右边界
    const lineWidth = this._getLineContentWidth(line);
    const gap = containerWidth - lineWidth;

    // 空行只做水平对齐偏移，不参与两端对齐
    const isEmpty = line.chars.length === 0;

    switch (this.textAlign) {
      case "center":
        return { alignOffset: gap / 2, extraSpacing: 0 };

      case "right":
        return { alignOffset: gap, extraSpacing: 0 };

      case "justify":
      case "justify-letter":
        // 两端对齐（段落最后一行除外）
        if (!isEmpty && !this._paragraphEndLines.has(lineIdx) && line.chars.length > 1 && gap > 0) {
          // 将额外空间均分到字符间隔中
          const extraSpacing = gap / (line.chars.length - 1);
          return { alignOffset: 0, extraSpacing };
        }
        return { alignOffset: 0, extraSpacing: 0 };

      case "both":
      case "both-letter":
        // 强制两端对齐（包括最后一行）
        if (!isEmpty && line.chars.length > 1 && gap > 0) {
          const extraSpacing = gap / (line.chars.length - 1);
          return { alignOffset: 0, extraSpacing };
        }
        return { alignOffset: 0, extraSpacing: 0 };

      default:
        return { alignOffset: 0, extraSpacing: 0 };
    }
  }

  /**
   * 解析 padding（支持数字或数组）
   */
  private _parsePadding(padding: number | number[] | undefined): {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } {
    if (!padding) return { top: 0, right: 0, bottom: 0, left: 0 };

    if (typeof padding === "number") {
      return { top: padding, right: padding, bottom: padding, left: padding };
    }

    if (padding.length === 1) {
      return { top: padding[0], right: padding[0], bottom: padding[0], left: padding[0] };
    }
    if (padding.length === 2) {
      return { top: padding[0], right: padding[1], bottom: padding[0], left: padding[1] };
    }
    if (padding.length === 3) {
      return { top: padding[0], right: padding[1], bottom: padding[2], left: padding[1] };
    }
    return { top: padding[0], right: padding[1], bottom: padding[2], left: padding[3] };
  }

  private _drawSelection(ctx: CanvasRenderingContext2D): void {
    // 选区起点用 downstream、终点用 upstream，保证跨软换行时不会多高亮一行
    const start = this._linearToLocation(this.selectionStart, false);
    const end = this._linearToLocation(this.selectionEnd, true);

    const padding = this._parsePadding(this.padding);
    ctx.fillStyle = this.selectionColor;

    for (let lineIdx = start.lineIndex; lineIdx <= end.lineIndex; lineIdx++) {
      const line = this._lineMetrics[lineIdx];
      if (!line) continue;

      const isLastLine = lineIdx === end.lineIndex;
      const startChar = lineIdx === start.lineIndex ? start.charIndex : 0;
      const endChar = isLastLine ? end.charIndex : line.chars.length;

      // 选区终点正好落在本行行首：本行不属于选区
      if (isLastLine && lineIdx !== start.lineIndex && endChar <= 0) continue;

      // 行尾换行符/空行的占位宽度（按行内字号，不再硬编码 10px）
      const breakWidth = line.maxFontSize * 0.3;
      const lineEndX = this._getLineEndX(line);

      let x1: number;
      let x2: number;

      if (!line.chars.length) {
        // 空行：位置需要包含缩进与对齐偏移，宽度用换行占位宽度
        x1 = line.indent + line.alignOffset;
        x2 = x1 + breakWidth;
      } else if (startChar >= line.chars.length) {
        x1 = lineEndX;
        x2 = x1 + breakWidth;
      } else {
        x1 = line.chars[startChar].x;
        if (endChar <= 0) {
          x2 = x1;
        } else if (endChar >= line.chars.length) {
          x2 = lineEndX;
        } else {
          x2 = line.chars[endChar].x;
        }
      }

      // 中间行 / 起始行：若该行以硬换行结束，补上换行符的占位宽度
      if (!isLastLine && line.chars.length && this._lineHasNewline[lineIdx]) {
        x2 = lineEndX + breakWidth;
      }

      if (x2 > x1) {
        // 字符位置已包含对齐偏移，只需加 padding
        const finalX1 = x1 + padding.left;
        const finalY = line.y + padding.top;
        ctx.fillRect(finalX1, finalY, x2 - x1, line.height);
      }
    }
  }

  /** 行尾 x（最后一个字符右边缘，含其字间距） */
  private _getLineEndX(line: ILineMetrics): number {
    if (!line.chars.length) return line.indent + line.alignOffset;
    const lastChar = line.chars[line.chars.length - 1];
    const letterSpacing = this._parseLetterSpacing(
      lastChar.style.letterSpacing,
      lastChar.style.fontSize!,
    );
    return lastChar.x + lastChar.width + letterSpacing;
  }

  private _drawCursor(ctx: CanvasRenderingContext2D): void {
    const loc = this._caretLocation(this.selectionStart);
    const line = this._lineMetrics[loc.lineIndex];
    if (!line) return;

    const { x, y } = this._getCursorLocalPosition();

    ctx.globalAlpha = this._cursorOpacity;
    ctx.fillStyle = this.cursorColor;
    ctx.fillRect(x, y, this.cursorWidth, line.height);
  }

  private _getCursorLocalPosition(): { x: number; y: number } {
    if (this._pathMode !== TextPathMode.None) {
      const glyphs = this._getPathGlyphLayouts();
      const glyph = glyphs[Math.min(this.selectionStart, glyphs.length - 1)];
      if (glyph) return { x: glyph.x, y: glyph.y - this.fontSize };
    }
    return this._getLocalPositionForIndex(this.selectionStart, this._caretUpstream);
  }

  /**
   * 线性索引 → 局部坐标（含 padding），upstream 控制软换行行尾亲和
   */
  private _getLocalPositionForIndex(index: number, upstream: boolean): { x: number; y: number } {
    const loc = this._linearToLocation(index, upstream);
    const line = this._lineMetrics[loc.lineIndex];
    const padding = this._parsePadding(this.padding);
    if (!line) return { x: padding.left, y: padding.top };

    let x: number;
    if (!line.chars.length) {
      // 空行：缩进 + 对齐偏移
      x = line.indent + line.alignOffset;
    } else if (loc.charIndex <= 0) {
      x = line.chars[0].x;
    } else if (loc.charIndex >= line.chars.length) {
      x = this._getLineEndX(line);
    } else {
      x = line.chars[loc.charIndex].x;
    }

    return { x: x + padding.left, y: line.y + padding.top };
  }

  private _updateTextareaPosition(): void {
    if (!this._hiddenTextarea || !this.leafer) return;

    const view = (this.leafer as any).view as HTMLElement | undefined;
    if (!view || !view.getBoundingClientRect) return;

    const { x, y } = this._getCursorLocalPosition();
    const world = this._localToWorldPoint(x, y);
    const rect = view.getBoundingClientRect();

    const left = rect.left + world.x;
    const top = rect.top + world.y;

    if (Number.isFinite(left)) this._hiddenTextarea.style.left = `${left}px`;
    if (Number.isFinite(top)) this._hiddenTextarea.style.top = `${top}px`;
  }

  private _localToWorldPoint(x: number, y: number): { x: number; y: number } {
    const worldMatrix = (this.worldTransform || (this as any).__world) as any;
    if (!worldMatrix) return { x, y };

    const { a, b, c, d, e, f } = worldMatrix;
    return {
      x: a * x + c * y + e,
      y: b * x + d * y + f,
    };
  }

  // ============ 事件绑定 ============

  private _bindEvents(): void {
    // 注意：使用 Editor 时，点击事件由 Editor 管理
    // 我们需要监听 double_tap 来记录位置，在 Editor 触发 enterEditing 前

    this.on("double_tap", (e: any) => {
      if (this._selectedPathAnchorIndex !== null) return;
      const point = this.getInnerPoint(e);
      const index = this._pointerToIndex(point.x, point.y);
      this._pendingCursorPosition = index;

      // 如果已经在编辑状态，直接选词
      if (this.isEditing) {
        this._selectWord(index);
      }
    });

    this.on("pointer.down", (e: any) => {
      // 只有在已编辑状态才处理
      if (this.isEditing) {
        this._handlePointerDown(e);
      }
    });

    this.on("pointer.move", this._handlePointerMove.bind(this));
    this.on("pointer.up", this._handlePointerUp.bind(this));

    this.on("tap", (e: any) => {
      if (this.isEditing) {
        this._checkTripleTap(e);
      }
    });

    // ✅ 关键：在编辑状态下拦截键盘事件，防止传递到 Editor
    this.on("key.down", (e: any) => {
      if (this.isEditing) {
        // 阻止事件冒泡到 Editor（防止方向键移动元素）
        // Leafer API: 使用 stop() 代替 stopPropagation()
        if (e.stop) e.stop();
      }
    });

    this.on("key.up", (e: any) => {
      if (this.isEditing) {
        if (e.stop) e.stop();
      }
    });
  }

  /**
   * 公开方法：处理 pointer down（供 RichTextPlusEditor 调用）
   */
  public _handlePointerDown(e: any): void {
    if (!this.editable || !this.isEditing) return;

    if (e && typeof e === "object") {
      if (this._handledPointerDownEvents.has(e)) return;
      this._handledPointerDownEvents.add(e);
    }

    const point = this.getInnerPoint(e);
    if (this.pathEditing) {
      const hadSelectedAnchor = this._selectedPathAnchorIndex !== null;
      this._handlePathAnchorDoubleClick(point.x, point.y, e);
      if (hadSelectedAnchor || this._selectedPathAnchorIndex !== null) {
        this._isMouseDown = false;
        this._pathDragIndex = null;
        if (hadSelectedAnchor && this._selectedPathAnchorIndex === null) {
          this._hiddenTextarea?.focus();
        }
        return;
      }
    }
    if (this.pathEditing && this._beginPathControlDrag(point.x, point.y)) return;
    const index = this._pointerToIndex(point.x, point.y);

    if (e.shiftKey) {
      if (this._selectionAnchor === null) {
        this._selectionAnchor = this.selectionStart;
      }
      this.selectionStart = Math.min(this._selectionAnchor, index);
      this.selectionEnd = Math.max(this._selectionAnchor, index);
    } else {
      this._selectionAnchor = index;
      this.selectionStart = this.selectionEnd = index;
      this._isMouseDown = true;
    }

    this._updateTextarea();
    this.forceRender();
    this._notifySelectionChange();
  }

  /**
   * 处理指针移动（公开方法，供 RichTextPlusEditor 调用）
   */
  public _handlePointerMove(e: any): void {
    if (!this._isMouseDown || !this.isEditing) return;
    if (this._selectedPathAnchorIndex !== null) return;

    const point = this.getInnerPoint(e);
    if (this._pathDragIndex !== null) {
      this._movePathControl(point.x, point.y);
      return;
    }
    const index = this._pointerToIndex(point.x, point.y);

    if (this._selectionAnchor !== null) {
      this.selectionStart = Math.min(this._selectionAnchor, index);
      this.selectionEnd = Math.max(this._selectionAnchor, index);
    }

    this._updateTextarea();
    this.forceRender();
    this._notifySelectionChange();
  }

  /**
   * 处理指针抬起（公开方法，供 RichTextPlusEditor 调用）
   */
  public _handlePointerUp(_e: any): void {
    this._isMouseDown = false;
    this._pathDragIndex = null;
    if (this._pathChangedDuringDrag) {
      this._pathChangedDuringDrag = false;
      this._notifyPathChange();
    }
  }

  /** 开启路径编辑后，点击空白轨迹会新增锚点，点击锚点可拖动。 */
  public setPathEditing(value: boolean): void {
    this.pathEditing = value;
    if (!value) {
      this._selectedPathAnchorIndex = null;
      this._lastPathAnchorClick = null;
      this._stopListeningForSelectedPathAnchorKeys();
      this._hidePathAnchorMenu();
      if (this.isEditing && this._hiddenTextarea) {
        this._hiddenTextarea.value = String(this.text || "");
        this._updateTextarea();
        this._hiddenTextarea.focus();
      }
    }
    this.forceRender();
  }

  private _handlePathAnchorDoubleClick(x: number, y: number, event: any): void {
    if (this._pathMode === TextPathMode.Circle || this._pathMode === TextPathMode.Polygon) return;
    const anchors = this.pathAnchors ?? [];
    const threshold = Math.max(12, this.pathAnchorRadius + 4);
    let nearestIndex = -1;
    let nearestDistance = threshold;
    anchors.forEach((anchor, index) => {
      const distance = Math.hypot(x - anchor.x, y - anchor.y);
      if (distance <= nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });
    if (nearestIndex < 0) {
      this._lastPathAnchorClick = null;
      return;
    }
    const time = event?.origin?.timeStamp ?? event?.timeStamp ?? Date.now();
    const elapsed = this._lastPathAnchorClick ? time - this._lastPathAnchorClick.time : -1;
    const isDoubleClick =
      this._lastPathAnchorClick?.index === nearestIndex && elapsed > 0 && elapsed <= 400;
    this._lastPathAnchorClick = { index: nearestIndex, time };
    if (!isDoubleClick) return;
    this._selectedPathAnchorIndex =
      this._selectedPathAnchorIndex === nearestIndex ? null : nearestIndex;
    this._lastPathAnchorClick = null;
    if (this._selectedPathAnchorIndex === null) {
      this._stopListeningForSelectedPathAnchorKeys();
      this._hidePathAnchorMenu();
    } else {
      this._listenForSelectedPathAnchorKeys();
      if (this.pathAnchorMenuEnabled) this._showPathAnchorMenu(nearestIndex, x, y, event);
    }
    this.forceRender();
  }

  private _showPathAnchorMenu(index: number, x: number, y: number, event: any): void {
    if (typeof document === "undefined") return;
    this._hidePathAnchorMenu();

    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.setAttribute("data-rich-text-path-anchor-menu", "true");
    menu.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "box-sizing:border-box",
      `background:${this.pathAnchorMenuBackground}`,
      `color:${this.pathAnchorMenuColor}`,
      `border:1px solid ${this.pathAnchorMenuBorderColor}`,
      `border-radius:${this.pathAnchorMenuBorderRadius}px`,
      `padding:${this.pathAnchorMenuPadding}`,
      `box-shadow:${this.pathAnchorMenuShadow}`,
    ].join(";");

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.textContent = "删除锚点";
    button.style.cssText = [
      "display:block",
      "min-width:88px",
      "min-height:44px",
      "border:0",
      "padding:4px 8px",
      "background:transparent",
      `color:${this.pathAnchorMenuDeleteColor}`,
      "font-family:inherit",
      `font-size:${this.pathAnchorMenuFontSize}px`,
      "text-align:left",
      "cursor:pointer",
      "touch-action:manipulation",
    ].join(";");
    button.addEventListener("click", () => {
      if (this._selectedPathAnchorIndex === index) this.removePathAnchor(index);
      this._hidePathAnchorMenu();
    });
    menu.appendChild(button);
    document.body.appendChild(menu);
    this._pathAnchorMenuElement = menu;
    document.addEventListener("pointerdown", this._onPathAnchorMenuOutsidePointerDown, true);

    const origin = event?.origin ?? event;
    const view = (this.leafer as any)?.view as HTMLElement | undefined;
    const rect = view?.getBoundingClientRect?.();
    const world = this._localToWorldPoint(x, y);
    const clientX = Number.isFinite(origin?.clientX) ? origin.clientX : (rect?.left ?? 0) + world.x;
    const clientY = Number.isFinite(origin?.clientY) ? origin.clientY : (rect?.top ?? 0) + world.y;
    const left = Math.max(4, Math.min(clientX, window.innerWidth - menu.offsetWidth - 4));
    const top = Math.max(4, Math.min(clientY, window.innerHeight - menu.offsetHeight - 4));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  private _hidePathAnchorMenu(): void {
    if (typeof document !== "undefined") {
      document.removeEventListener("pointerdown", this._onPathAnchorMenuOutsidePointerDown, true);
    }
    this._pathAnchorMenuElement?.remove();
    this._pathAnchorMenuElement = null;
  }

  private _listenForSelectedPathAnchorKeys(): void {
    document.addEventListener("keydown", this._onSelectedPathAnchorKeyDown, true);
  }

  private _stopListeningForSelectedPathAnchorKeys(): void {
    document.removeEventListener("keydown", this._onSelectedPathAnchorKeyDown, true);
  }

  public setPathAnchors(anchors: IPathAnchor[], closed = this.pathClosed): void {
    this._pathGenerator = undefined;
    this._pathMode = TextPathMode.Custom;
    this.pathClosed = closed;
    this.pathAnchors = anchors.map((anchor) => ({
      ...anchor,
      handleIn: anchor.handleIn ? { ...anchor.handleIn } : undefined,
      handleOut: anchor.handleOut ? { ...anchor.handleOut } : undefined,
    }));
    this._configuredPathAppearance.add("textPath");
    this._configuredPathAppearance.add("pathClosed");
    this._configuredPathAppearance.add("pathAnchors");
    this._notifyPathChange();
    this._relayout();
  }

  /** 注册运行时路径生成器；返回的坐标相对文字节点原点，回调不会写入 JSON。 */
  public setPathGenerator(generator?: ITextPathGenerator): void {
    this._pathGenerator = generator;
    if (generator) {
      this._pathMode = TextPathMode.Custom;
      this.pathEditing = false;
      this._configuredPathAppearance.add("textPath");
    }
    this._relayout();
  }

  public addPathAnchor(anchor: IPathAnchor, index = this.pathAnchors?.length ?? 0): void {
    const anchors = [...(this.pathAnchors ?? [])];
    anchors.splice(Math.max(0, Math.min(anchors.length, index)), 0, { ...anchor });
    this.setPathAnchors(anchors);
  }

  public removePathAnchor(index: number): void {
    const anchors = [...(this.pathAnchors ?? [])];
    if (index < 0 || index >= anchors.length) return;
    anchors.splice(index, 1);
    this._selectedPathAnchorIndex = null;
    this._lastPathAnchorClick = null;
    this._stopListeningForSelectedPathAnchorKeys();
    this._hidePathAnchorMenu();
    this.setPathAnchors(anchors);
  }

  /** 把圆形预设转换为四段三次贝塞尔曲线，之后可自由增删和拖动锚点。 */
  public convertCircleToPath(): void {
    const radius = Math.max(1, this.pathRadius);
    const handle = radius * 0.5522847498;
    this.setPathAnchors(
      [
        { x: 0, y: -radius, handleIn: { x: -handle, y: 0 }, handleOut: { x: handle, y: 0 } },
        { x: radius, y: 0, handleIn: { x: 0, y: -handle }, handleOut: { x: 0, y: handle } },
        { x: 0, y: radius, handleIn: { x: handle, y: 0 }, handleOut: { x: -handle, y: 0 } },
        { x: -radius, y: 0, handleIn: { x: 0, y: handle }, handleOut: { x: 0, y: -handle } },
      ],
      true,
    );
  }

  private _beginPathControlDrag(x: number, y: number): boolean {
    const threshold = 12;
    if (this._pathMode === TextPathMode.Circle || this._pathMode === TextPathMode.Polygon) {
      const hit = Math.hypot(x, y);
      if (Math.abs(hit - this.pathRadius) <= threshold) {
        this._pathDragIndex = 0;
        this._isMouseDown = true;
        return true;
      }
      return false;
    }
    const anchors = this.pathAnchors ?? [];
    let nearest = -1;
    let nearestDistance = threshold;
    anchors.forEach((anchor, index) => {
      for (const handle of ["handleIn", "handleOut"] as const) {
        const point = anchor[handle];
        if (!point) continue;
        const current = Math.hypot(x - anchor.x - point.x, y - anchor.y - point.y);
        if (current <= nearestDistance) {
          nearest = index;
          nearestDistance = current;
          this._pathDragHandle = handle === "handleIn" ? "in" : "out";
        }
      }
      const current = Math.hypot(x - anchor.x, y - anchor.y);
      if (current <= nearestDistance) {
        nearest = index;
        nearestDistance = current;
        this._pathDragHandle = "anchor";
      }
    });
    if (nearest >= 0) {
      this._pathDragIndex = nearest;
      this._isMouseDown = true;
      return true;
    }
    const samples = this._getPathSamples();
    let closestSample = -1;
    let closestDistance = threshold * threshold * 4;
    samples.forEach((sample, index) => {
      const dx = sample.x - x;
      const dy = sample.y - y;
      const candidate = dx * dx + dy * dy;
      if (candidate < closestDistance) {
        closestDistance = candidate;
        closestSample = index;
      }
    });
    if (anchors.length < 32 && closestSample >= 0) {
      const segment = Math.min(
        anchors.length - 1,
        Math.floor(closestSample / Math.max(1, samples.length / Math.max(1, anchors.length - 1))),
      );
      const index = Math.max(0, segment + 1);
      const nextAnchors = [...anchors];
      nextAnchors.splice(index, 0, { x, y });
      this.pathAnchors = nextAnchors;
      this._pathDragIndex = index;
      this._pathDragHandle = "anchor";
      this._pathChangedDuringDrag = true;
      this._isMouseDown = true;
      this._relayout();
      return true;
    }
    return false;
  }

  private _movePathControl(x: number, y: number): void {
    if (this._pathDragIndex === null) return;
    if (this._pathMode === TextPathMode.Circle || this._pathMode === TextPathMode.Polygon) {
      this.pathRadius = Math.max(8, Math.hypot(x, y));
      this._configuredPathAppearance.add("pathRadius");
      this._pathChangedDuringDrag = true;
    } else {
      this.pathAnchors = movePathAnchor(
        this.pathAnchors ?? [],
        this._pathDragIndex,
        this._pathDragHandle,
        x,
        y,
      );
      this._pathChangedDuringDrag = true;
    }
    // 拖动只改变路径几何，复用已测量的字形，避免每个指针事件都重排整段文本。
    this.__layout.boxChanged || this.__layout.boxChange();
    this.forceUpdate();
    this.forceRender();
  }

  private _notifyPathChange(): void {
    this.onPathChange?.({
      textPath: {
        mode: this._pathMode,
        radius: this.pathRadius,
        startAngle: this.pathStartAngle,
        direction: this.pathDirection,
        side: this.pathSide,
        align: this.pathAlign,
        closed: this.pathClosed,
        anchors: (this.pathAnchors ?? []).map((anchor) => ({
          ...anchor,
          handleIn: anchor.handleIn ? { ...anchor.handleIn } : undefined,
          handleOut: anchor.handleOut ? { ...anchor.handleOut } : undefined,
        })),
      },
    });
  }

  // 三击选行（监听 tap 事件计数实现）
  private _tapCount = 0;
  private _lastTapTime = 0;

  private _checkTripleTap(e: any): void {
    if (!this.isEditing) return;

    const now = Date.now();
    if (now - this._lastTapTime < 500) {
      this._tapCount++;
    } else {
      this._tapCount = 1;
    }
    this._lastTapTime = now;

    if (this._tapCount === 3) {
      const point = this.getInnerPoint(e);
      const index = this._pointerToIndex(point.x, point.y);
      this._selectLine(index);
    }
  }

  // ============ 编辑模式 ============

  /**
   * 进入编辑模式
   * @param cursorPosition 可选的初始光标位置（用于双击等场景）
   */
  public enterEditing(cursorPosition?: number): void {
    if (this.isEditing || !this.editable) return;

    // 确保文本已初始化（空文本也要有一行 metrics，否则看不到光标）
    if (!this._lineMetrics.length) {
      this._updateGraphemes();
      this._measureText();
    }

    // 通知管理器，退出其他编辑器
    EditingManager.requestEditing(this);

    this.isEditing = true;

    // ✅ 关键：进入编辑时禁用元素拖拽，避免键盘事件移动元素
    // 保存原始 draggable 状态
    this._savedDraggable = this.draggable;
    this.draggable = false;

    // 设置光标位置（优先使用参数，其次使用待定位置）
    const targetPosition =
      cursorPosition !== undefined
        ? cursorPosition
        : this._pendingCursorPosition !== null
          ? this._pendingCursorPosition
          : undefined;

    if (targetPosition !== undefined) {
      this.selectionStart = this.selectionEnd = Math.max(
        0,
        Math.min(targetPosition, this._graphemes.length),
      );
      this._pendingCursorPosition = null;
    }

    this._createHiddenTextarea();
    this._startCursorBlink();

    this.forceRender();

    // 触发回调
    if (this.onEditingEntered) {
      this.onEditingEntered();
    }

    // 尝试触发 Leafer 事件（可能会失败，不影响功能）
    setTimeout(() => {
      if (this.leafer && this.isEditing) {
        try {
          this.emit("editing:entered" as any);
        } catch (_err) {
          // 忽略 emit 错误，使用回调即可
        }
      }
    }, 0);
  }

  public exitEditing(): void {
    if (!this.isEditing) return;

    this._hidePathAnchorMenu();
    this._stopListeningForSelectedPathAnchorKeys();
    this._selectedPathAnchorIndex = null;
    this.isEditing = false;

    // ✅ 恢复原始 draggable 状态
    if (this._savedDraggable !== undefined) {
      this.draggable = this._savedDraggable;
      this._savedDraggable = undefined;
    }
    this._destroyHiddenTextarea();
    this._stopCursorBlink();
    this.selectionStart = this.selectionEnd = 0;
    this._notifySelectionChange();

    // 清除管理器状态
    EditingManager.clearActive(this);

    this.forceRender();

    // 触发回调
    if (this.onEditingExited) {
      this.onEditingExited();
    }

    // 尝试触发 Leafer 事件（可能会失败，不影响功能）
    setTimeout(() => {
      if (this.leafer) {
        try {
          this.emit("editing:exited" as any);
        } catch (_err) {
          // 忽略 emit 错误，使用回调即可
        }
      }
    }, 0);
  }

  /**
   * 重新聚焦（用于点击面板后恢复焦点）
   */
  public refocus(): void {
    if (this.isEditing && this._hiddenTextarea) {
      this._hiddenTextarea.focus();
    }
  }

  // ============ Hidden Textarea ============

  private _createHiddenTextarea(): void {
    if (this._hiddenTextarea) return;

    const textarea = document.createElement("textarea");

    textarea.autocapitalize = "off";
    textarea.autocomplete = "off";
    textarea.spellcheck = false;
    textarea.setAttribute("data-rich-text-plus-editor", "true");
    textarea.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      opacity: 0;
      width: 1px;
      height: 1px;
      pointer-events: none;
    `;

    textarea.value = String(this.text || "");
    textarea.selectionStart = this._graphemeIndexToCodeUnit(this.selectionStart);
    textarea.selectionEnd = this._graphemeIndexToCodeUnit(this.selectionEnd);

    document.body.appendChild(textarea);

    document.addEventListener("mousedown", this._onDocMouseDownCaptureForPanel, true);

    // 事件监听
    textarea.addEventListener("input", this._onInput.bind(this));
    textarea.addEventListener("beforeinput", (e: InputEvent) => {
      if (this.pathEditing || this._selectedPathAnchorIndex !== null) e.preventDefault();
    });
    textarea.addEventListener("keydown", this._onKeyDown.bind(this));
    textarea.addEventListener("compositionstart", () => {
      this._inComposition = true;
      this._compositionSnapshotRecorded = false;
    });
    textarea.addEventListener("compositionupdate", () => {
      // 组合输入时也同步（用于显示候选/预编辑文本）
      this._onInput(true);
    });
    textarea.addEventListener("compositionend", () => {
      this._inComposition = false;
      this._onInput(true);
      this._compositionSnapshotRecorded = false;
    });
    textarea.addEventListener("blur", (e: FocusEvent) => {
      // 焦点已移到属性面板内（含 select），不要抢回
      const related = e.relatedTarget as HTMLElement | null;
      if (related && (related.closest?.("[data-rt-panel]") || related.closest?.(".panel"))) {
        return;
      }
      setTimeout(() => {
        if (!this.isEditing) return;
        if (!this._hiddenTextarea) return;

        // mousedown 已在面板上时，部分浏览器 blur 时 relatedTarget 仍为空，用此标志兜底
        if (this._panelMouseDown) {
          this._panelMouseDown = false;
          return;
        }

        const activeEl = document.activeElement as HTMLElement | null;
        if (!activeEl || activeEl === this._hiddenTextarea) return;

        const inPanel = activeEl.closest?.("[data-rt-panel]") || activeEl.closest?.(".panel");
        const isTextEntry =
          activeEl.tagName === "INPUT" ||
          activeEl.tagName === "SELECT" ||
          activeEl.tagName === "TEXTAREA";
        if (inPanel && isTextEntry) return;

        this._hiddenTextarea?.focus();
      }, 100);
    });

    this._hiddenTextarea = textarea;
    this._updateTextareaPosition();

    // 延迟聚焦，避免立即 blur
    setTimeout(() => {
      if (this._hiddenTextarea) {
        this._updateTextareaPosition();
        this._hiddenTextarea.focus();
      }
    }, 0);
  }

  private _destroyHiddenTextarea(): void {
    document.removeEventListener("mousedown", this._onDocMouseDownCaptureForPanel, true);
    this._panelMouseDown = false;
    if (this._hiddenTextarea) {
      this._hiddenTextarea.blur();
      this._hiddenTextarea.remove();
      this._hiddenTextarea = null;
    }
  }

  /**
   * 将 grapheme 索引转换为 UTF-16 code unit 索引（用于 textarea）
   */
  private _graphemeIndexToCodeUnit(graphemeIndex: number): number {
    const text = String(this.text || "");
    if (!text || graphemeIndex <= 0) return 0;

    // 确保 graphemes 已初始化
    if (!this._graphemes.length) {
      this._updateGraphemes();
    }

    if (graphemeIndex >= this._graphemes.length) return text.length;

    let codeUnitIndex = 0;
    for (let i = 0; i < graphemeIndex && i < this._graphemes.length; i++) {
      codeUnitIndex += this._graphemes[i].length;
    }

    return Math.min(codeUnitIndex, text.length);
  }

  /**
   * 将 UTF-16 code unit 索引转换为 grapheme 索引
   */
  private _codeUnitToGraphemeIndex(codeUnitIndex: number): number {
    const text = String(this.text || "");
    if (!text || codeUnitIndex <= 0) return 0;

    // 确保 graphemes 已初始化
    if (!this._graphemes.length) {
      this._updateGraphemes();
    }

    if (codeUnitIndex >= text.length) return this._graphemes.length;

    let charCount = 0;
    let graphemeIndex = 0;

    for (const grapheme of this._graphemes) {
      if (charCount >= codeUnitIndex) break;
      charCount += grapheme.length;
      graphemeIndex++;
    }

    return Math.min(graphemeIndex, this._graphemes.length);
  }

  private _codeUnitToGraphemeIndexWith(
    text: string,
    graphemes: string[],
    codeUnitIndex: number,
  ): number {
    if (!text || codeUnitIndex <= 0) return 0;
    if (!graphemes.length) return 0;
    if (codeUnitIndex >= text.length) return graphemes.length;

    let charCount = 0;
    let graphemeIndex = 0;

    for (const grapheme of graphemes) {
      if (charCount >= codeUnitIndex) break;
      charCount += grapheme.length;
      graphemeIndex++;
    }

    return Math.min(graphemeIndex, graphemes.length);
  }

  private _updateTextarea(): void {
    if (!this._hiddenTextarea || this._inComposition) return;

    this._hiddenTextarea.selectionStart = this._graphemeIndexToCodeUnit(this.selectionStart);
    this._hiddenTextarea.selectionEnd = this._graphemeIndexToCodeUnit(this.selectionEnd);
    this._updateTextareaPosition();
  }

  private _onInput(forceOrEvent?: boolean | Event): void {
    const force = typeof forceOrEvent === "boolean" ? forceOrEvent : false;
    if ((this.pathEditing || this._selectedPathAnchorIndex !== null) && this._hiddenTextarea) {
      this._hiddenTextarea.value = String(this.text || "");
      this._hiddenTextarea.selectionStart = this._graphemeIndexToCodeUnit(this.selectionStart);
      this._hiddenTextarea.selectionEnd = this._graphemeIndexToCodeUnit(this.selectionEnd);
      return;
    }
    if (!this._hiddenTextarea || (this._inComposition && !force)) return;

    // 粘贴进来的 \r\n / \r 需要归一化，否则 \r 会被当普通字符参与排版
    const rawValue = this._hiddenTextarea.value;
    const normalized = rawValue.indexOf("\r") >= 0 ? rawValue.replace(/\r\n?/g, "\n") : rawValue;
    if (normalized !== rawValue) {
      const caret = this._hiddenTextarea.selectionStart;
      const delta = rawValue.length - normalized.length;
      this._hiddenTextarea.value = normalized;
      const newCaret = Math.max(0, caret - delta);
      this._hiddenTextarea.selectionStart = this._hiddenTextarea.selectionEnd = newCaret;
    }

    const newText = this._hiddenTextarea.value;
    const oldText = String(this.text || "");

    if (newText === oldText) {
      this.selectionStart = this._codeUnitToGraphemeIndex(this._hiddenTextarea.selectionStart);
      this.selectionEnd = this._codeUnitToGraphemeIndex(this._hiddenTextarea.selectionEnd);
      this._notifySelectionChange();
      return;
    }

    const isCompositionEvent = this._inComposition || force;
    if (isCompositionEvent) {
      if (!this._compositionSnapshotRecorded) {
        this._recordSnapshot();
        this._compositionSnapshotRecorded = true;
      }
    } else {
      // 连续键入合并为一个撤销步骤
      this._recordSnapshot({ coalesce: true });
    }

    // 文本 diff + 样式迁移（参考 Fabric 思路）
    const oldG = this._graphemes;
    const newG = graphemeSplit(newText);

    // 找出公共前缀
    let prefix = 0;
    while (prefix < oldG.length && prefix < newG.length && oldG[prefix] === newG[prefix]) {
      prefix++;
    }

    // 找出公共后缀
    let suffix = 0;
    while (
      suffix < oldG.length - prefix &&
      suffix < newG.length - prefix &&
      oldG[oldG.length - 1 - suffix] === newG[newG.length - 1 - suffix]
    ) {
      suffix++;
    }

    const removedCount = oldG.length - prefix - suffix;
    const insertedCount = newG.length - prefix - suffix;

    // 先迁移样式（用旧的 _lines），然后再更新 text
    this._shiftStylesBeforeTextChange(prefix, removedCount, insertedCount);

    // 更新文本（会触发 _updateGraphemes 和 _splitLines）
    this.text = newText;
    this.selectionStart = this._codeUnitToGraphemeIndexWith(
      newText,
      newG,
      this._hiddenTextarea.selectionStart,
    );
    this.selectionEnd = this._codeUnitToGraphemeIndexWith(
      newText,
      newG,
      this._hiddenTextarea.selectionEnd,
    );
    this._notifySelectionChange();
    this._caretUpstream = false;
    this._goalX = null;

    this.forceUpdate();
    this.forceRender();
    this._updateTextareaPosition();
  }

  /**
   * 样式迁移：插入/删除时调整样式索引（在文本变化前调用）
   */
  private _shiftStylesBeforeTextChange(
    start: number,
    removedCount: number,
    insertedCount: number,
  ): void {
    if (removedCount === 0 && insertedCount === 0) return;

    // 1. 收集旧文本的线性样式（用当前的 _lines）
    const oldLinearStyles = new Map<number, ICharStyle>();
    for (const [lineIdx, lineStyles] of this._styles.entries()) {
      for (const [charIdx, style] of lineStyles.entries()) {
        const linear = this._locationToLinear(lineIdx, charIdx);
        oldLinearStyles.set(linear, { ...style });
      }
    }

    // 2. 在线性空间中偏移样式索引
    const newLinearStyles = new Map<number, ICharStyle>();
    const delta = insertedCount - removedCount;

    for (const [index, style] of oldLinearStyles.entries()) {
      let newIndex: number;

      if (index < start) {
        // 插入/删除位置之前的样式：不变
        newIndex = index;
      } else if (index >= start + removedCount) {
        // 插入/删除位置之后的样式：整体偏移
        newIndex = index + delta;
      } else {
        continue;
      }

      newLinearStyles.set(newIndex, style);
    }

    // 3. 插入字符：继承前一字符样式（行首时继承被替换/后继字符的样式）
    // ⚠️ 不能用 oldLinearStyles.size 判边界：它是“有样式的字符数”，不是文本长度
    if (insertedCount > 0) {
      const refIndex = start > 0 ? start - 1 : start + removedCount;
      const refStyle = oldLinearStyles.get(refIndex);

      if (refStyle) {
        for (let i = 0; i < insertedCount; i++) {
          newLinearStyles.set(start + i, { ...refStyle });
        }
      }
    }

    // 4. 保存为临时线性样式（稍后转换到新的 2D 坐标）
    this._pendingLinearStyles = newLinearStyles;
  }

  /**
   * 将线性样式转换为 2D 样式（在文本更新后调用）
   */
  private _applyPendingStyles(): void {
    if (!this._pendingLinearStyles) return;

    const newStyles: StyleMap = new Map();

    for (const [linearIndex, style] of this._pendingLinearStyles.entries()) {
      const loc = this._linearToLocation(linearIndex);

      if (!newStyles.has(loc.lineIndex)) {
        newStyles.set(loc.lineIndex, new Map());
      }
      newStyles.get(loc.lineIndex)!.set(loc.charIndex, style);
    }

    this._styles = newStyles;
    this._pendingLinearStyles = null;
  }

  private _onKeyDown(e: KeyboardEvent): void {
    const isMod = e.ctrlKey || e.metaKey;

    if (this._selectedPathAnchorIndex !== null) {
      if (!this.pathAnchorMenuEnabled && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        this.removePathAnchor(this._selectedPathAnchorIndex);
      } else {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (this.pathEditing && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 输入法组合期间不拦截任何按键，交给 IME 处理（Esc 用于取消候选）
    if (this._inComposition || (e as any).isComposing) return;

    // 修饰键组合
    if (isMod) {
      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          this.selectAll();
          return;
        case "z":
          e.preventDefault();
          if (e.shiftKey) this.redo();
          else this.undo();
          return;
        case "arrowleft":
          e.preventDefault();
          this._moveByWord(-1, e.shiftKey);
          return;
        case "arrowright":
          e.preventDefault();
          this._moveByWord(1, e.shiftKey);
          return;
      }
    }

    // 方向键导航
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        this._moveCursor(-1, e.shiftKey);
        break;
      case "ArrowRight":
        e.preventDefault();
        this._moveCursor(1, e.shiftKey);
        break;
      case "ArrowUp":
        e.preventDefault();
        this._moveVertical(-1, e.shiftKey);
        break;
      case "ArrowDown":
        e.preventDefault();
        this._moveVertical(1, e.shiftKey);
        break;
      case "Home":
        e.preventDefault();
        this._moveToLineEnd(true, e.shiftKey);
        break;
      case "End":
        e.preventDefault();
        this._moveToLineEnd(false, e.shiftKey);
        break;
      case "Escape":
        e.preventDefault();
        this.exitEditing();
        break;
      case "Tab":
        // 不要让默认行为把焦点移出隐藏 textarea，导致编辑意外中断
        e.preventDefault();
        break;
    }
  }

  // ============ 键盘导航 ============

  private _moveCursor(direction: -1 | 1, expand: boolean): void {
    let newPos = direction < 0 ? this.selectionStart : this.selectionEnd;

    this._caretUpstream = false;
    this._goalX = null;

    if (!expand && this.selectionStart !== this.selectionEnd) {
      this.selectionStart = this.selectionEnd = newPos;
      this._selectionAnchor = null;
    } else {
      newPos = Math.max(0, Math.min(newPos + direction, this._graphemes.length));
      this._updateSelection(newPos, expand);
    }

    this._updateTextarea();
    this.forceRender();
  }

  private _moveVertical(direction: -1 | 1, expand: boolean): void {
    const baseIndex = direction < 0 ? this.selectionStart : this.selectionEnd;
    const loc = this._caretLocation(baseIndex);
    const targetLineIdx = Math.max(0, Math.min(loc.lineIndex + direction, this._lines.length - 1));

    if (targetLineIdx === loc.lineIndex) return;

    // 记忆目标 x（列），避免经过短行后列位被吃掉
    if (this._goalX === null) {
      const padding = this._parsePadding(this.padding);
      this._goalX = this._getLocalPositionForIndex(baseIndex, this._caretUpstream).x - padding.left;
    }
    const goalX = this._goalX;

    const targetMetrics = this._lineMetrics[targetLineIdx];
    let targetCharIndex: number;
    if (targetMetrics) {
      targetCharIndex = this._xToCharIndex(targetMetrics, goalX);
    } else {
      targetCharIndex = Math.min(loc.charIndex, this._lines[targetLineIdx].length);
    }

    // 软换行行尾需要 upstream 亲和，否则光标会显示在再下一行行首
    const targetLine = this._lines[targetLineIdx];
    this._caretUpstream =
      targetCharIndex >= targetLine.length &&
      targetLine.length > 0 &&
      !this._lineHasNewline[targetLineIdx] &&
      targetLineIdx < this._lines.length - 1;

    const newPos = this._locationToLinear(targetLineIdx, targetCharIndex);

    this._updateSelection(newPos, expand);
    this._goalX = goalX;
    this._updateTextarea();
    this.forceRender();
  }

  private _moveToLineEnd(toStart: boolean, expand: boolean): void {
    const baseIndex = toStart ? this.selectionStart : this.selectionEnd;
    const loc = this._caretLocation(baseIndex);
    const lineStart = this._locationToLinear(loc.lineIndex, 0);
    const lineLength = this._lines[loc.lineIndex]?.length || 0;
    const lineEnd = lineStart + lineLength;

    this._goalX = null;
    // End 键停在本行行尾（软换行时不能跳到下一行行首）
    this._caretUpstream = !toStart && !this._lineHasNewline[loc.lineIndex];

    this._updateSelection(toStart ? lineStart : lineEnd, expand);
    this._updateTextarea();
    this.forceRender();
  }

  private _moveByWord(direction: -1 | 1, expand: boolean): void {
    const baseIndex = direction < 0 ? this.selectionStart : this.selectionEnd;
    const text = this._graphemes;

    this._caretUpstream = false;
    this._goalX = null;

    let index = baseIndex;

    if (direction > 0) {
      // 向右：先跳过当前词，再跳过后续分隔符
      while (index < text.length && !this._isWordBoundaryChar(text[index])) index++;
      while (index < text.length && this._isWordBoundaryChar(text[index])) index++;
    } else {
      // 向左：先跳过左侧分隔符，再跳到词首
      while (index > 0 && this._isWordBoundaryChar(text[index - 1])) index--;
      while (index > 0 && !this._isWordBoundaryChar(text[index - 1])) index--;
    }

    const newPos = Math.max(0, Math.min(index, text.length));
    this._updateSelection(newPos, expand);
    this._updateTextarea();
    this.forceRender();
  }

  /**
   * 词边界判定：空白、常见标点，以及 CJK 字符（CJK 逐字成词，避免 Ctrl+←/→ 跨越整段）
   */
  private _isWordBoundaryChar(char: string): boolean {
    if (!char) return true;
    if (RE_WORD_BOUNDARY.test(char)) return true;
    if (RE_PUNCTUATION.test(char)) return true;
    return RE_CJK.test(char);
  }

  private _updateSelection(newPos: number, expand: boolean): void {
    if (expand) {
      if (this._selectionAnchor === null) {
        this._selectionAnchor = this.selectionStart;
      }
      this.selectionStart = Math.min(this._selectionAnchor, newPos);
      this.selectionEnd = Math.max(this._selectionAnchor, newPos);
    } else {
      this._selectionAnchor = null;
      this.selectionStart = this.selectionEnd = newPos;
    }
    this._notifySelectionChange();
  }

  private _notifySelectionChange(): void {
    this.onSelectionChange?.(
      this.isEditing && this.selectionStart !== this.selectionEnd
        ? { start: this.selectionStart, end: this.selectionEnd }
        : undefined,
    );
  }

  // ============ 选区操作 ============

  public selectAll(): void {
    this.selectionStart = 0;
    this.selectionEnd = this._graphemes.length;
    this._updateTextarea();
    this.forceRender();
    this._notifySelectionChange();
  }

  private _selectWord(index: number): void {
    const text = this._graphemes;
    if (!text.length) return;

    // 点在词尾时向左取词
    let pivot = Math.max(0, Math.min(index, text.length - 1));
    if (
      this._isWordBoundaryChar(text[pivot]) &&
      pivot > 0 &&
      !this._isWordBoundaryChar(text[pivot - 1])
    ) {
      pivot--;
    }

    let start: number;
    let end: number;

    if (this._isWordBoundaryChar(text[pivot])) {
      // CJK / 标点：选中单个字符；连续空白：选中整段空白
      if (RE_WORD_BOUNDARY.test(text[pivot])) {
        start = pivot;
        end = pivot;
        while (start > 0 && RE_WORD_BOUNDARY.test(text[start - 1])) start--;
        while (end < text.length && RE_WORD_BOUNDARY.test(text[end])) end++;
      } else {
        start = pivot;
        end = pivot + 1;
      }
    } else {
      start = pivot;
      end = pivot;
      while (start > 0 && !this._isWordBoundaryChar(text[start - 1])) start--;
      while (end < text.length && !this._isWordBoundaryChar(text[end])) end++;
    }

    this.selectionStart = start;
    this.selectionEnd = end;
    this._selectionAnchor = null;
    this._caretUpstream = false;
    this._goalX = null;
    this._updateTextarea();
    this.forceRender();
    this._notifySelectionChange();
  }

  private _selectLine(index: number): void {
    const loc = this._caretLocation(index);
    const start = this._locationToLinear(loc.lineIndex, 0);
    const end = start + (this._lines[loc.lineIndex]?.length || 0);

    this.selectionStart = start;
    this.selectionEnd = end;
    this._selectionAnchor = null;
    this._caretUpstream = false;
    this._goalX = null;
    this._updateTextarea();
    this.forceRender();
    this._notifySelectionChange();
  }

  // ============ 光标动画 ============

  private _startCursorBlink(): void {
    this._stopCursorBlink();

    this._cursorOpacity = 1;

    // 用定时切换代替逐帧渐变：逐帧 forceRender 会导致 60fps 全元素重绘
    this._cursorTimer = window.setInterval(() => {
      if (!this.isEditing || this.selectionStart !== this.selectionEnd) {
        if (this._cursorOpacity !== 1) {
          this._cursorOpacity = 1;
          this.forceRender();
        }
        return;
      }
      this._cursorOpacity = this._cursorOpacity > 0 ? 0 : 1;
      this.forceRender();
    }, RICHTEXT_DEFAULTS.cursorBlinkInterval);
  }

  private _stopCursorBlink(): void {
    if (this._cursorTimer !== null) {
      clearInterval(this._cursorTimer);
      this._cursorTimer = null;
    }
    this._cursorOpacity = 1;
  }

  // ============ Undo/Redo ============

  /**
   * 深拷贝样式 Map。
   * ⚠️ 必须深拷贝：内层 Map 与 style 对象若共享引用，
   * 后续 setSelectionStyles / clearSelectionStyles 会就地改写历史快照。
   */
  private _cloneStyles(source: StyleMap): StyleMap {
    const clone: StyleMap = new Map();
    for (const [lineIdx, lineStyles] of source.entries()) {
      const lineClone = new Map<number, ICharStyle>();
      for (const [charIdx, style] of lineStyles.entries()) {
        lineClone.set(charIdx, { ...style });
      }
      clone.set(lineIdx, lineClone);
    }
    return clone;
  }

  private _createSnapshot(kind: "input" | "other" = "other"): IRichTextSnapshot {
    return {
      text: String(this.text || ""),
      styles: this._cloneStyles(this._styles),
      selection: [this.selectionStart, this.selectionEnd],
      time: Date.now(),
      kind,
    };
  }

  private _recordSnapshot(options?: { coalesce?: boolean }): void {
    const coalesce = options?.coalesce ?? false;
    const last = this._undoStack[this._undoStack.length - 1];

    // 连续键入合并：同一时间窗口内的连续输入只保留第一个快照
    if (coalesce && last && last.kind === "input" && Date.now() - last.time < UNDO_COALESCE_MS) {
      last.time = Date.now();
      this._redoStack = [];
      return;
    }

    this._undoStack.push(this._createSnapshot(coalesce ? "input" : "other"));
    if (this._undoStack.length > UNDO_STACK_LIMIT) this._undoStack.shift();
    this._redoStack = [];
  }

  private _restoreSnapshot(snapshot: IRichTextSnapshot): void {
    // ⚠️ 先清掉 pending，否则 text setter 触发的 _applyPendingStyles 会覆盖恢复的样式
    this._pendingLinearStyles = null;
    // 快照里的 2D 样式坐标是在快照文本的排版下生成的，
    // 恢复同一文本会得到同样的分行，因此这里必须跳过“线性迁移”，否则会用旧分行错算。
    this._skipStyleMigration = true;

    this.text = snapshot.text;
    this._styles = this._cloneStyles(snapshot.styles);
    this._pendingLinearStyles = null;

    // 同步重建 graphemes / lines / metrics，保证下面的索引换算与光标定位正确
    this._updateGraphemes();
    this._measureText();
    this._skipStyleMigration = false;

    const max = this._graphemes.length;
    this.selectionStart = Math.max(0, Math.min(snapshot.selection[0], max));
    this.selectionEnd = Math.max(0, Math.min(snapshot.selection[1], max));
    this._selectionAnchor = null;
    this._caretUpstream = false;
    this._goalX = null;

    if (this._hiddenTextarea) this._hiddenTextarea.value = snapshot.text;

    this.__layout.boxChanged || this.__layout.boxChange();
    this._updateTextarea();
    this.forceUpdate();
    this.forceRender();
  }

  public undo(): void {
    const snapshot = this._undoStack.pop();
    if (!snapshot) return;

    this._redoStack.push(this._createSnapshot());
    if (this._redoStack.length > UNDO_STACK_LIMIT) this._redoStack.shift();

    this._restoreSnapshot(snapshot);
  }

  public redo(): void {
    const snapshot = this._redoStack.pop();
    if (!snapshot) return;

    this._undoStack.push(this._createSnapshot());
    if (this._undoStack.length > UNDO_STACK_LIMIT) this._undoStack.shift();

    this._restoreSnapshot(snapshot);
  }

  // ============ 公开 API ============

  /**
   * 获取选区文本
   */
  public getSelectedText(): string {
    return this._graphemes.slice(this.selectionStart, this.selectionEnd).join("");
  }

  /**
   * 获取选区样式
   */
  public getSelectionStyles(): ICharStyle[] {
    const styles: ICharStyle[] = [];
    for (let i = this.selectionStart; i < this.selectionEnd; i++) {
      const loc = this._linearToLocation(i);
      styles.push(this._getCharStyle(loc.lineIndex, loc.charIndex));
    }
    return styles;
  }

  /**
   * 获取某一下标处的有效样式（用于未进入编辑时面板展示整段样式）
   */
  public getStyleAt(linearIndex: number): ICharStyle {
    if (!this._lines.length) {
      return {
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        fontWeight: this.fontWeight as any,
        fill: this.fill,
        italic: this.italic,
      };
    }
    const loc = this._linearToLocation(Math.max(0, Math.min(linearIndex, this._graphemes.length)));
    return this._getCharStyle(loc.lineIndex, loc.charIndex);
  }

  /**
   * 清除选区样式
   */
  public clearSelectionStyles(): void {
    if (this.selectionStart === this.selectionEnd) return;

    this._recordSnapshot();

    for (let i = this.selectionStart; i < this.selectionEnd; i++) {
      const loc = this._linearToLocation(i);
      const lineStyles = this._styles.get(loc.lineIndex);
      if (lineStyles) {
        lineStyles.delete(loc.charIndex);
      }
    }

    // 重新分行 + 测量 + 渲染
    this._relayout();
  }

  /**
   * 全量设置整段文本样式（不进入编辑器时面板修改用）
   * 只修改指定的样式属性，保留其他字符级样式
   */
  public setFullTextStyles(styleObj: Partial<ICharStyle>): void {
    this._updateGraphemes();
    this._recordSnapshot();

    // 更新基础样式属性
    if (styleObj.fontSize !== undefined) this.fontSize = styleObj.fontSize;
    if (styleObj.fontFamily !== undefined) this.fontFamily = styleObj.fontFamily;
    if (styleObj.fontWeight !== undefined) this.fontWeight = styleObj.fontWeight;
    if (styleObj.fill !== undefined) this.fill = styleObj.fill;
    if ((styleObj as any).stroke !== undefined) (this as any).stroke = (styleObj as any).stroke;
    if ((styleObj as any).strokeWidth !== undefined)
      (this as any).strokeWidth = (styleObj as any).strokeWidth;
    if ((styleObj as any).strokeAlign !== undefined)
      (this as any).strokeAlign = (styleObj as any).strokeAlign;
    if ((styleObj as any).strokeWidthFixed !== undefined)
      (this as any).strokeWidthFixed = (styleObj as any).strokeWidthFixed;
    if ((styleObj as any).strokeCap !== undefined)
      (this as any).strokeCap = (styleObj as any).strokeCap;
    if ((styleObj as any).strokeJoin !== undefined)
      (this as any).strokeJoin = (styleObj as any).strokeJoin;
    if ((styleObj as any).dashPattern !== undefined)
      (this as any).dashPattern = (styleObj as any).dashPattern;
    if ((styleObj as any).dashOffset !== undefined)
      (this as any).dashOffset = (styleObj as any).dashOffset;
    if ((styleObj as any).shadow !== undefined) (this as any).shadow = (styleObj as any).shadow;
    if ((styleObj as any).innerShadow !== undefined)
      (this as any).innerShadow = (styleObj as any).innerShadow;
    if (styleObj.italic !== undefined) this.italic = styleObj.italic;
    if (styleObj.textCase !== undefined) this.textCase = styleObj.textCase;
    if (styleObj.textDecoration !== undefined) this.textDecoration = styleObj.textDecoration;
    if (styleObj.letterSpacing !== undefined) this.letterSpacing = styleObj.letterSpacing;

    // 已同步到元素级属性的 key：清掉字符级覆盖即可，
    // 否则每个字符都写满属性，之后修改元素级属性会完全失效（且序列化体积暴涨）。
    const mirroredKeys = Object.keys(styleObj).filter((key) =>
      ELEMENT_MIRRORED_STYLE_KEYS.has(key),
    );
    const charOnlyEntries = Object.entries(styleObj).filter(
      ([key, value]) => !ELEMENT_MIRRORED_STYLE_KEYS.has(key) && value !== undefined,
    );

    for (const [lineIdx, lineStyles] of Array.from(this._styles.entries())) {
      for (const [charIdx, style] of Array.from(lineStyles.entries())) {
        const next: any = { ...style };
        for (const key of mirroredKeys) delete next[key];
        for (const [key, value] of charOnlyEntries) next[key] = value;

        if (Object.keys(next).length) lineStyles.set(charIdx, next);
        else lineStyles.delete(charIdx);
      }
      if (!lineStyles.size) this._styles.delete(lineIdx);
    }

    // 仅字符级支持的属性（如 textBackgroundColor）需要逐字符写入
    if (charOnlyEntries.length) {
      const len = this._graphemes.length;
      for (let i = 0; i < len; i++) {
        const loc = this._linearToLocation(i);
        if (!this._styles.has(loc.lineIndex)) this._styles.set(loc.lineIndex, new Map());

        const lineStyles = this._styles.get(loc.lineIndex)!;
        const existing = lineStyles.get(loc.charIndex) || {};
        const next: any = { ...existing };
        for (const [key, value] of charOnlyEntries) next[key] = value;
        lineStyles.set(loc.charIndex, next);
      }
    }

    this._relayout();
  }

  /**
   * 清除整段文本的字符级样式，全部回退为基础样式
   */
  public clearFullTextStyles(): void {
    this._recordSnapshot();
    this._styles.clear();
    this._relayout();
  }

  /**
   * 插入文本
   */
  public insertText(text: string, position?: number): void {
    const normalized = text.replace(/\r\n?/g, "\n");
    const pos = Math.max(0, Math.min(position ?? this.selectionStart, this._graphemes.length));
    // 显式传入 position 时不应吞掉 position 到 selectionEnd 之间的内容
    const replaceEnd = position === undefined ? Math.max(pos, this.selectionEnd) : pos;
    const inserted = graphemeSplit(normalized);

    if (!this._hiddenTextarea) {
      this._recordSnapshot();
      const before = this._graphemes.slice(0, pos);
      const after = this._graphemes.slice(replaceEnd);

      this._shiftStylesBeforeTextChange(pos, replaceEnd - pos, inserted.length);
      this.text = [...before, ...inserted, ...after].join("");
      this.selectionStart = this.selectionEnd = pos + inserted.length;
      this._caretUpstream = false;
      this._goalX = null;
      this.__layout.boxChanged || this.__layout.boxChange();
      this.forceUpdate();
      this.forceRender();
    } else {
      const ta = this._hiddenTextarea;
      const codeUnitPos = this._graphemeIndexToCodeUnit(pos);
      const codeUnitEnd = this._graphemeIndexToCodeUnit(replaceEnd);
      ta.value = ta.value.slice(0, codeUnitPos) + normalized + ta.value.slice(codeUnitEnd);
      const newCodeUnitPos = codeUnitPos + normalized.length;
      ta.selectionStart = ta.selectionEnd = newCodeUnitPos;
      // 组合输入期间也要生效，因此强制同步
      this._onInput(true);
    }
  }

  /**
   * 删除选区
   */
  public deleteSelection(): void {
    if (this.selectionStart === this.selectionEnd) return;
    const start = this.selectionStart;
    const end = this.selectionEnd;

    if (!this._hiddenTextarea) {
      this._recordSnapshot();
      this._shiftStylesBeforeTextChange(start, end - start, 0);
      this.text = [...this._graphemes.slice(0, start), ...this._graphemes.slice(end)].join("");
      this.selectionStart = this.selectionEnd = start;
      this._caretUpstream = false;
      this._goalX = null;
      this.__layout.boxChanged || this.__layout.boxChange();
      this.forceUpdate();
      this.forceRender();
    } else {
      const ta = this._hiddenTextarea;
      const codeUnitStart = this._graphemeIndexToCodeUnit(start);
      const codeUnitEnd = this._graphemeIndexToCodeUnit(end);
      ta.value = ta.value.slice(0, codeUnitStart) + ta.value.slice(codeUnitEnd);
      ta.selectionStart = ta.selectionEnd = codeUnitStart;
      this._onInput(true);
    }
  }

  // ============ JSON 序列化 ============

  /**
   * 序列化样式为普通对象（用于导出 JSON）
   */
  private _serializeStyles(): any {
    const result: any = {};
    for (const [lineIdx, lineStyles] of this._styles.entries()) {
      result[lineIdx] = {};
      for (const [charIdx, style] of lineStyles.entries()) {
        result[lineIdx][charIdx] = { ...style };
      }
    }
    return result;
  }

  /**
   * 反序列化样式（用于从 JSON 导入）
   */
  private _deserializeStyles(data: any): void {
    this._styles.clear();

    if (!data || typeof data !== "object") return;

    Object.keys(data).forEach((lineKey) => {
      const lineIdx = Number(lineKey);
      const lineData = data[lineKey];

      if (!lineData || typeof lineData !== "object") return;

      const lineStyles = new Map<number, ICharStyle>();
      Object.keys(lineData).forEach((charKey) => {
        const charIdx = Number(charKey);
        lineStyles.set(charIdx, { ...lineData[charKey] });
      });

      this._styles.set(lineIdx, lineStyles);
    });
  }

  /**
   * Range → Index 转换（导入时）
   */
  private _loadFromStyleRanges(ranges: IStyleRange[]): void {
    this._styles.clear();

    // 确保文本已分割
    if (!this._graphemes.length && this.text) {
      this._updateGraphemes();
    }

    for (const range of ranges) {
      const { start, end, ...style } = range;

      // 将 range 展开为逐字符样式
      for (let i = start; i < end && i < this._graphemes.length; i++) {
        const loc = this._linearToLocation(i);

        if (!this._styles.has(loc.lineIndex)) {
          this._styles.set(loc.lineIndex, new Map());
        }

        this._styles.get(loc.lineIndex)!.set(loc.charIndex, { ...style });
      }
    }
  }

  /**
   * 样式的稳定字符串标识（key 排序，避免属性顺序不同导致无法合并 range）
   */
  private _styleKey(style: ICharStyle | undefined): string {
    if (!style) return "";
    const keys = Object.keys(style)
      .filter((key) => (style as any)[key] !== undefined)
      .sort();
    return keys.map((key) => `${key}:${stableStringify((style as any)[key])}`).join("|");
  }

  /**
   * Index → Range 转换（导出时，压缩格式）
   */
  private _compressToStyleRanges(): IStyleRange[] {
    const ranges: IStyleRange[] = [];

    // 收集线性样式
    const linearStyles = new Map<number, ICharStyle>();
    for (const [lineIdx, lineStyles] of this._styles.entries()) {
      for (const [charIdx, style] of lineStyles.entries()) {
        const linear = this._locationToLinear(lineIdx, charIdx);
        linearStyles.set(linear, style);
      }
    }

    if (linearStyles.size === 0) return ranges;

    // 按索引排序
    const sortedIndices = Array.from(linearStyles.keys()).sort((a, b) => a - b);

    let currentStart = sortedIndices[0];
    let currentStyle = linearStyles.get(currentStart)!;
    let lastIndex = currentStart;

    for (let i = 1; i < sortedIndices.length; i++) {
      const index = sortedIndices[i];
      const style = linearStyles.get(index)!;

      // 检查是否可以合并（相邻且样式相同）
      const isAdjacent = index === lastIndex + 1;
      const isSameStyle = this._styleKey(style) === this._styleKey(currentStyle);

      if (isAdjacent && isSameStyle) {
        // 继续当前 range
        lastIndex = index;
      } else {
        // 结束当前 range，开始新 range
        ranges.push({
          start: currentStart,
          end: lastIndex + 1,
          ...currentStyle,
        });

        currentStart = index;
        currentStyle = style;
        lastIndex = index;
      }
    }

    // 添加最后一个 range
    if (currentStyle) {
      ranges.push({
        start: currentStart,
        end: lastIndex + 1,
        ...currentStyle,
      });
    }

    return ranges;
  }

  /**
   * 销毁：清理隐藏 textarea、定时器、离屏 canvas，避免 DOM / GPU 内存泄漏
   */
  public destroy(): void {
    this._hidePathAnchorMenu();
    this._stopListeningForSelectedPathAnchorKeys();
    this._stopCursorBlink();
    this._destroyHiddenTextarea();
    EditingManager.clearActive(this);
    this.isEditing = false;

    this._offscreenCanvas = null;
    this._shadowCanvas = null;
    this._shadowCtx = null;
    this._undoStack = [];
    this._redoStack = [];
    this._styles.clear();
    this._pendingLinearStyles = null;
    this._lineMetrics = [];

    super.destroy();
  }

  /**
   * 重写 toJSON，使用 Range-based 格式（兼容 Figma）
   */
  public toJSON(): any {
    const json = super.toJSON();

    // ✅ 使用 styleRanges（简洁格式）
    json.styleRanges = this._compressToStyleRanges();

    // 移除不需要导出的内部属性
    delete json.hitBox;
    delete json.editInner;
    delete json.isEditing;
    delete json.selectionStart;
    delete json.selectionEnd;
    delete json.selectionColor;

    const configuredGroup = (fields: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(fields)
          .filter(([, field]) =>
            this._configuredPathAppearance.has(field as (typeof PATH_APPEARANCE_KEYS)[number]),
          )
          .map(([key, field]) => [key, (this as any)[field]]),
      );
    const cursor = configuredGroup(PATH_CONFIG_FIELDS.textCursor);
    const bezier = configuredGroup(PATH_CONFIG_FIELDS.bezier);
    const anchor = configuredGroup(PATH_CONFIG_FIELDS.anchor);
    const menu = this.pathAnchorMenuEnabled ? configuredGroup(PATH_CONFIG_FIELDS.menu) : {};

    delete json.textCursor;
    delete json.bezier;
    delete json.anchor;
    if (Object.keys(cursor).length) json.textCursor = cursor;
    if (Object.keys(bezier).length) json.bezier = bezier;
    if (Object.keys(menu).length) anchor.menu = menu;
    if (Object.keys(anchor).length) json.anchor = anchor;
    const textPath = configuredGroup(PATH_CONFIG_FIELDS.textPath);
    if (this._configuredPathAppearance.has("textPath")) textPath.mode = this._pathMode;
    if (!this._configuredPathAppearance.has("pathEditing")) delete textPath.editing;
    if (!Object.keys(textPath).length) delete json.textPath;

    PATH_APPEARANCE_KEYS.forEach((key) => delete json[key]);
    delete json.pathRadius;
    delete json.pathStartAngle;
    delete json.pathDirection;
    delete json.pathSide;
    delete json.pathAlign;
    delete json.pathClosed;
    delete json.pathAnchors;
    delete json.pathEditing;
    if (Object.keys(textPath).length) json.textPath = textPath;

    return json;
  }
}
