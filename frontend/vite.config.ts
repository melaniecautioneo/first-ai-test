import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vike from 'vike/plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages sert le site sous /<nom-du-depot>/ : on le passe par
  // la variable BASE_PATH au moment du build (voir le workflow GitHub).
  // En local, BASE_PATH n'est pas défini -> la racine "/".
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), vike(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true
  },
  preview: {
    port: 3000
  }
})
