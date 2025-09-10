// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // Netlify expects /dist (per your netlify.toml)
    sourcemap: false, // you can set true if you want source maps
  },
  server: {
    port: 5173,
    open: true,
  },
});
