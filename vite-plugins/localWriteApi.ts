import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { z } from 'zod'

// Deliberately not importing the app's CollectionItemSchema from src/ here —
// this plugin is dev tooling and stays outside the app's TS project boundary.
// It only guards against writing obviously malformed payloads to disk; the
// app itself re-validates every item against the full schema when it loads.
const CollectionArraySchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
  }).passthrough(),
)

const COLLECTION_PATH = resolve(import.meta.dirname, '../src/data/collection.json')

export function localWriteApi(): Plugin {
  return {
    name: 'local-write-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/collection', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            const parsed = CollectionArraySchema.parse(JSON.parse(body))
            writeFileSync(COLLECTION_PATH, JSON.stringify(parsed, null, 2) + '\n', 'utf-8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (err) {
            console.error('[local-write-api] rejected collection write:', err)
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })
      })
    },
  }
}
