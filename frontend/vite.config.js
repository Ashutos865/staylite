import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Local dev: forward /api requests to the local backend so the frontend can
  // use the same relative URLs it uses in production (where Vercel proxies them).
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})