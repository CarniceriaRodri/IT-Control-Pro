import { defineConfig } from "vite";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  base: "./",
  publicDir: "public",
  plugins: [tailwind()],
  esbuild: { jsx: "automatic" },
  build: { rollupOptions: { input: "app.html" } },
});
