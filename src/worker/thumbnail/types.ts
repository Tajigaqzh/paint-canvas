import type { CanvasPage } from "@/types";

export type ThumbnailRenderSize = {
  height: number;
  width: number;
};

export type ThumbnailRenderRequest = {
  page: CanvasPage;
  requestId: string;
  size: ThumbnailRenderSize;
  type: "render";
};

export type ThumbnailRenderSuccess = {
  bitmap: ImageBitmap;
  pageId: string;
  requestId: string;
  type: "rendered";
};

export type ThumbnailRenderError = {
  error: string;
  pageId: string;
  requestId: string;
  type: "error";
};

export type ThumbnailWorkerRequest = ThumbnailRenderRequest;

export type ThumbnailWorkerResponse = ThumbnailRenderSuccess | ThumbnailRenderError;
