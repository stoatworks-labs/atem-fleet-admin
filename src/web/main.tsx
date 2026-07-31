import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../renderer/src/App'
import '../renderer/src/App.css'
import { staticApi } from './staticApi'
import { webApi } from './webApi'

/**
 * Which backend this bundle talks to, fixed at build time by the vite config:
 * `vite.web.config.ts` builds the server-backed app (out-web, served by
 * src/server inside the av-launcher tray shell), `vite.static.config.ts` builds
 * the hosted one (out-static, no backend at all).
 */
declare const __AFA_TARGET__: 'server' | 'static'

// Vite substitutes __AFA_TARGET__ with a literal, so the branch folds and the
// backend this build doesn't use is dropped from the bundle.
const api = __AFA_TARGET__ === 'static' ? staticApi : webApi

// Install the bridge before the app mounts, so the shared React components find
// the same `window.api` they use under Electron.
;(window as unknown as { api: typeof api }).api = api

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
