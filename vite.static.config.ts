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
  plugins: [react(), supportFooterVersion()]
})
