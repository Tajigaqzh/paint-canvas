// RichText 插件导出
export { RichText } from './RichText'
export { RichTextEditor } from './RichTextEditor'
export type {
  IRichTextInputData,
  ICharStyle,
  IStyleRange,
  IFontWeightString,
  IRichTextFontWeight
} from './types'
export {
  FONT_WEIGHT_STRING_VALUES,
  resolveFontWeightForCanvas,
  numericFontWeightToNamed,
  fontWeightToPanelValue,
  graphemeSplit
} from './utils'

import { Plugin } from 'leafer-ui'
Plugin.add('RichTextEditor', 'editor')

/** 
 * 安装插件（注册内部编辑器）
 * 引入本包时已自动注册，仅需在未通过主入口引入时调用
 */
export function install(): void {
  Plugin.add('RichTextEditor', 'editor')
}
