import type { IRectInputData } from "@leafer-ui/interface";

export type VideoPlayerConfig = Omit<IRectInputData, "width" | "height"> & {
  width: number;
  height: number;
  src: string;
  poster?: string;
  resizeMode?: "cover" | "contain";
  muted?: boolean;
  loop?: boolean;
};
