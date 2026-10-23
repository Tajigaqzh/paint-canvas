import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";

/** 管理指定容器的浏览器全屏状态与切换。 */
export const useFullscreen = (elementRef: RefObject<HTMLElement | null>) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void elementRef.current?.requestFullscreen();
    }
  }, [elementRef]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

    document.addEventListener("fullscreenchange", onChange);

    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return { isFullscreen, toggleFullscreen };
};
