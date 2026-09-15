/** 放大镜一次性取样区域，单位是源画布的设备像素。 */
export type MagnifierSample = {
  /** 取样区域左上角在源画布里的设备像素 x，越界时允许为负。 */
  sx: number;
  /** 取样区域左上角在源画布里的设备像素 y，越界时允许为负。 */
  sy: number;
  /** 取样区域边长，设备像素。 */
  sw: number;
  /** 取样区域边长，设备像素。 */
  sh: number;
};

/**
 * 放大镜配置，全部可选，之后也能用 set() 或各个存取器改。
 *
 * 这里没有任何状态容器：插件只提供命令式 API（enabled / size / zoom）和 DOM 事件，
 * 状态由宿主自己管 —— React store、Vue reactive、一个模块级变量都可以。
 */
export type MagnifierConfig = {
  /** 是否启用。禁用时不响应指针并收起镜片，默认 true。 */
  enabled?: boolean;
  /** 镜片直径，CSS 像素，默认 200。 */
  size?: number;
  /** 相对当前屏幕显示的放大倍数，1 表示和画布显示一样大，默认 3。 */
  zoom?: number;
  /** 镜片的定位容器，需要能作为绝对定位参照；默认取 Leafer 画布的父元素。 */
  container?: HTMLElement | null;
  /** 监听指针的元素，默认取 Leafer 画布的父元素。 */
  view?: HTMLElement | null;
  /** 镜片元素的 class，方便宿主用样式表追加外观。 */
  className?: string;
  /** 覆盖镜片的默认外观；写的是行内样式，优先级高于样式表。 */
  style?: Record<string, string>;
};
