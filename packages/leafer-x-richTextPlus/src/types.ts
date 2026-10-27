// RichTextPlus 类型定义
import type { 
  IUIInputData, 
  IUIData, 
  IFontWeight,
  ITextCase,
  ITextDecoration,
  ITextDecorationType,
  ITextDecorationData,
  IUnitData,
  ITextWrap,
  IOverflow,
  ITextAlign,
  IVerticalAlign,
  IFill,
  IScaleFixed
} from 'leafer-ui'

/**
 * 命名字重（与 OpenType/CSS 常用数值对应，可存于 styleRanges / 逐字样式）
 */
export type IFontWeightString =
  | 'thin' // 100
  | 'extra-light' // 200
  | 'light' // 300
  | 'normal' // 400
  | 'medium' // 500
  | 'semi-bold' // 600
  | 'bold' // 700
  | 'extra-bold' // 800
  | 'black' // 900

/** RichTextPlus 元素与字符级字重（Leafer 原有 + 上列命名字符串） */
export type IRichTextFontWeight = IFontWeight | IFontWeightString

export type IPathPoint = { x: number; y: number }

/** 曲线路径锚点；控制柄相对锚点坐标。 */
export interface IPathAnchor extends IPathPoint {
  handleIn?: IPathPoint
  handleOut?: IPathPoint
}

export interface IPathBezierConfig {
  guideColor?: string
  guideWidth?: number
  handleFill?: string
  handleStroke?: string
  handleSize?: number
  handleLineWidth?: number
}

export interface IPathAnchorMenuConfig {
  enabled?: boolean
  background?: string
  color?: string
  deleteColor?: string
  borderColor?: string
  borderRadius?: number
  fontSize?: number
  padding?: string
  shadow?: string
}

export interface IPathAnchorConfig {
  fill?: string
  activeFill?: string
  stroke?: string
  radius?: number
  lineWidth?: number
  menu?: IPathAnchorMenuConfig
}

export interface ITextPathConfig {
  mode?: ITextPathMode
  radius?: number
  sideCount?: number
  startAngle?: number
  direction?: ITextPathDirection
  side?: ITextPathSide
  align?: ITextPathAlign
  closed?: boolean
  anchors?: IPathAnchor[]
  editing?: boolean
}

export interface ITextCursorConfig {
  color?: string
  width?: number
}

export enum TextPathMode {
  None = 'none',
  Circle = 'circle',
  Custom = 'custom',
  Polygon = 'polygon'
}
export type ITextPathMode = TextPathMode

/** 自定义路径生成器接收的当前文字路径上下文。坐标以文字节点原点为基准。 */
export interface ITextPathGeneratorContext {
  textLength: number
  textPath: Readonly<ITextPathConfig>
}

/** 返回路径锚点；控制柄相对所属锚点，坐标以文字节点原点为基准。 */
export type ITextPathGenerator = (context: ITextPathGeneratorContext) => IPathAnchor[]
export type ITextPathDirection = 'forward' | 'reverse'
export type ITextPathSide = 'inner' | 'outer'
export type ITextPathAlign = 'start' | 'center' | 'end'

export interface ITextPathData {
  textPath: ITextPathConfig
}

// 重新导出类型供外部使用
export type {
  ITextCase,
  ITextDecoration,
  ITextDecorationType,
  ITextDecorationData,
  IUnitData,
  ITextWrap,
  IOverflow,
  ITextAlign,
  IVerticalAlign
}

/**
 * 字符样式（支持字符级设置）
 * 注意：lineHeight、textWrap、textOverflow 等段落属性不在此列
 */
export interface ICharStyle {
  // 基础样式
  fill?: IFill  // 与 Leafer 对齐：支持纯色、渐变、图像
  stroke?: any
  strokeWidth?: number
  strokeAlign?: 'inside' | 'center' | 'outside'
  strokeWidthFixed?: IScaleFixed
  strokeCap?: 'none' | 'round' | 'square'
  strokeJoin?: 'miter' | 'bevel' | 'round'
  dashPattern?: number[]
  dashOffset?: number
  shadow?: any
  innerShadow?: any
  fontSize?: number
  fontFamily?: string
  fontWeight?: IRichTextFontWeight
  /** 单字旋转角度（度）；在路径文字中覆盖沿路径自动计算的切线角度。 */
  rotation?: number
  italic?: boolean
  
  // 文本格式
  textCase?: ITextCase
  textDecoration?: ITextDecoration
  
  // 间距（仅字间距，行高是段落属性）
  letterSpacing?: number | IUnitData
  
  // 背景
  textBackgroundColor?: string
  
  // 兼容旧属性（内部转换为 textDecoration）
  underline?: boolean
  linethrough?: boolean
}

/**
 * 字符位置信息
 */
export interface ICharMetrics {
  char: string
  x: number
  width: number
  style: ICharStyle
}

/**
 * 行信息
 */
export interface ILineMetrics {
  chars: ICharMetrics[]
  y: number
  height: number
  /** 相对行顶部的基线偏移（按行内最大字号计算） */
  baseline: number
  /** 行内最大字号（用于行盒与基线计算） */
  maxFontSize: number
  /** 段首缩进（空行光标定位需要） */
  indent: number
  /** 水平对齐偏移（已计入 chars[].x，空行光标/选区需要单独使用） */
  alignOffset: number
}

/**
 * 光标亲和性：
 * downstream = 倾向下一行行首（默认）
 * upstream   = 倾向本行行尾（软换行行尾、End 键）
 */
export type ICaretAffinity = 'downstream' | 'upstream'

/**
 * RichTextPlus 输入数据
 */
export interface IRichTextInputData extends IUIInputData {
  text?: string
  
  // 基础字符样式
  fontSize?: number
  fontFamily?: string
  fontWeight?: IRichTextFontWeight
  fill?: any  // 与 Leafer 对齐，避免 IUIData 类型冲突
  stroke?: any
  strokeWidth?: number
  strokeAlign?: 'inside' | 'center' | 'outside'
  strokeWidthFixed?: IScaleFixed
  strokeCap?: 'none' | 'round' | 'square'
  strokeJoin?: 'miter' | 'bevel' | 'round'
  dashPattern?: number[]
  dashOffset?: number
  shadow?: any
  innerShadow?: any
  italic?: boolean
  
  // 文本格式
  textCase?: ITextCase
  textDecoration?: ITextDecoration
  
  // 间距
  letterSpacing?: number | IUnitData
  lineHeight?: number | IUnitData
  
  // 换行与溢出
  textWrap?: ITextWrap
  textOverflow?: IOverflow | string
  
  // 段落属性
  paraIndent?: number
  paraSpacing?: number
  textAlign?: ITextAlign
  verticalAlign?: IVerticalAlign
  autoSizeAlign?: boolean
  padding?: number | number[]
  
  // 尺寸控制
  width?: number
  height?: number
  autoWidth?: boolean  // true: 宽度自动适应内容（不换行）
  autoHeight?: boolean // true: 高度自动适应内容
  
  // 编辑相关
  editable?: boolean
  
  // 字符级样式（推荐格式：range-based，简洁）
  styleRanges?: IStyleRange[]
  
  // 兼容旧格式（index-based）
  styles?: any
  
  // 编辑相关
  textCursor?: ITextCursorConfig
  selectionColor?: string
  bezier?: IPathBezierConfig
  anchor?: IPathAnchorConfig

  textPath?: ITextPathConfig
  
  // 回调（可选，避免 emit 问题）
  onEditingEntered?: () => void
  onEditingExited?: () => void
  onSelectionChange?: (selection: { start: number; end: number } | undefined) => void
  onPathChange?: (path: ITextPathData) => void
}

/**
 * RichTextPlus 数据（计算数据）
 * 注意：letterSpacing 和 lineHeight 保持 number | IUnitData 以支持灵活输入
 */
export interface IRichTextData extends Omit<IUIData, 'fill' | 'stroke' | 'letterSpacing' | 'lineHeight'> {
  text?: string
  
  // 基础字符样式
  fontSize?: number
  fontFamily?: string
  fontWeight?: IRichTextFontWeight
  fill?: any  // 与 Leafer 对齐，避免 IUIData 类型冲突
  stroke?: any
  strokeWidth?: number
  strokeAlign?: 'inside' | 'center' | 'outside'
  strokeWidthFixed?: IScaleFixed
  strokeCap?: 'none' | 'round' | 'square'
  strokeJoin?: 'miter' | 'bevel' | 'round'
  dashPattern?: number[]
  dashOffset?: number
  shadow?: any
  innerShadow?: any
  italic?: boolean
  
  // 文本格式
  textCase?: ITextCase
  textDecoration?: ITextDecoration
  
  // 间距（支持数字或单位对象）
  letterSpacing?: number | IUnitData
  lineHeight?: number | IUnitData
  
  // 换行与溢出
  textWrap?: ITextWrap
  textOverflow?: IOverflow | string
  
  // 段落属性
  paraIndent?: number
  paraSpacing?: number
  textAlign?: ITextAlign
  verticalAlign?: IVerticalAlign
  autoSizeAlign?: boolean
  padding?: number | number[]
  
  // 尺寸控制
  width?: number
  height?: number
  autoWidth?: boolean
  autoHeight?: boolean
  
  // 编辑相关
  editable?: boolean
  
  // 字符级样式
  styles?: any
  
  textCursor?: ITextCursorConfig
  selectionColor?: string
  bezier?: IPathBezierConfig
  anchor?: IPathAnchorConfig
  textPath?: ITextPathConfig
}

/**
 * 样式映射：lineIndex -> charIndex -> style（内部使用）
 */
export type StyleMap = Map<number, Map<number, ICharStyle>>

/**
 * 样式范围（导入导出格式，兼容 Figma）
 */
export interface IStyleRange {
  start: number
  end: number
  
  // 基础样式
  fontSize?: number
  fontFamily?: string
  fontWeight?: IRichTextFontWeight
  /** 单字旋转角度（度）；在路径文字中覆盖沿路径自动计算的切线角度。 */
  rotation?: number
  fill?: IFill
  stroke?: any
  strokeWidth?: number
  strokeAlign?: 'inside' | 'center' | 'outside'
  strokeWidthFixed?: IScaleFixed
  strokeCap?: 'none' | 'round' | 'square'
  strokeJoin?: 'miter' | 'bevel' | 'round'
  dashPattern?: number[]
  dashOffset?: number
  italic?: boolean
  
  // 文本格式
  textCase?: ITextCase
  textDecoration?: ITextDecoration
  
  // 间距
  letterSpacing?: number | IUnitData
  
  // 背景
  textBackgroundColor?: string
  
  // 兼容旧属性
  underline?: boolean
  linethrough?: boolean
}

/**
 * 光标位置
 */
export interface ICursorLocation {
  lineIndex: number
  charIndex: number
}
