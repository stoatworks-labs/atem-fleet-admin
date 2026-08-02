import { readFileSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    // Shared with the server and hosted builds so the About dialog's vendored
    // files live in exactly one place.
    publicDir: resolve('public'),
    define: {
      // The version the build produced. See public/about.js.
      __APP_VERSION__: JSON.stringify(`v${pkg.version}`)
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
