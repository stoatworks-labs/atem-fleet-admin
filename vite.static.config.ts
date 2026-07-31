import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  // Served from the root of its own hostname, unlike the server build which is
  // mounted by express.
  base: '/',
  define: { __AFA_TARGET__: JSON.stringify('static') },
  resolve: {
    alias: { '@renderer': resolve('src/renderer/src') }
  },
  build: {
    outDir: resolve('out-static'),
    emptyOutDir: true
  },
  plugins: [react()]
})
