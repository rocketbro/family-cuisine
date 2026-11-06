import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the Hono server runs on 2848 (`npm run dev:server`) and Vite proxies to it.
// In production the server serves the built app itself, so there is one process and one port.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:2848',
      '/media': 'http://127.0.0.1:2848',
    },
  },
})
