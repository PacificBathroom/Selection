import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: ".", // keep root at project root
  publicDir: "public", // ensure /public is copied as-is to dist

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // so you can use "@/..." imports
    },
  },

  build: {
    outDir: "dist", // Netlify expects dist
    sourcemap: true, // optional, makes debugging easier
    rollupOptions: {
      output: {
        // Give predictable asset names (optional, but tidy)
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },

  server: {
    port: 5173, // local dev
    open: true,
  },
});
