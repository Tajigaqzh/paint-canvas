/** 画布视图尺寸。 */
export type CanvasViewSize = {
  height: number;
  width: number;
};

/** 量不到 shell 时用的兜底视图尺寸，保证首帧也能算出画板布局。 */
export const FALLBACK_VIEW_SIZE: CanvasViewSize = {
  height: 540,
  width: 960,
};

/**
 * 把画布 shell 的 padding box 尺寸换算成 Leafer 挂载区尺寸。
 *
 * `useSize` 量的是 shell 的 clientWidth / clientHeight，也就是 padding box；
 * 而 Leafer 只挂在 shell 的内容区，标尺和白板布局也按内容区算，
 * 所以这里要扣掉内边距，否则视图尺寸会比真实挂载区大两份 padding，白板会被裁掉一条。
 * 内边距从元素上现读，避免和 index.less 里的数字各写一份。
 */
export const getCanvasViewSize = (
  shellSize: CanvasViewSize | undefined,
  shell: HTMLElement | null,
): CanvasViewSize => {
  if (!shellSize || !shell) return { ...FALLBACK_VIEW_SIZE };

  const style = window.getComputedStyle(shell);
  const paddingX = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  const paddingY = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const width = shellSize.width - paddingX;
  const height = shellSize.height - paddingY;

  // 首帧还没挂载、或者 jsdom 里量不到真实尺寸时，先用兜底尺寸渲染。
  if (width <= 0 || height <= 0) return { ...FALLBACK_VIEW_SIZE };

  return { height, width };
};
