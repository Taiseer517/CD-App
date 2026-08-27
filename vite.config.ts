import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localWriteApi } from './vite-plugins/localWriteApi.js'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Only the production build needs the GitHub Pages subpath — local dev
  // stays at a plain "/" so `npm run dev` just works at localhost:5173.
  base: command === 'build' ? '/the-archive/' : '/',
  plugins: [react(), tailwindcss(), localWriteApi()],
}))
