import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In Docker: VITE_PROXY_TARGET=http://api-gateway (Docker service name)
// Local dev: defaults to http://localhost:5000
const API_TARGET = process.env.VITE_PROXY_TARGET ?? 'http://localhost:5000';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 3000,
    proxy: {
      '/api':  { target: API_TARGET, changeOrigin: true },
      '/hubs': { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },
});
