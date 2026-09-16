export type VideoDrawRect = { dx: number; dy: number; width: number; height: number };

export const getVideoDrawRect = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  resizeMode: "cover" | "contain",
): VideoDrawRect => {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { dx: 0, dy: 0, width: targetWidth, height: targetHeight };
  }
  const scale = resizeMode === "cover"
    ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
    : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { dx: (targetWidth - width) / 2, dy: (targetHeight - height) / 2, width, height };
};
