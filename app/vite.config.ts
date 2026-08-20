import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Where `pnpm dev` forwards /api and /storage. Defaults to the frontend
// container's usual port; override when FRONTEND_PORT in the root .env differs
// (e.g. API_PROXY_TARGET=http://localhost:80 pnpm dev).
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8081'

export default defineConfig({
  plugins: [
    // @ts-ignore — FullCalendar types cause spurious overload mismatch
    vue(),
    // @ts-ignore
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/storage': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
