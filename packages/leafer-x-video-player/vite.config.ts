import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.esm.js" : "index.cjs"),
    },
    rolldownOptions: { external: ["@leafer-ui/core", "@leafer-ui/interface"] },
    sourcemap: true,
  },
});
