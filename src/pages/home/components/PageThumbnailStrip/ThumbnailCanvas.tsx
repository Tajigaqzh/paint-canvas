import { useEffect, useRef } from "react";
import { THUMBNAIL_SIZE } from "@/worker/page-thumbnail/constants";

type ThumbnailCanvasProps = {
  /** worker 返回的页面位图；为空时画布保持空白。 */
  bitmap?: ImageBitmap;
};

/** 将 worker 返回的 ImageBitmap 绘制到缩略图 canvas 中。 */
export function ThumbnailCanvas({ bitmap }: ThumbnailCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !bitmap) return;

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");

    context?.clearRect(0, 0, canvas.width, canvas.height);
    context?.drawImage(bitmap, 0, 0);
  }, [bitmap]);

  return (
    <canvas
      aria-hidden="true"
      className="page-thumbnail__canvas"
      height={THUMBNAIL_SIZE.height}
      ref={canvasRef}
      width={THUMBNAIL_SIZE.width}
    />
  );
}
