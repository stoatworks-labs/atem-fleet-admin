import { readFileSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Hosted build: the same React UI as the Electron renderer and the server-backed
// web build, but with no backend behind it (src/web/staticApi.ts). Everything —
// XML generation, the ZIP export — happens in the tab, so this can be published
// as static assets on a Cloudflare Worker (see wrangler.toml). Only live
// "Connect & apply" is missing, and the UI hides it.
//
// Kept separate from vite.web.config.ts rather than switched by an env var so
// the two builds are reproducible on any platform without cross-env.
export default defineConfig({
  root: 'src/web',
  // Shared with the other two builds so the About dialog's vendored files
  // live in exactly one place.
  publicDir: resolve('public'),
  // Served from the root of its own hostname, unlike the server build which is
  // mounted by express.
  base: '/',
  define: {
    // The version the build produced. See public/about.js.
    __APP_VERSION__: JSON.stringify(`v${pkg.version}`),
    __AFA_TARGET__: JSON.stringify('static')
  },
  resolve: {
    alias: { '@renderer': resolve('src/renderer/src') }
  },
  build: {
    outDir: resolve('out-static'),
    emptyOutDir: true
  },
  plugins: [react()]
})
