import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * The dashboard is served by the CLI from `web-dist/`, at an address whose port
 * changes every run. Relative asset paths are what make that work.
 *
 * `npm run dev` proxies to a CLI started on 4179, so the page can be developed
 * against a real run instead of invented data.
 */
export default defineConfig({
  plugins: [vue()],
  base: "./",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL("../web-dist", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    proxy: { "/api": "http://127.0.0.1:4179" },
  },
});
