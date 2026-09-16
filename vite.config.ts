import { fileURLToPath, URL } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), babel({ presets: [reactCompilerPreset()] })],
  optimizeDeps: {
    include: [
      "@leafer-in/animate",
      "@leafer-in/editor",
      "@leafer-in/text-editor",
      "@leafer-ui/core",
      "@leafer-ui/draw",
      "leafer-ui",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5174,
  },
  build: {
    // antd 体积天然偏大，拆成独立 vendor chunk 是有意为之，提高阈值避免噪声告警。
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        /**
         * 把体积大、更新频率低的三方依赖拆成独立 vendor chunk。
         * 它们几乎不随业务代码变动，拆出来后能被浏览器长期缓存，
         * 业务 chunk 重新发布时不必重新下载 leafer / antd / react。
         * 判断依据是 node_modules 里的包名片段（pnpm 路径形如
         * node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/），
         * 自研 leafer-x-* 插件走 workspace 源码，按包名前缀单独归到 leafer chunk。
         */
        manualChunks(id) {
          if (id.includes("leafer-x-")) return "leafer";

          if (id.includes("node_modules")) {
            if (/[\\/]node_modules[\\/][^\\/]*leafer[^\\/]*[\\/]/.test(id)) return "leafer";
            if (/[\\/]node_modules[\\/](?:antd|@ant-design|rc-[^\\/]*|dayjs)[\\/]/.test(id)) return "antd";
            if (
              /[\\/]node_modules[\\/](?:react|react-dom|react-router[^\\/]*|scheduler|use-sync-external-store)[\\/]/.test(
                id,
              )
            )
              return "react";

            return "vendor";
          }
        },
      },
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
    globals: true,
    // .test.ts 走 Node；组件和依赖 window 的用例走 jsdom。
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "tests/e2e/**",
            "src/worker/__test__/registerImageCacheServiceWorker.test.ts",
            "src/router/__test__/index.test.ts",
          ],
          include: ["src/**/*.test.ts"],
          isolate: false,
          name: "unit",
          setupFiles: "./src/test/setup-node.ts",
        },
      },
      {
        extends: true,
        test: {
          environment: "jsdom",
          include: [
            "src/**/*.test.tsx",
            "src/worker/__test__/registerImageCacheServiceWorker.test.ts",
            "src/router/__test__/index.test.ts",
          ],
          name: "dom",
          setupFiles: "./src/test/setup.ts",
        },
      },
    ],
  },
});
