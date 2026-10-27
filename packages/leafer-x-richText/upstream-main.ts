// // 主入口 - RichText Demo
// import { App, Text } from 'leafer-ui'
// import { EditorEvent, InnerEditorEvent } from '@leafer-in/editor'
// import '@leafer-in/viewport' // 启用画布平移/缩放
// import { RichText, fontWeightToPanelValue, graphemeSplit } from './src/Richtext'
// import type { ICharStyle, IFontWeightString, IRichTextInputData, IStyleRange } from './richtext'
// // RichTextEditor 会在 import richtext 时自动注册
//
// // 创建应用（启用编辑器 + design 视口：滚轮/触控板平移缩放，空格/中键拖拽平移）
// const app = new App({
//   view: document.getElementById('canvas')!,
//   width: window.innerWidth - 300,
//   height: window.innerHeight,
//   tree: { type: 'design' },
//   editor: {}  // 启用编辑器
// })
//
// // 当前被面板操作的 RichText（选中或正在编辑的任意一个）
// let currentRichText: RichText | null = null
// let currentResizeHandler: (() => void) | null = null
//
// function getCurrentRichText(): RichText | null {
//   return currentRichText
// }
//
// function setCurrentRichText(rt: RichText | null): void {
//   if (currentRichText && currentResizeHandler) {
//     currentRichText.off('bounds.resize', currentResizeHandler)
//     currentResizeHandler = null
//   }
//   currentRichText = rt
//   if (rt) {
//     currentResizeHandler = () => {
//       updatePanelFromRichText(rt)
//       updateSelectionInfo()
//     }
//     rt.on('bounds.resize', currentResizeHandler)
//   }
//   updatePanelFromRichText(rt)
// }
//
// // 创建 RichText 实例（多样式示例 - 自动宽高）
// const richtext = new RichText({
//   x: 100,
//   y: 100,
//   text: '欢迎使用 RichText！\n这是一段支持自动宽高的文本。这是一段支持自动宽高的文本。这是一段支持自动宽高的文本。这是一段支持自动宽高的文本。这是一段支持自动宽高的文本。这是一段支持自动宽高的文本。这是一段支持自动宽高的文本。这是一段支持自动宽高的文本。这是一段支持自动宽高的文本。这是一段支持自动宽高的文本。\n宽度和高度会随内容自动调整。',
//   fontSize: 24,
//   fill: '#333',
//   editable: true,
//
//   // 自动宽高（默认 true，宽高由内容决定）
//   autoWidth: true,
//   autoHeight: true,
//
//   // 其他属性
//   lineHeight: { type: 'percent', value: 1.8 },
//   letterSpacing: 1,
//   textAlign: 'left',
//   padding: 15,
//
//   onEditingEntered: () => updateSelectionInfo(),
//   onEditingExited: () => updateSelectionInfo()
// })
//
// app.tree.add(richtext)
// currentRichText = richtext
//
// // 获取编辑器实例
// const editor = app.editor
//
// // 通用：选中变化或进入内部编辑时，同步“当前 RichText”
// if (editor) {
//   editor.on(EditorEvent.SELECT as any, () => {
//     const list = editor.list
//     if (list?.length && (list[0] as any).__tag === 'RichText') {
//       setCurrentRichText(list[0] as RichText)
//     } else {
//       setCurrentRichText(null)
//     }
//   })
//   editor.on(EditorEvent.AFTER_SELECT as any, () => {
//     const list = editor.list
//     if (list?.length && (list[0] as any).__tag === 'RichText') {
//       setCurrentRichText(list[0] as RichText)
//     } else {
//       setCurrentRichText(null)
//     }
//   })
//   editor.on(InnerEditorEvent.OPEN as any, (e: { editTarget: any }) => {
//     const target = e?.editTarget
//     if (target?.__tag === 'RichText') {
//       setCurrentRichText(target as RichText)
//     }
//   })
// }
//
//
//
// // 监听编辑器事件
// // 设置初始多样式（等待渲染完成）
// setTimeout(() => {
//   richtext.enterEditing()
//
//   const linearGradient = {
//     type: 'linear',
//     from: 'left',
//     to: 'right',
//     stops: [
//       { offset: 0, color: '#ff4d4f' },
//       { offset: 0.5, color: '#ffa940' },
//       { offset: 1, color: '#52c41a' }
//     ]
//   }
//
//   const radialGradient = {
//     type: 'radial',
//     from: 'center',
//     to: 'bottom-right',
//     stops: [
//       { offset: 0, color: '#1890ff' },
//       { offset: 1, color: '#722ed1' }
//     ]
//   }
//
//   const verticalGradient = {
//     type: 'linear',
//     from: 'top',
//     to: 'bottom',
//     stops: [
//       { offset: 0, color: '#00c2ff' },
//       { offset: 1, color: '#0050b3' }
//     ]
//   }
//
//   // 测试混合字号基线对齐
//   // "欢迎使用" - 大字号（验证基线对齐）
//   richtext.selectionStart = 0
//   richtext.selectionEnd = 4
//   richtext.setSelectionStyles({
//     fontSize: 48,  // 大字号
//     fontWeight: 'bold',
//     fill: linearGradient as any,
//     stroke: { type: 'solid', color: '#000000' } as any,
//     strokeWidth: 2
//   })
//
//   // "RichText" - 小字号（应该与大字在同一基线上）
//   richtext.selectionStart = 5
//   richtext.selectionEnd = 13
//   richtext.setSelectionStyles({
//     fontSize: 16,  // 小字号
//     fill: radialGradient as any,
//     italic: true
//   })
//
//   // 第二行 - 中等字号
//   richtext.selectionStart = 14
//   richtext.selectionEnd = 20
//   richtext.setSelectionStyles({
//     fontSize: 32,
//     textDecoration: 'under',
//     fill: verticalGradient as any,
//     fontWeight: 'bold'
//   })
//
//   console.log('✅ 样式设置完成 - 测试基线对齐')
//   console.log('第一行：48px 大字 + 16px 小字 应该在同一基线上')
//   console.log('lineHeight: 1.8，文本应该垂直居中于行高')
//
//   // 退出编辑显示效果
//   richtext.selectionStart = richtext.selectionEnd = 0
//   richtext.exitEditing()
// }, 2000)
//
// // 获取面板元素
// const fontSizeInput = document.getElementById('fontSize') as HTMLInputElement
// const fontFamilyInput = document.getElementById('fontFamily') as HTMLInputElement
// const fontWeightSelect = document.getElementById('rt-font-weight') as HTMLSelectElement
// const fillInput = document.getElementById('fill') as HTMLInputElement
// const strokeColorInput = document.getElementById('strokeColor') as HTMLInputElement
// const strokeWidthInput = document.getElementById('strokeWidth') as HTMLInputElement
// const strokeAlignSelect = document.getElementById('strokeAlign') as HTMLSelectElement
// const strokeCapSelect = document.getElementById('strokeCap') as HTMLSelectElement
// const strokeJoinSelect = document.getElementById('strokeJoin') as HTMLSelectElement
// const dashPatternInput = document.getElementById('dashPattern') as HTMLInputElement
// const dashOffsetInput = document.getElementById('dashOffset') as HTMLInputElement
// const shadowEnabled = document.getElementById('shadowEnabled') as HTMLInputElement
// const shadowColor = document.getElementById('shadowColor') as HTMLInputElement
// const shadowBlur = document.getElementById('shadowBlur') as HTMLInputElement
// const shadowOffsetX = document.getElementById('shadowOffsetX') as HTMLInputElement
// const shadowOffsetY = document.getElementById('shadowOffsetY') as HTMLInputElement
// const shadowSpread = document.getElementById('shadowSpread') as HTMLInputElement
// const shadowBlend = document.getElementById('shadowBlend') as HTMLSelectElement
// const innerShadowEnabled = document.getElementById('innerShadowEnabled') as HTMLInputElement
// const innerShadowColor = document.getElementById('innerShadowColor') as HTMLInputElement
// const innerShadowBlur = document.getElementById('innerShadowBlur') as HTMLInputElement
// const innerShadowOffsetX = document.getElementById('innerShadowOffsetX') as HTMLInputElement
// const innerShadowOffsetY = document.getElementById('innerShadowOffsetY') as HTMLInputElement
// const innerShadowSpread = document.getElementById('innerShadowSpread') as HTMLInputElement
// const innerShadowBlend = document.getElementById('innerShadowBlend') as HTMLSelectElement
// const letterSpacingInput = document.getElementById('letterSpacing') as HTMLInputElement
// const lineHeightInput = document.getElementById('lineHeight') as HTMLInputElement
// const textAlignSelect = document.getElementById('textAlign') as HTMLSelectElement
// const textCaseSelect = document.getElementById('textCase') as HTMLSelectElement
// const paddingInput = document.getElementById('padding') as HTMLInputElement
// const autoWidthCheckbox = document.getElementById('autoWidth') as HTMLInputElement
// const autoHeightCheckbox = document.getElementById('autoHeight') as HTMLInputElement
// const fixedWidthInput = document.getElementById('fixedWidth') as HTMLInputElement
// const fixedHeightInput = document.getElementById('fixedHeight') as HTMLInputElement
// const textWrapSelect = document.getElementById('textWrap') as HTMLSelectElement
// const textOverflowSelect = document.getElementById('textOverflow') as HTMLSelectElement
// const btnBold = document.getElementById('btnBold')!
// const btnItalic = document.getElementById('btnItalic')!
// const btnUnderline = document.getElementById('btnUnderline')!
// const btnStrike = document.getElementById('btnStrike')!
// const btnSelectAll = document.getElementById('btnSelectAll')!
// const btnClearStyles = document.getElementById('btnClearStyles')!
// const btnAddText = document.getElementById('btnAddText')!
// const btnExportJSON = document.getElementById('btnExportJSON')!
// const debugModeCheckbox = document.getElementById('debugMode') as HTMLInputElement
// const selectionInfo = document.getElementById('selectionInfo')!
//
// // 根据当前选中的 RichText 更新面板控件
// function getSolidColor(paint: any, fallback = '#000000'): string {
//   if (!paint) return fallback
//   if (typeof paint === 'string') return paint
//   if (Array.isArray(paint)) return getSolidColor(paint[0], fallback)
//   if (typeof paint === 'object') {
//     if ('color' in paint) return String(paint.color)
//     if ('type' in paint && paint.type === 'solid' && 'color' in paint) return String(paint.color)
//   }
//   return fallback
// }
//
// function setFontWeightSelectValue(
//   select: HTMLSelectElement,
//   weight: string | number | undefined | null
// ): void {
//   const v = fontWeightToPanelValue(weight)
//   const ok = Array.from(select.options).some(o => o.value === v)
//   select.value = ok ? v : 'normal'
// }
//
// function colorToHex(color: any, fallback = '#000000'): string {
//   if (!color) return fallback
//   if (typeof color === 'string') return color
//   if (typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
//     const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
//     return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
//   }
//   return fallback
// }
//
// function pickFirstEffect(shadow: any): any | null {
//   if (!shadow) return null
//   const first = Array.isArray(shadow) ? shadow[0] : shadow
//   return first || null
// }
//
// function buildShadowFromPanel(kind: 'outer' | 'inner'): any | undefined {
//   const enabled = kind === 'outer' ? shadowEnabled.checked : innerShadowEnabled.checked
//   if (!enabled) return undefined
//   const color = kind === 'outer' ? shadowColor.value : innerShadowColor.value
//   const blur = parseFloat(kind === 'outer' ? shadowBlur.value : innerShadowBlur.value) || 0
//   const x = parseFloat(kind === 'outer' ? shadowOffsetX.value : innerShadowOffsetX.value) || 0
//   const y = parseFloat(kind === 'outer' ? shadowOffsetY.value : innerShadowOffsetY.value) || 0
//   const spread = parseFloat(kind === 'outer' ? shadowSpread.value : innerShadowSpread.value) || 0
//   const blendMode = kind === 'outer' ? shadowBlend.value : innerShadowBlend.value
//   const result: any = { color, blur, x, y, spread }
//   if (blendMode) result.blendMode = blendMode
//   return result
// }
//
// function updatePanelFromRichText(rt: RichText | null): void {
//   if (!fontSizeInput || !fillInput || !fontFamilyInput || !fontWeightSelect || !strokeColorInput || !strokeWidthInput) return
//   if (!rt) {
//     fontSizeInput.value = '24'
//     fillInput.value = '#333333'
//     fontFamilyInput.value = 'Arial'
//     fontWeightSelect.value = 'normal'
//     strokeColorInput.value = '#000000'
//     strokeWidthInput.value = '0'
//     strokeAlignSelect.value = 'outside'
//     strokeCapSelect.value = 'none'
//     strokeJoinSelect.value = 'miter'
//     dashPatternInput.value = ''
//     dashOffsetInput.value = '0'
//     shadowEnabled.checked = false
//     shadowColor.value = '#000000'
//     shadowBlur.value = '8'
//     shadowOffsetX.value = '0'
//     shadowOffsetY.value = '4'
//     shadowSpread.value = '0'
//     shadowBlend.value = ''
//     innerShadowEnabled.checked = false
//     innerShadowColor.value = '#000000'
//     innerShadowBlur.value = '8'
//     innerShadowOffsetX.value = '0'
//     innerShadowOffsetY.value = '4'
//     innerShadowSpread.value = '0'
//     innerShadowBlend.value = ''
//     letterSpacingInput.value = '0'
//     lineHeightInput.value = '1.5' // 显示值是倍数
//     textAlignSelect.value = 'left'
//     textCaseSelect.value = 'none'
//     paddingInput.value = '0'
//     autoWidthCheckbox.checked = true
//     autoHeightCheckbox.checked = true
//     fixedWidthInput.value = '400'
//     fixedHeightInput.value = '200'
//     fixedWidthInput.disabled = true
//     fixedHeightInput.disabled = true
//     textWrapSelect.value = 'normal'
//     textOverflowSelect.value = 'show'
//     btnBold?.classList.remove('active')
//     btnItalic?.classList.remove('active')
//     btnUnderline?.classList.remove('active')
//     btnStrike?.classList.remove('active')
//     return
//   }
//
//   // 获取当前样式（选区样式或基础样式）
//   const style = rt.isEditing && rt.selectionStart !== rt.selectionEnd
//     ? rt.getSelectionStyles()[0]
//     : rt.getStyleAt(0)
//   const s = style || {}
//
//   // 基础样式
//   fontSizeInput.value = String(s.fontSize ?? rt.fontSize ?? 24)
//   fillInput.value = getSolidColor(s.fill ?? rt.fill ?? '#333').slice(0, 7)
//   fontFamilyInput.value = (s.fontFamily ?? rt.fontFamily ?? 'Arial') as string
//   setFontWeightSelectValue(fontWeightSelect, s.fontWeight ?? rt.fontWeight)
//   strokeColorInput.value = getSolidColor((s as any).stroke ?? (rt as any).stroke ?? '#000').slice(0, 7)
//   strokeWidthInput.value = String((s as any).strokeWidth ?? (rt as any).strokeWidth ?? 0)
//   strokeAlignSelect.value = String((s as any).strokeAlign ?? (rt as any).strokeAlign ?? 'outside')
//   strokeCapSelect.value = String((s as any).strokeCap ?? (rt as any).strokeCap ?? 'none')
//   strokeJoinSelect.value = String((s as any).strokeJoin ?? (rt as any).strokeJoin ?? 'miter')
//   dashPatternInput.value = ((s as any).dashPattern ?? (rt as any).dashPattern ?? []).join(',')
//   dashOffsetInput.value = String((s as any).dashOffset ?? (rt as any).dashOffset ?? 0)
//
//   const outerShadow = pickFirstEffect((s as any).shadow ?? (rt as any).shadow)
//   shadowEnabled.checked = !!outerShadow
//   shadowColor.value = colorToHex(outerShadow?.color, '#000000')
//   shadowBlur.value = String(outerShadow?.blur ?? 8)
//   shadowOffsetX.value = String(outerShadow?.x ?? 0)
//   shadowOffsetY.value = String(outerShadow?.y ?? 4)
//   shadowSpread.value = String(outerShadow?.spread ?? 0)
//   shadowBlend.value = String(outerShadow?.blendMode ?? '')
//
//   const innerShadow = pickFirstEffect((s as any).innerShadow ?? (rt as any).innerShadow)
//   innerShadowEnabled.checked = !!innerShadow
//   innerShadowColor.value = colorToHex(innerShadow?.color, '#000000')
//   innerShadowBlur.value = String(innerShadow?.blur ?? 8)
//   innerShadowOffsetX.value = String(innerShadow?.x ?? 0)
//   innerShadowOffsetY.value = String(innerShadow?.y ?? 4)
//   innerShadowSpread.value = String(innerShadow?.spread ?? 0)
//   innerShadowBlend.value = String(innerShadow?.blendMode ?? '')
//
//   // 新属性
//   const letterSpacing = s.letterSpacing ?? rt.letterSpacing ?? 0
//   letterSpacingInput.value = String(typeof letterSpacing === 'number' ? letterSpacing : letterSpacing.value)
//
//   // lineHeight 是段落属性，从元素获取
//   const lineHeight = rt.lineHeight ?? 1.5
//   lineHeightInput.value = String(typeof lineHeight === 'number' ? lineHeight : lineHeight.value)
//
//   textAlignSelect.value = (rt.textAlign ?? 'left') as string
//   textCaseSelect.value = (s.textCase ?? rt.textCase ?? 'none') as string
//
//   const padding = rt.padding ?? 0
//   paddingInput.value = String(typeof padding === 'number' ? padding : padding[0])
//
//   autoWidthCheckbox.checked = rt.autoWidth ?? true
//   autoHeightCheckbox.checked = rt.autoHeight ?? true
//   fixedWidthInput.value = String(rt.width ?? 400)
//   fixedHeightInput.value = String(rt.height ?? 200)
//   fixedWidthInput.disabled = autoWidthCheckbox.checked
//   fixedHeightInput.disabled = autoHeightCheckbox.checked
//
//   textWrapSelect.value = (rt.textWrap ?? 'normal') as string
//   textOverflowSelect.value = (rt.textOverflow ?? 'show') as string
//
//   // 样式按钮
//   const styleObj = s as ICharStyle
//   const fw = styleObj.fontWeight
//   if (btnBold) {
//     btnBold.classList.toggle(
//       'active',
//       fw === 'bold' || fw === 700 || String(fw) === '700'
//     )
//   }
//   if (btnItalic) btnItalic.classList.toggle('active', !!styleObj.italic)
//   if (btnUnderline) btnUnderline.classList.toggle('active', !!styleObj.underline)
//   if (btnStrike) btnStrike.classList.toggle('active', !!styleObj.linethrough)
// }
//
// // 应用样式：未进入编辑或无选区时作用整段（全量样式），有选区时作用选区
// function applyStyle(styleObj: Partial<ICharStyle>) {
//   const rt = getCurrentRichText()
//   if (!rt) {
//     alert('请先选中文本')
//     return
//   }
//   const hasSelection = rt.isEditing && rt.selectionStart !== rt.selectionEnd
//   if (hasSelection) {
//     rt.setSelectionStyles(styleObj)
//   } else {
//     rt.setFullTextStyles(styleObj)
//   }
//   updatePanelFromRichText(rt)
// }
//
// // 事件监听（添加聚焦处理）
// function getCurrentStyleForPanel(rt: RichText): ICharStyle | undefined {
//   return rt.isEditing && rt.selectionStart !== rt.selectionEnd
//     ? rt.getSelectionStyles()[0]
//     : rt.getStyleAt(0)
// }
//
// fontSizeInput.addEventListener('input', () => {
//   applyStyle({ fontSize: parseInt(fontSizeInput.value) })
//   refocusTextarea()
// })
//
// fontFamilyInput.addEventListener('input', () => {
//   applyStyle({ fontFamily: fontFamilyInput.value })
//   refocusTextarea()
// })
//
// fontWeightSelect.addEventListener('change', () => {
//   applyStyle({ fontWeight: fontWeightSelect.value as IFontWeightString })
//   refocusTextarea()
// })
//
// fillInput.addEventListener('input', () => {
//   applyStyle({ fill: fillInput.value })
//   refocusTextarea()
// })
//
// strokeColorInput.addEventListener('input', () => {
//   const color = strokeColorInput.value
//   applyStyle({ stroke: { type: 'solid', color } } as any)
//   refocusTextarea()
// })
//
// strokeWidthInput.addEventListener('input', () => {
//   const width = parseFloat(strokeWidthInput.value || '0')
//   applyStyle({ strokeWidth: width } as any)
//   refocusTextarea()
// })
//
// strokeAlignSelect.addEventListener('change', () => {
//   applyStyle({ strokeAlign: strokeAlignSelect.value } as any)
//   refocusTextarea()
// })
//
// strokeCapSelect.addEventListener('change', () => {
//   applyStyle({ strokeCap: strokeCapSelect.value } as any)
//   refocusTextarea()
// })
//
// strokeJoinSelect.addEventListener('change', () => {
//   applyStyle({ strokeJoin: strokeJoinSelect.value } as any)
//   refocusTextarea()
// })
//
// dashPatternInput.addEventListener('input', () => {
//   const raw = dashPatternInput.value.trim()
//   const pattern = raw ? raw.split(',').map(v => parseFloat(v)).filter(v => !Number.isNaN(v)) : []
//   applyStyle({ dashPattern: pattern.length ? pattern : undefined } as any)
//   refocusTextarea()
// })
//
// dashOffsetInput.addEventListener('input', () => {
//   const offset = parseFloat(dashOffsetInput.value || '0')
//   applyStyle({ dashOffset: offset } as any)
//   refocusTextarea()
// })
//
// function applyShadowFromPanel(kind: 'outer' | 'inner') {
//   const shadow = buildShadowFromPanel(kind)
//   if (kind === 'outer') {
//     applyStyle({ shadow } as any)
//   } else {
//     applyStyle({ innerShadow: shadow } as any)
//   }
//   refocusTextarea()
// }
//
// shadowEnabled.addEventListener('change', () => applyShadowFromPanel('outer'))
// shadowColor.addEventListener('input', () => applyShadowFromPanel('outer'))
// shadowBlur.addEventListener('input', () => applyShadowFromPanel('outer'))
// shadowOffsetX.addEventListener('input', () => applyShadowFromPanel('outer'))
// shadowOffsetY.addEventListener('input', () => applyShadowFromPanel('outer'))
// shadowSpread.addEventListener('input', () => applyShadowFromPanel('outer'))
// shadowBlend.addEventListener('change', () => applyShadowFromPanel('outer'))
// innerShadowEnabled.addEventListener('change', () => applyShadowFromPanel('inner'))
// innerShadowColor.addEventListener('input', () => applyShadowFromPanel('inner'))
// innerShadowBlur.addEventListener('input', () => applyShadowFromPanel('inner'))
// innerShadowOffsetX.addEventListener('input', () => applyShadowFromPanel('inner'))
// innerShadowOffsetY.addEventListener('input', () => applyShadowFromPanel('inner'))
// innerShadowSpread.addEventListener('input', () => applyShadowFromPanel('inner'))
// innerShadowBlend.addEventListener('change', () => applyShadowFromPanel('inner'))
//
// btnBold.addEventListener('click', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//   const s = getCurrentStyleForPanel(rt)
//   const fw = s?.fontWeight
//   const isBold = fw === 'bold' || fw === 700 || String(fw) === '700'
//   applyStyle({ fontWeight: isBold ? 'normal' : 'bold' })
//   refocusTextarea()
// })
//
// btnItalic.addEventListener('click', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//   const s = getCurrentStyleForPanel(rt)
//   const isItalic = s?.italic === true
//   applyStyle({ italic: !isItalic })
//   refocusTextarea()
// })
//
// btnUnderline.addEventListener('click', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//   const s = getCurrentStyleForPanel(rt)
//   const hasUnderline = s?.underline === true
//   applyStyle({ underline: !hasUnderline })
//   refocusTextarea()
// })
//
// btnStrike.addEventListener('click', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//   const s = getCurrentStyleForPanel(rt)
//   const hasStrike = s?.linethrough === true
//   applyStyle({ linethrough: !hasStrike })
//   refocusTextarea()
// })
//
// // 新属性控件事件
// letterSpacingInput.addEventListener('input', () => {
//   applyStyle({ letterSpacing: parseFloat(letterSpacingInput.value) })
//   refocusTextarea()
// })
//
// lineHeightInput.addEventListener('input', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//   const v = parseFloat(lineHeightInput.value) || 1.5
//   rt.lineHeight = { type: 'percent', value: v }
//   updatePanelFromRichText(rt)
//   refocusTextarea()
// })
//
// textAlignSelect.addEventListener('change', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//   // textAlign 是段落属性，应用到整个元素
//   rt.textAlign = textAlignSelect.value as any
//   updatePanelFromRichText(rt)
//   refocusTextarea()
// })
//
// textCaseSelect.addEventListener('change', () => {
//   applyStyle({ textCase: textCaseSelect.value as any })
//   refocusTextarea()
// })
//
// paddingInput.addEventListener('input', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//   rt.padding = parseFloat(paddingInput.value)
//   refocusTextarea()
// })
//
// textWrapSelect.addEventListener('change', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//   rt.textWrap = textWrapSelect.value as any
//   refocusTextarea()
// })
//
// textOverflowSelect.addEventListener('change', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//   rt.textOverflow = textOverflowSelect.value
//   refocusTextarea()
// })
//
// // 调试模式切换
// debugModeCheckbox.addEventListener('change', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//   rt.debugMode = debugModeCheckbox.checked
//   rt.forceRender()
// })
//
// // 自动宽度控制
// autoWidthCheckbox.addEventListener('change', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//
//   // 如果切换为固定宽度，且当前 width 为 0，设置为当前实际宽度
//   if (!autoWidthCheckbox.checked && (!rt.width || rt.width <= 0)) {
//     const currentWidth = rt.__layout.boxBounds.width
//     rt.width = currentWidth > 0 ? currentWidth : 400
//     fixedWidthInput.value = String(rt.width)
//   }
//
//   rt.autoWidth = autoWidthCheckbox.checked
//   fixedWidthInput.disabled = autoWidthCheckbox.checked
//   updatePanelFromRichText(rt)
//   refocusTextarea()
// })
//
// // 自动高度控制
// autoHeightCheckbox.addEventListener('change', () => {
//   const rt = getCurrentRichText()
//   if (!rt) return
//
//   // 如果切换为固定高度，且当前 height 为 0，设置为当前实际高度
//   if (!autoHeightCheckbox.checked && (!rt.height || rt.height <= 0)) {
//     const currentHeight = rt.__layout.boxBounds.height
//     rt.height = currentHeight > 0 ? currentHeight : 200
//     fixedHeightInput.value = String(rt.height)
//   }
//
//   rt.autoHeight = autoHeightCheckbox.checked
//   fixedHeightInput.disabled = autoHeightCheckbox.checked
//   updatePanelFromRichText(rt)
//   refocusTextarea()
// })
//
// // 固定宽度输入
// fixedWidthInput.addEventListener('input', () => {
//   const rt = getCurrentRichText()
//   if (!rt || rt.autoWidth) return
//   rt.width = parseFloat(fixedWidthInput.value)
//   updatePanelFromRichText(rt)
//   refocusTextarea()
// })
//
// // 固定高度输入
// fixedHeightInput.addEventListener('input', () => {
//   const rt = getCurrentRichText()
//   if (!rt || rt.autoHeight) return
//   rt.height = parseFloat(fixedHeightInput.value)
//   updatePanelFromRichText(rt)
//   refocusTextarea()
// })
//
// // 重新聚焦当前 RichText 的 textarea（仅编辑中时有效）
// function refocusTextarea() {
//   const rt = getCurrentRichText()
//   if (!rt?.isEditing) return
//   const activeEl = document.activeElement as HTMLElement | null
//   const inPanel = activeEl?.closest?.('[data-rt-panel]') || activeEl?.closest?.('.panel')
//   const isTextEntry =
//     activeEl?.tagName === 'INPUT' ||
//     activeEl?.tagName === 'SELECT' ||
//     activeEl?.tagName === 'TEXTAREA'
//   if (inPanel && isTextEntry) return
//   setTimeout(() => rt.refocus(), 50)
// }
//
// btnSelectAll.addEventListener('click', () => {
//   const rt = getCurrentRichText()
//   if (!rt) {
//     alert('请先选中或点击文本')
//     return
//   }
//   if (!rt.isEditing) rt.enterEditing()
//   rt.selectAll()
//   refocusTextarea()
// })
//
// btnClearStyles.addEventListener('click', () => {
//   const rt = getCurrentRichText()
//   if (!rt) {
//     alert('请先选中文本')
//     return
//   }
//   if (rt.isEditing && rt.selectionStart !== rt.selectionEnd) {
//     rt.clearSelectionStyles()
//   } else {
//     rt.clearFullTextStyles()
//   }
//   updatePanelFromRichText(rt)
//   refocusTextarea()
// })
//
// btnAddText.addEventListener('click', () => {
//   const newText = new RichText({
//     x: 100,
//     y: 450,
//     text: '各位老铁好~为了帮助各位高粉达人有更高的播放和转化收益，我们将在官方剧单内从不同维度设置五个榜单，且每日更新；并针对榜单剧进行额外的现金激励。',
//     fontSize: 20,
//     fill: [{
//       type: 'solid',
//       color: '#666'
//     }],
//     editable: true,
//     shadow: {
//       color: '#000000',
//       blur: 8,
//       x: 0,
//       y: 4,
//       spread: 0
//     },
//
//     // 固定宽度，自动高度（测试编辑时换行）
//     width: 664,
//     autoWidth: false,  // 固定宽度
//     autoHeight: true,  // 高度自动
//
//     // 段落属性
//     lineHeight: { type: 'percent', value: 1.8 },
//     textAlign: 'left',
//     padding: 15,
//     textWrap: 'normal',
//
//     // 字符级样式（测试不同字号的换行）
//     styleRanges: [
//       { start: 0, end: 2, fontSize: 32, fontWeight: 'bold', fill: '#ff6600' },  // "测试" 大字号
//       { start: 9, end: 11, fontSize: 28, italic: true, fill: '#0088ff' }  // "测试" 大字号
//     ],
//     onEditingEntered: () => updateSelectionInfo(),
//     onEditingExited: () => updateSelectionInfo()
//   })
//   app.tree.add(newText)
//   console.log('✅ 新增文本 - 测试固定宽度下大字号的换行')
//   console.log('提示：双击进入编辑，在"测试"后面输入更多大字号文字，应该会自动换行')
//   // 选中新文本，使右侧面板立即作用于它
//   if (editor) editor.select(newText as any)
//   setCurrentRichText(newText)
// })
//
//
// btnExportJSON.addEventListener('click', () => {
//   const canvasJSON = app.tree.toJSON()
//
//   const enhancedData: any = {
//     version: '1.0',
//     canvas: canvasJSON,
//     richtexts: []
//   }
//
//   // 遍历查找所有 RichText 元素
//   app.tree.children.forEach((child: any) => {
//     if (child.__tag === 'RichText') {
//       const richtextData = {
//         innerId: child.innerId,
//         text: child.text,
//         styles: serializeStyles(child._styles),  // 字符级样式
//         bounds: {
//           x: child.x,
//           y: child.y,
//           width: child.width
//         },
//         textProps: {
//           fontSize: child.fontSize,
//           fontFamily: child.fontFamily,
//           fontWeight: child.fontWeight,
//           fill: child.fill,
//           italic: child.italic,
//           editable: child.editable
//         }
//       }
//       enhancedData.richtexts.push(richtextData)
//     }
//   })
//
//   // 复制到剪贴板
//   const exportText = JSON.stringify(enhancedData, null, 2)
//   navigator.clipboard.writeText(exportText).then(() => {
//     alert(`✅ 画布 JSON 已导出！
//
// 📋 已复制到剪贴板
// 📊 包含 ${enhancedData.richtexts.length} 个 RichText 元素
// 🎨 包含完整的字符级样式数据
//
// 请查看控制台获取详细内容。`)
//   }).catch(() => {
//     alert('✅ JSON 已导出到控制台！\n\n查看控制台获取完整数据。')
//   })
// })
//
// // 序列化 Map 样式为普通对象
// function serializeStyles(stylesMap: any): any {
//   const result: any = {}
//   if (!stylesMap || !stylesMap.entries) return result
//
//   for (const [lineIdx, lineStyles] of stylesMap.entries()) {
//     result[lineIdx] = {}
//     if (lineStyles && lineStyles.entries) {
//       for (const [charIdx, style] of lineStyles.entries()) {
//         result[lineIdx][charIdx] = style
//       }
//     }
//   }
//   return result
// }
//
// // 更新选区信息显示（基于当前 RichText）
// function updateSelectionInfo() {
//   const rt = getCurrentRichText()
//   if (!rt) {
//     selectionInfo.textContent = '未选中文本'
//     return
//   }
//   if (rt.isEditing) {
//     const start = rt.selectionStart
//     const end = rt.selectionEnd
//     const length = end - start
//     selectionInfo.textContent = length > 0
//       ? `选中了 ${length} 个字符 (${start}-${end})`
//       : `光标位置: ${start}`
//   } else {
//     selectionInfo.textContent = '已选中，双击进入编辑'
//   }
// }
//
// // 定时更新选区信息
// setInterval(updateSelectionInfo, 100)
//
// // ============================================================
// // 富文本边界 Case 测试用例集
// // 每个用例都可双击进入编辑，用于验证对齐 / 光标 / 选区 / 字间距 / 换行等
// // ============================================================
//
// interface ITestCase {
//   title: string
//   hint: string
//   data: IRichTextInputData
// }
//
// /** 子串 → grapheme 索引区间（styleRanges 用的是 grapheme 索引） */
// function styleRangeOf(text: string, sub: string, style: Partial<ICharStyle>, occurrence = 0): IStyleRange {
//   let idx = -1
//   for (let i = 0; i <= occurrence; i++) idx = text.indexOf(sub, idx + 1)
//   const start = idx < 0 ? 0 : graphemeSplit(text.slice(0, idx)).length
//   return { start, end: start + graphemeSplit(sub).length, ...style } as IStyleRange
// }
//
// const CASE_BASE: Partial<IRichTextInputData> = {
//   fontSize: 18,
//   fill: '#333',
//   editable: true,
//   padding: 10
// }
//
// function buildTestCases(): ITestCase[] {
//   const cases: ITestCase[] = []
//
//   // 1. 混合字号：行盒高度 / 基线 / 光标高度
//   {
//     const text = 'Ag 48px 与 12px 混排，基线应对齐 Ag'
//     cases.push({
//       title: '1. 混合字号 · 行盒与基线',
//       hint: '大小字号应共享基线；行高应由行内最大字号决定；光标高度跟随行盒',
//       data: {
//         ...CASE_BASE,
//         text,
//         autoWidth: true,
//         autoHeight: true,
//         lineHeight: { type: 'percent', value: 1.5 },
//         styleRanges: [
//           styleRangeOf(text, 'Ag', { fontSize: 48, fontWeight: 'bold', fill: '#ff4d4f' }, 0),
//           styleRangeOf(text, '12px', { fontSize: 12, fill: '#1890ff' }),
//           styleRangeOf(text, 'Ag', { fontSize: 36, italic: true, fill: '#52c41a' }, 1)
//         ]
//       }
//     })
//   }
//
//   // 2. autoWidth 多行居中 / 右对齐
//   cases.push({
//     title: '2. autoWidth 多行 · 居中对齐',
//     hint: '自动宽度下多行也应按最长行居中（旧版本此处对齐完全失效）',
//     data: {
//       ...CASE_BASE,
//       text: '短行\n这是最长的一行文本内容\n中等长度行\n末行',
//       autoWidth: true,
//       autoHeight: true,
//       textAlign: 'center'
//     }
//   })
//
//   cases.push({
//     title: '3. autoWidth 多行 · 右对齐 + 字间距',
//     hint: '右对齐时行末不应多出一个 letterSpacing 的空隙',
//     data: {
//       ...CASE_BASE,
//       text: 'IIII\n右对齐检查右边缘\nWWWWWW',
//       autoWidth: true,
//       autoHeight: true,
//       textAlign: 'right',
//       letterSpacing: 6
//     }
//   })
//
//   // 4. 固定宽度居中 + 空行：空行光标/选区位置
//   cases.push({
//     title: '4. 固定宽度居中 · 空行光标',
//     hint: '空行（第 2、4 行）的光标与选区应居中，而不是贴最左侧',
//     data: {
//       ...CASE_BASE,
//       text: '第一行\n\n第三行（上下各有空行）\n\n第五行',
//       width: 420,
//       autoWidth: false,
//       autoHeight: true,
//       textAlign: 'center'
//     }
//   })
//
//   // 5. 两端对齐 + CJK 软换行
//   cases.push({
//     title: '5. 两端对齐 · CJK 软换行',
//     hint: '两端对齐不应超出右边界；闭合标点（，。）不应出现在行首；段末行不拉伸',
//     data: {
//       ...CASE_BASE,
//       text: '两端对齐用于检查右边界是否溢出，闭合标点不能出现在行首，例如逗号、句号、右括号）等等，最后一行不应被强制拉伸。',
//       width: 420,
//       autoWidth: false,
//       autoHeight: true,
//       textAlign: 'justify',
//       letterSpacing: 1
//     }
//   })
//
//   // 6. 段落缩进 + 段间距
//   cases.push({
//     title: '6. 段落缩进 + 段间距',
//     hint: '缩进只作用于段落首行，软换行续行不缩进；段间距只在段首行之前',
//     data: {
//       ...CASE_BASE,
//       text: '第一段落文字比较长，需要发生软换行才能看出续行是否被错误地二次缩进。\n第二段落。\n第三段落同样比较长，用于确认段间距只加在段首行之前而不是每一行。',
//       width: 420,
//       autoWidth: false,
//       autoHeight: true,
//       paraIndent: 32,
//       paraSpacing: 16
//     }
//   })
//
//   // 7. 混合字号软换行：换行位置必须按真实字号
//   {
//     const text = '这里有一段很大的字号 BIGBIG 后面继续跟随普通字号的文字用于验证换行位置是否按真实字号计算'
//     cases.push({
//       title: '7. 混合字号软换行位置',
//       hint: '大字号部分应参与换行宽度计算，不应溢出右边界',
//       data: {
//         ...CASE_BASE,
//         text,
//         width: 420,
//         autoWidth: false,
//         autoHeight: true,
//         styleRanges: [styleRangeOf(text, 'BIGBIG', { fontSize: 40, fontWeight: 'bold', fill: '#722ed1' })]
//       }
//     })
//   }
//
//   // 8. textCase：测量与绘制必须一致
//   {
//     const text = 'upper case test / title case test'
//     cases.push({
//       title: '8. textCase · upper / title',
//       hint: 'upper 不应字符重叠（测量与绘制同字形）；title 只大写词首',
//       data: {
//         ...CASE_BASE,
//         text,
//         autoWidth: true,
//         autoHeight: true,
//         styleRanges: [
//           styleRangeOf(text, 'upper case test', { textCase: 'upper', fill: '#fa541c' }),
//           styleRangeOf(text, 'title case test', { textCase: 'title', fill: '#13c2c2' })
//         ]
//       }
//     })
//   }
//
//   // 9. 装饰线 + 大字间距：不应断线
//   {
//     const text = '下划线连续性检查 删除线连续性检查'
//     cases.push({
//       title: '9. 装饰线 + 大字间距',
//       hint: '字间距处装饰线应连续不断线；线宽随字号缩放',
//       data: {
//         ...CASE_BASE,
//         text,
//         autoWidth: true,
//         autoHeight: true,
//         letterSpacing: 8,
//         styleRanges: [
//           styleRangeOf(text, '下划线连续性检查', { textDecoration: 'under', fontSize: 28 }),
//           styleRangeOf(text, '删除线连续性检查', { textDecoration: 'delete', fill: '#eb2f96' })
//         ]
//       }
//     })
//   }
//
//   // 10. Emoji / 组合字符 / 国旗
//   cases.push({
//     title: '10. Emoji · 组合字符 · 国旗',
//     hint: '左右方向键应整体跳过 emoji；ZWJ 家族、肤色修饰符、国旗不应被拆开',
//     data: {
//       ...CASE_BASE,
//       text: '👨‍👩‍👧‍👦 家族 👍🏽 肤色 🇨🇳🇯🇵 国旗 é 组合 ❤️ 变体',
//       autoWidth: true,
//       autoHeight: true,
//       fontSize: 24
//     }
//   })
//
//   // 11. 固定宽高 + 垂直居中
//   cases.push({
//     title: '11. 固定宽高 · 垂直居中',
//     hint: 'verticalAlign 需要 autoHeight=false；点击顶部/底部空白时光标定位应合理',
//     data: {
//       ...CASE_BASE,
//       text: '垂直居中\n第二行',
//       width: 420,
//       height: 160,
//       autoWidth: false,
//       autoHeight: false,
//       textAlign: 'center',
//       verticalAlign: 'middle'
//     }
//   })
//
//   // 12. textOverflow 省略符
//   cases.push({
//     title: '12. textOverflow · 省略符',
//     hint: '省略符位置应按字号与 padding 计算（旧版硬编码 width-30 / height-5）',
//     data: {
//       ...CASE_BASE,
//       text: '内容超出固定宽高时会被裁剪，右下角绘制自定义省略符。这里再补一些文字确保一定溢出。',
//       width: 420,
//       height: 90,
//       autoWidth: false,
//       autoHeight: false,
//       textOverflow: '...'
//     }
//   })
//
//   // 13. 结尾换行符 / 连续换行
//   cases.push({
//     title: '13. 结尾换行 + 连续空行',
//     hint: '末尾空行应可定位光标；连续空行不应错乱段首缩进',
//     data: {
//       ...CASE_BASE,
//       text: '行1\n\n\n行4（后面还有一个空行）\n',
//       width: 420,
//       autoWidth: false,
//       autoHeight: true
//     }
//   })
//
//   // 14. 描边 + 渐变 + 阴影
//   {
//     const text = '描边 渐变 外阴影 内阴影'
//     cases.push({
//       title: '14. 描边 / 渐变 / 阴影',
//       hint: '阴影不受裁剪影响；描边 inside/outside 表现不同',
//       data: {
//         ...CASE_BASE,
//         text,
//         autoWidth: true,
//         autoHeight: true,
//         fontSize: 34,
//         fontWeight: 'bold',
//         styleRanges: [
//           styleRangeOf(text, '描边', {
//             stroke: { type: 'solid', color: '#000' },
//             strokeWidth: 3,
//             strokeAlign: 'outside',
//             fill: '#fff'
//           }),
//           styleRangeOf(text, '渐变', {
//             fill: {
//               type: 'linear',
//               from: 'left',
//               to: 'right',
//               stops: [
//                 { offset: 0, color: '#ff4d4f' },
//                 { offset: 1, color: '#52c41a' }
//               ]
//             } as any
//           }),
//           styleRangeOf(text, '外阴影', {
//             shadow: { color: '#00000066', blur: 6, x: 3, y: 3, spread: 0 }
//           } as any),
//           styleRangeOf(text, '内阴影', {
//             fill: '#ffa940',
//             innerShadow: { color: '#00000099', blur: 4, x: 2, y: 2, spread: 0 }
//           } as any)
//         ]
//       }
//     })
//   }
//
//   // 15. 空文本
//   cases.push({
//     title: '15. 空文本',
//     hint: '空文本双击进入编辑应能看到闪烁光标',
//     data: {
//       ...CASE_BASE,
//       text: '',
//       width: 260,
//       autoWidth: false,
//       autoHeight: true
//     }
//   })
//
//   // 16. textWrap: none + 超长单行
//   cases.push({
//     title: '16. textWrap none · 超长单行',
//     hint: '不换行时溢出显示；点击行尾右侧空白光标应停在行尾',
//     data: {
//       ...CASE_BASE,
//       text: '这一行很长且设置了 textWrap: none 因此不会自动换行',
//       width: 300,
//       autoWidth: false,
//       autoHeight: true,
//       textWrap: 'none'
//     }
//   })
//
//   // 17. 撤销 / 重做验证
//   cases.push({
//     title: '17. 撤销 / 重做（Ctrl+Z / Ctrl+Shift+Z）',
//     hint: '选中局部改字号后 Ctrl+Z 应能撤销样式；连续键入应合并为一步',
//     data: {
//       ...CASE_BASE,
//       text: '选中这几个字改字号，然后按 Ctrl+Z 撤销',
//       width: 420,
//       autoWidth: false,
//       autoHeight: true
//     }
//   })
//
//   return cases
// }
//
// function mountTestCases(): void {
//   const cases = buildTestCases()
//   const COLUMNS = 3
//   const COLUMN_WIDTH = 520
//   const START_X = 100
//   const START_Y = 820
//   const GAP_Y = 28
//
//   const created: Array<{ label: Text; rt: RichText; col: number }> = []
//
//   cases.forEach((testCase, index) => {
//     const col = index % COLUMNS
//
//     const label = new Text({
//       text: `${testCase.title}\n${testCase.hint}`,
//       fontSize: 12,
//       lineHeight: 18,
//       fill: '#8c8c8c',
//       width: COLUMN_WIDTH - 40,
//       textWrap: 'normal'
//     })
//
//     const rt = new RichText({
//       ...testCase.data,
//       onEditingEntered: () => updateSelectionInfo(),
//       onEditingExited: () => updateSelectionInfo()
//     })
//
//     app.tree.add(label)
//     app.tree.add(rt)
//     created.push({ label, rt, col })
//   })
//
//   // 需要真实 boxBounds 才能按列纵向排布
//   const relayout = () => {
//     ;(app.tree as any).updateLayout?.()
//
//     const columnY = new Array(COLUMNS).fill(START_Y)
//
//     for (const { label, rt, col } of created) {
//       const x = START_X + col * COLUMN_WIDTH
//
//       label.x = x
//       label.y = columnY[col]
//       columnY[col] += (label.__layout?.boxBounds?.height || 36) + 6
//
//       rt.x = x
//       rt.y = columnY[col]
//       columnY[col] += Math.max(rt.__layout?.boxBounds?.height || 40, 40) + GAP_Y
//     }
//   }
//
//   relayout()
//   // 字体/首次布局完成后再排一次，避免高度取到默认值
//   setTimeout(relayout, 300)
//
//   console.log(`🧪 已挂载 ${created.length} 个富文本测试用例（画布 y≥${START_Y} 区域，共 ${COLUMNS} 列）`)
//   console.table(cases.map((c, i) => ({ '#': i + 1, 用例: c.title, 关注点: c.hint })))
// }
//
// mountTestCases()
