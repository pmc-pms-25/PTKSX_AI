import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite chay voi root la thu muc client/, nen outDir 'dist' = client/dist.
// server.js o production serve thang thu muc do.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Khi dev, API va noi dung van do server Express o 8080 phuc vu.
    proxy: {
      '/api': 'http://localhost:8080',
      '/content': 'http://localhost:8080',
      '/branding': 'http://localhost:8080',
    },
  },
})
