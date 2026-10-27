// RichTextPlus 常量

export const RICHTEXT_DEFAULTS = {
  // 基础字符样式
  fontSize: 16,
  fontFamily: 'Arial, sans-serif',
  fontWeight: 'normal' as const,
  fill: '#000000',
  stroke: undefined,
  strokeWidth: 0,
  strokeAlign: 'outside' as const,
  strokeWidthFixed: false as const,
  strokeCap: 'none' as const,
  strokeJoin: 'miter' as const,
  dashPattern: undefined,
  dashOffset: 0,
  shadow: undefined,
  innerShadow: undefined,
  italic: false,
  
  // 文本格式
  textCase: 'none' as const,
  textDecoration: 'none' as const,
  
  // 间距（与 Leafer Text 默认值完全一致）
  letterSpacing: 0,
  lineHeight: { type: 'percent' as const, value: 1.5 },  // 1.5 × fontSize
  
  // 换行与溢出
  textWrap: 'normal' as const,
  textOverflow: 'show' as const,
  
  // 段落属性
  paraIndent: 0,
  paraSpacing: 0,
  textAlign: 'left' as const,
  verticalAlign: 'top' as const,
  autoSizeAlign: true,
  padding: 0,
  
  // 尺寸控制
  autoWidth: true,   // 默认自动宽度
  autoHeight: true,  // 默认自动高度
  
  // 编辑相关
  editable: true,
  cursorColor: '#000000',
  cursorWidth: 2,
  pathGuideColor: 'rgba(22, 119, 255, 0.7)',
  pathGuideWidth: 1,
  pathAnchorFill: '#ffffff',
  pathAnchorStroke: 'rgba(22, 119, 255, 0.7)',
  pathAnchorActiveFill: '#1677ff',
  pathAnchorRadius: 5,
  pathAnchorLineWidth: 1,
  pathHandleFill: '#ffffff',
  pathHandleStroke: 'rgba(22, 119, 255, 0.7)',
  pathHandleSize: 6,
  pathHandleLineWidth: 1,
  pathAnchorMenuEnabled: false,
  pathAnchorMenuBackground: '#ffffff',
  pathAnchorMenuColor: '#1f2937',
  pathAnchorMenuDeleteColor: '#dc2626',
  pathAnchorMenuBorderColor: '#d1d5db',
  pathAnchorMenuBorderRadius: 6,
  pathAnchorMenuFontSize: 14,
  pathAnchorMenuPadding: '8px 12px',
  pathAnchorMenuShadow: '0 4px 12px rgba(0, 0, 0, 0.16)',
  cursorDelay: 300,
  cursorBlinkSpeed: 0.02,
  /** 光标闪烁间隔（ms），定时切换显隐，避免逐帧重绘 */
  cursorBlinkInterval: 530,
  selectionColor: 'rgba(17, 119, 255, 0.3)'
}

// 单词边界正则
export const RE_WORD_BOUNDARY = /[\s\u200B]/
export const RE_NON_WORD = /[^\w\u4e00-\u9fa5]/

// 标点（含全角），用于 Ctrl+方向键 / 双击选词的词边界判定
export const RE_PUNCTUATION = /[!-/:-@[-`{-~\u2010-\u205e\u3001-\u303f\uff01-\uff65]/

// CJK 表意文字、假名、韩文：逐字成词
export const RE_CJK = /[\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]|[\ud840-\ud868][\udc00-\udfff]/
