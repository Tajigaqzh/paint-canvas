/**
 * 生成随橡皮尺寸变化的光标，热点落在橡皮左下方，与图标实际接触画布的位置一致。
 * home 与 preview 共用同一套橡皮光标，放在这里避免两份实现 drift。
 */
export const createEraserCursor = (size: number) => {
  const cursorSize = Math.max(12, Math.min(size, 64));
  const hotspotX = Math.max(1, Math.round(cursorSize * 0.125));
  const hotspotY = Math.max(1, Math.round(cursorSize * 0.875));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${cursorSize}" height="${cursorSize}"><path d="M567.494 765.551L270.292 557.448c-22.62-15.839-28.117-47.016-12.278-69.636l234.648-335.113c15.84-22.62 47.017-28.118 69.637-12.28L859.5 348.524c22.62 15.839 28.118 47.016 12.28 69.636L637.13 753.272c-15.839 22.62-47.016 28.118-69.636 12.28zM382.44 861.973L242.979 764.32c-45.241-31.678-56.236-94.032-24.558-139.273l22.28-31.82 303.294 212.369-22.28 31.82c-31.678 45.24-94.033 56.235-139.273 24.557z" fill="#1AA5FF"/></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, auto`;
};
