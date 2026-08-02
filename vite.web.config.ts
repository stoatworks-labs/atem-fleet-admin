import { readFileSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Web build: the same React UI as the Electron renderer, but with an HTTP-backed
// window.api (src/web/main.tsx). Serves as the front-end for the local server
// (src/server) that ships inside the av-launcher tray shell.
export default defineConfig({
  root: 'src/web',
  // Shared with the other two builds so the About dialog's vendored files
  // live in exactly one place.
  publicDir: resolve('public'),
  base: './',
  define: {
    // The version the build produced. See public/about.js.
    __APP_VERSION__: JSON.stringify(`v${pkg.version}`),
    __AFA_TARGET__: JSON.stringify('server')
  },
  resolve: {
    alias: { '@renderer': resolve('src/renderer/src') }
  },
  build: {
    outDir: resolve('out-web'),
    emptyOutDir: true
  },
  server: {
    // Dev proxy so `npm run preview:web` can reach a server started separately.
    proxy: {
      '/api': 'http://localhost:4720'
    }
  },
  plugins: [react()]
})
