import { readFileSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/**
 * Stamp the version this build produced onto the support-footer script tag.
 *
 * The tag itself stays in index.html — it is the same document in dev — but the
 * version cannot be written in beside it: a literal goes stale the moment a
 * release is tagged, and a feedback report naming the wrong build is worse than
 * one naming no build at all. Same string as __APP_VERSION__ below, which is
 * what the About dialog shows.
 */
function supportFooterVersion(): Plugin {
  // Not anchored to a leading slash: this runs after Vite has rewritten public
  // asset paths, and an app built with a relative `base` has ./support-footer.js
  // by the time we see it.
  const tag = /<script\s[^>]*\bsrc="[^"]*support-footer\.js"/
  return {
    name: 'stoatworks-support-footer-version',
    transformIndexHtml: {
      order: 'post',
      handler(html: string) {
        // Loud on purpose. The tag is hand-written markup, so a rename or a
        // tidy-up could silently detach the version from every report filed
        // afterwards, and nothing downstream would look wrong.
        if (!tag.test(html)) {
          throw new Error('no support-footer.js tag in index.html — nothing to stamp')
        }
        return html.replace(tag, (m) => `${m} data-version="v${pkg.version}"`)
      }
    }
  }
}

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
  plugins: [react(), supportFooterVersion()]
})
