import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vike from 'vike/plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), vike(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true
  },
  preview: {
    port: 3000
  }
})
