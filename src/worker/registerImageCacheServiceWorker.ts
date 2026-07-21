const IMAGE_CACHE_SERVICE_WORKER_URL = "/image-cache-sw.js";

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
