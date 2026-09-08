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
