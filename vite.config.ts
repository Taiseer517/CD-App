import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localWriteApi } from './vite-plugins/localWriteApi.js'

// https://vite.dev/config/
export default defineConfig({
  base: '/the-archive/',
  plugins: [react(), tailwindcss(), localWriteApi()],
})
