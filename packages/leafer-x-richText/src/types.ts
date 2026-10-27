// RichText 类型定义
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

/** RichText 元素与字符级字重（Leafer 原有 + 上列命名字符串） */
export type IRichTextFontWeight = IFontWeight | IFontWeightString

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
 * RichText 输入数据
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
  cursorColor?: string
  cursorWidth?: number
  selectionColor?: string
  
  // 回调（可选，避免 emit 问题）
  onEditingEntered?: () => void
  onEditingExited?: () => void
}

/**
 * RichText 数据（计算数据）
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
  
  cursorColor?: string
  cursorWidth?: number
  selectionColor?: string
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
