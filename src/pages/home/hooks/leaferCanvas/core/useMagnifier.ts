import { useEffect, useRef } from "react";
import { Magnifier } from "leafer-x-magnifier";
import type { UseLeaferCanvasOptions } from "@/types";
import type { useRuntime } from "./useRuntime";

type Runtime = ReturnType<typeof useRuntime>;

type UseMagnifierParams = Pick<UseLeaferCanvasOptions, "magnifierContainerRef" | "tool"> &
  Pick<Runtime, "appRef" | "toolRef">;

/**
 * 把 leafer-x-magnifier 接到制作页上。
 *
 * 插件本身不依赖任何框架，也不持有业务状态；这里只做三件事：
 * 把 app 和镜片定位容器交给它、把 React 状态同步成命令式调用、卸载时销毁实例。
 */
export const useMagnifier = ({
  appRef,
  magnifierContainerRef,
  tool,
  toolRef,
}: UseMagnifierParams) => {
  const magnifierRef = useRef<Magnifier | null>(null);
  const mode = tool.mode;
  const size = tool.magnifierSize;
  const zoom = tool.magnifierZoom;

  // app 和容器都是稳定实例，这个 effect 只跑一次；初始值从 toolRef 读，避免依赖 React 状态。
  useEffect(() => {
    const app = appRef.current;

    // LeaferApp 还没初始化时，等初始化 effect 完成后再创建插件。
    if (!app) return undefined;

    const tool = toolRef.current;
    const magnifier = new Magnifier(app, {
      container: magnifierContainerRef.current,
      enabled: tool.mode === "magnifier",
      size: tool.magnifierSize,
      zoom: tool.magnifierZoom,
    });

    magnifierRef.current = magnifier;

    return () => {
      magnifier.dispose();
      magnifierRef.current = null;
    };
  }, [appRef, magnifierContainerRef, toolRef]);

  // 工具模式和镜片参数都是 React 状态，这里单向同步成插件的命令式 API。
  useEffect(() => {
    magnifierRef.current?.set({ enabled: mode === "magnifier", size, zoom });
  }, [mode, size, zoom]);
};
