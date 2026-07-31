# atem-fleet-admin

Provision many Blackmagic ATEMs at once via model-aware forms → loadable XML + media-folder export, or live network apply (atem-connection). Three targets: Electron app (all platforms), web/av-launcher tray app (macOS-only), and a hosted backend-less build (Cloudflare Worker). TypeScript, electron-vite, vitest. Tagged v0.2.1, built & verified.

## Commands (npm)
- Electron dev: `npm run dev`
- Web target (build + serve): `npm run web` (server on its own port; `preview:web` for vite dev)
- Server dev only: `npm run server:dev`
- Hosted target: `npm run preview:static` (vite dev) · `npm run static:build` → `out-static/`
- Typecheck: `npm run typecheck` (node + web + server)
- Test: `npm test` (vitest) · `npm run test:watch`
- Build: `npm run build`
- Package: `npm run build:mac` · `:win` · `:linux`

## Layout
- Three tsconfigs: main (`node`), renderer (`web` — also covers `src/web`), server (`server`) — typecheck covers all three.
- `src/server/` — backend for the web/tray target.
- `src/web/` — the browser backends: `webApi.ts` (HTTP) and `staticApi.ts` (no backend).
- `src/shared/` holds everything pure enough to run in a browser tab, incl. `xmlGenerator.ts`.

## Notes
- Three run modes: Electron (`dev`), web (`web`), hosted (`preview:static`). Verify the mode your change affects.
- Components must branch on `window.api.capabilities`, never on "is this Electron". The hosted build has no LAN, so live apply is hidden there.
- Model-aware forms → keep the ATEM model catalog authoritative for both XML export and live apply.
- Public repo. Multi-platform release CI; cross-compile macOS x86_64 on macos-14 (never macos-13). "Commit" = commit **and** push.

## Diagnostics

Log via `say`/`log` from `src/main/diag/`, never `console`. `installElectronDiagnostics()`
hooks `render-process-gone` and `child-process-gone` — a dead renderer raises nothing the
main process's `uncaughtException` handler can see. `diag:collect` and `diag:openLogFolder`
are wired to the DiagnosticsPanel in the header. `diag` is optional on the API: the browser
backends omit it and the panel hides itself.
See [docs/diagnostics.md](docs/diagnostics.md).
