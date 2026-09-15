import { defineConfig } from "vite";

// 发布构建：leafer 相关包只引用不打包，交给宿主提供。
export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.esm.js" : "index.cjs"),
    },
    // Vite 8 底层换成 rolldown，rollupOptions 已是废弃别名。
    rolldownOptions: {
      external: ["@leafer-ui/core", "@leafer-ui/interface"],
    },
    sourcemap: true,
  },
});
