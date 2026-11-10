import { defineConfig } from "vite";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [tailwind()],
  esbuild: { jsx: "automatic" },
  build: { rollupOptions: { input: "app.html" } },
});
