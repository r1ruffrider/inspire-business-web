import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { serviceRequestDevApi } from './server/dev/viteApiPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  // serviceRequestDevApi is `apply: 'serve'` only (T15): it never runs in a build.
  // envPrefix is deliberately left at Vite's default (VITE_).
  plugins: [react(), tailwindcss(), serviceRequestDevApi()],
  // Vite's default dev CORS middleware would add Access-Control-* headers to every dev response,
  // including /api/service-request. Production sends none, so dev sends none either.
  server: { cors: false },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
})
