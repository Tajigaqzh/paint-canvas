import type { CanvasCornerRadius } from "@/types";

export const cornerRadiusLabels = ["左上", "右上", "右下", "左下"] as const;

export const toCornerRadiusValues = (
  value: CanvasCornerRadius | undefined,
): [number, number, number, number] => {
  if (Array.isArray(value)) {
    if (value.length === 4) {
      return [...value];
    }

    if (value.length === 3) {
      return [value[0], value[1], value[2], value[1]];
    }

    if (value.length === 2) {
      return [value[0], value[1], value[0], value[1]];
    }
  }

  const radius = typeof value === "number" ? value : 0;

  return [radius, radius, radius, radius];
};

export const patchCornerRadius = (
  cornerRadius: CanvasCornerRadius | undefined,
  index: number,
  value: number | null,
) => {
  const next = toCornerRadiusValues(cornerRadius);

  next[index] = Math.max(0, Math.round(value ?? 0));

  return next as [number, number, number, number];
};
