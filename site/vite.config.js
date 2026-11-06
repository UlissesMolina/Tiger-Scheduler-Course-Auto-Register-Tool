import react from '@vitejs/plugin-react'
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { defineConfig } from 'vite'

// The scraper commits snapshots to ../data. Serve them at /data in dev and copy
// them into the build, so there is one copy of the data in the repo.
const dataDir = resolve(import.meta.dirname, '../data')

const serveData = {
  name: 'serve-data',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/data', (req, res, next) => {
      const file = resolve(join(dataDir, decodeURIComponent(req.url.split('?')[0])))
      if (!file.startsWith(dataDir + sep) || !existsSync(file) || !statSync(file).isFile()) return next()
      res.setHeader('Content-Type', 'application/json')
      createReadStream(file).pipe(res)
    })
  },
}

const copyData = {
  name: 'copy-data',
  apply: 'build',
  closeBundle() {
    cpSync(dataDir, resolve(import.meta.dirname, 'dist/data'), { recursive: true })
  },
}

export default defineConfig({
  // Relative, so the build works under GitHub Pages' /<repo>/ path.
  base: './',
  plugins: [react(), serveData, copyData],
})
