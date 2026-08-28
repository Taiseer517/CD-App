import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Only the production build needs the GitHub Pages subpath — local dev
  // stays at a plain "/" so `npm run dev` just works at localhost:5173.
  base: command === 'build' ? '/the-archive/' : '/',
  plugins: [react(), tailwindcss()],

  optimizeDeps: {
    // Listing the heavy deps explicitly lets Vite pre-bundle them directly
    // instead of crawling the source graph to discover them on a cold start.
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'zustand',
      'zustand/middleware',
      'zod',
      'framer-motion',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
      '@react-spring/three',
    ],
  },

  server: {
    // Pre-transform the entry points so the first browser request isn't
    // waiting on a cold compile of the whole route tree.
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx', './src/router.tsx'],
    },
    watch: {
      // Never watch build artifacts — tsc writing .tsbuildinfo in here was
      // tripping Vite's tsconfig watcher into full cache-clearing reloads.
      ignored: ['**/node_modules/.tmp/**', '**/dist/**'],
    },
  },

  build: {
    rollupOptions: {
      output: {
        // Keep the 3D stack in its own chunk so the grid pages don't pay for
        // three.js on first load. Written as a function rather than the object
        // form because Rollup's object-form types don't narrow correctly here.
        manualChunks(id: string) {
          if (/node_modules\/(three|@react-three|@react-spring\/three)/.test(id)) {
            return 'three'
          }
        },
      },
    },
  },
}))
