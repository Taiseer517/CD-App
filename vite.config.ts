import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Only the production build needs the GitHub Pages subpath — local dev stays
  // at a plain "/" so `npm run dev` just works at localhost:5173.
  //
  // The deploy workflow passes BASE_PATH from the repository name, so renaming
  // the repo cannot silently 404 every asset. The fallback only matters when
  // building a Pages bundle by hand.
  base: command === 'build' ? (process.env.BASE_PATH ?? '/the-archive/') : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        name: 'The Archive',
        short_name: 'The Archive',
        description: 'A private catalogue of CDs, records and films.',
        theme_color: '#08060a',
        background_color: '#08060a',
        display: 'standalone',
        orientation: 'any',
        // Relative so the manifest keeps working under the Pages subpath.
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The three.js chunk alone is over the 2MB default ceiling.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg}'],
        runtimeCaching: [
          {
            // Sleeve art, so an installed copy still has its covers offline.
            urlPattern: /^https:\/\/(coverartarchive\.org|.*archive\.org)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cover-art',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

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
