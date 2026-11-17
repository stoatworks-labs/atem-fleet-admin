import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Vendored from stoatworks-backend/theme by scripts/sync-theme.sh: never edit here. First, so App.css layers over it.
import './stoatworks-theme.css'
import './App.css'

// The About dialog's data file ships a version baked at sync time; this is the
// one the build actually produced. Spread, not assign: about-data.js may not
// have run yet, and it merges rather than overwriting. See public/about.js.
window.STOATWORKS_ABOUT = { ...window.STOATWORKS_ABOUT, version: __APP_VERSION__ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
