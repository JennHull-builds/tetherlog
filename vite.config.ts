import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Vite inlines any asset under 4 KB as base64, and the wordmark font is 4032
    // bytes, so it would land inside the stylesheet (and cost about 4 KB of the CSS
    // budget). Fonts stay separate files, which also cache on their own (D-042).
    assetsInlineLimit: (file) => (file.endsWith(".woff2") ? false : undefined),
  },
});
