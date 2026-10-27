// RichTextPlus 工具函数

import type { IFontWeightString } from './types'

/** 所有命名字重（下拉、校验用） */
export const FONT_WEIGHT_STRING_VALUES: readonly IFontWeightString[] = [
  'thin',
  'extra-light',
  'light',
  'normal',
  'medium',
  'semi-bold',
  'bold',
  'extra-bold',
  'black'
] as const

// 与 Leafer TextData 内置的 fontWeightMap 保持一致
const NAMED_TO_CANVAS: Record<IFontWeightString, number> = {
  thin: 100,
  'extra-light': 200,
  light: 300,
  normal: 400,
  medium: 500,
  'semi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  black: 900
}

const NUMERIC_TO_NAMED: Record<number, IFontWeightString> = {
  100: 'thin',
  200: 'extra-light',
  300: 'light',
  400: 'normal',
  500: 'medium',
  600: 'semi-bold',
  700: 'bold',
  800: 'extra-bold',
  900: 'black'
}

/**
 * 将存储的字重转为 Canvas font 可用的值
 * 命名字重严格对齐 Leafer 的 fontWeightMap（thin→100, bold→700 等）
 */
export function resolveFontWeightForCanvas(
  fontWeight: string | number | undefined | null
): string | number | undefined {
  if (fontWeight == null || fontWeight === '') return undefined
  if (typeof fontWeight === 'number') {
    return Number.isFinite(fontWeight) ? fontWeight : undefined
  }

  const raw = String(fontWeight).trim()
  if (raw === 'inherit') return undefined

  if (raw in NAMED_TO_CANVAS) {
    return NAMED_TO_CANVAS[raw as IFontWeightString]
  }

  if (raw === 'bolder' || raw === 'lighter') return raw

  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10)
    if (n >= 1 && n <= 1000) return n
  }

  return raw
}

/** 数值字重 → 命名字符串（用于面板回显，仅标准 100 步进） */
export function numericFontWeightToNamed(n: number): IFontWeightString | null {
  return NUMERIC_TO_NAMED[n] ?? null
}

/** 任意字重 → 面板下拉 value（命名字符串或数字字符串） */
export function fontWeightToPanelValue(
  fontWeight: string | number | undefined | null
): string {
  if (fontWeight == null || fontWeight === '') return 'normal'
  if (typeof fontWeight === 'number') {
    const named = numericFontWeightToNamed(fontWeight)
    return named ?? String(fontWeight)
  }
  const s = String(fontWeight).trim()
  if ((FONT_WEIGHT_STRING_VALUES as readonly string[]).includes(s)) return s
  if (/^\d+$/.test(s)) return s
  return 'normal'
}

/**
 * 将字符串分割为 grapheme 数组（处理表情等复杂字符）
 */
let _graphemeSegmenter: any | null | undefined = undefined

function getGraphemeSegmenter(): any | null {
  if (_graphemeSegmenter !== undefined) return _graphemeSegmenter
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    try {
      _graphemeSegmenter = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' })
    } catch (_err) {
      _graphemeSegmenter = null
    }
  } else {
    _graphemeSegmenter = null
  }
  return _graphemeSegmenter
}

export function graphemeSplit(text: string): string[] {
  if (!text) return []

  // 使用 Intl.Segmenter (现代浏览器) 或 fallback
  const segmenter = getGraphemeSegmenter()
  if (segmenter) {
    return Array.from(segmenter.segment(text), (s: any) => s.segment)
  }

  // Fallback: 按 code point 分割（无法正确处理 ZWJ / 变体选择符等组合序列）
  return splitByCodePointWithCombining(text)
}

/**
 * Fallback 分割：在 code point 基础上把组合记号、变体选择符、ZWJ 序列、
 * 肤色修饰符、区域指示符（国旗）合并进前一个 grapheme。
 */
function splitByCodePointWithCombining(text: string): string[] {
  const points = Array.from(text)
  const result: string[] = []
  let lastCp = 0
  let lastLength = 0

  const isCombining = (cp: number) =>
    (cp >= 0x0300 && cp <= 0x036f) || // 组合附加符号
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe00 && cp <= 0xfe0f) || // 变体选择符
    (cp >= 0xfe20 && cp <= 0xfe2f) ||
    cp === 0x200d || // ZWJ
    (cp >= 0x1f3fb && cp <= 0x1f3ff) // 肤色修饰符

  const isRegionalIndicator = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff

  for (const point of points) {
    const cp = point.codePointAt(0)!
    const merge =
      result.length > 0 &&
      (isCombining(cp) ||
        lastCp === 0x200d ||
        (isRegionalIndicator(cp) && isRegionalIndicator(lastCp) && lastLength === 1))

    if (merge) {
      result[result.length - 1] += point
      lastLength++
    } else {
      result.push(point)
      lastLength = 1
    }
    lastCp = cp
  }

  return result
}

const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'emoji',
  'math',
  'fangsong',
  'caption',
  'icon'
])

function quoteFontFamilyToken(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return ''
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
  }

  const lower = trimmed.toLowerCase()
  if (GENERIC_FONT_FAMILIES.has(lower)) return trimmed

  // Canvas font shorthand requires quoting family names with spaces,
  // punctuation, leading digits, or non-identifier characters.
  if (/^[A-Za-z_-][A-Za-z0-9_-]*$/.test(trimmed)) return trimmed

  return `"${trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function normalizeFontFamilyForCanvas(fontFamily?: string): string {
  const raw = (fontFamily || '').trim()
  if (!raw) return 'sans-serif'

  const families = raw
    .split(',')
    .map(quoteFontFamilyToken)
    .filter(Boolean)

  const hasGeneric = families.some(item =>
    GENERIC_FONT_FAMILIES.has(item.replace(/^['"]|['"]$/g, '').toLowerCase())
  )

  if (!hasGeneric) families.push('sans-serif')

  return families.join(', ')
}

// 与 Leafer TextConvert 的 After 类标点保持一致，用于中文排版避免闭合标点出现在行首。
const LANG_AFTER_CHARS = '》）」〉』〗】〕｝┐＞’”！？，、。：；‰'
const AFTER_CHARS = `>)]}%!?,.:;'"${LANG_AFTER_CHARS}`
const AFTER_CHAR_SET = new Set(Array.from(AFTER_CHARS))

export function isLeaferAfterChar(char: string): boolean {
  return AFTER_CHAR_SET.has(char)
}

/**
 * 构建字体字符串
 */
export function buildFontString(
  fontSize: number,
  fontFamily: string,
  fontWeight: string | number | undefined = 'normal',
  italic: boolean = false
): string {
  const resolved = resolveFontWeightForCanvas(fontWeight)
  const weight =
    resolved === undefined ? '' : `${resolved} `
  const style = italic ? 'italic ' : ''
  const family = normalizeFontFamilyForCanvas(fontFamily)
  return `${style}${weight}${fontSize}px ${family}`
}

/**
 * 测量文本宽度（带缓存）
 * 缓存 key = font + '\u0000' + text，避免长文本布局时重复 measureText。
 */
const MEASURE_CACHE_LIMIT = 20000
const measureCache = new Map<string, number>()

export function clearMeasureCache(): void {
  measureCache.clear()
}

// 字体异步加载完成后，之前用 fallback 字体测出的宽度会失效，需要清空缓存
if (typeof document !== 'undefined' && (document as any).fonts?.addEventListener) {
  ;(document as any).fonts.addEventListener('loadingdone', () => clearMeasureCache())
}

export function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string | number | undefined = 'normal',
  italic: boolean = false
): number {
  const font = buildFontString(fontSize, fontFamily, fontWeight, italic)
  const key = `${font}\u0000${text}`

  const cached = measureCache.get(key)
  if (cached !== undefined) return cached

  if (ctx.font !== font) ctx.font = font
  const width = ctx.measureText(text).width

  // 超出上限时整体清空（简单的 FIFO 替代，避免无界增长）
  if (measureCache.size >= MEASURE_CACHE_LIMIT) measureCache.clear()
  measureCache.set(key, width)

  return width
}
