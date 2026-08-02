/// <reference types="vite/client" />

/** Injected by the vite configs from package.json. Shown in the About dialog. */
declare const __APP_VERSION__: string

interface Window {
  STOATWORKS_ABOUT?: Record<string, string>
}
