/**
 * 实验页用的图片缓存 Service Worker 注册。
 * 制作页默认不注册：线上加载走 Dedicated Worker（`image-cache/`），避免 SW 拦截干扰开发端口。
 */
const IMAGE_CACHE_SERVICE_WORKER_URL = "/image-cache-sw.js";

/** 在 window.load 后注册 `/image-cache-sw.js`，作用域为站点根路径。 */
export function registerImageCacheServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (import.meta.env.SSR) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(IMAGE_CACHE_SERVICE_WORKER_URL, {
      scope: "/",
    });
  });
}
