# atem-fleet-admin

Provision many Blackmagic ATEMs at once via model-aware forms → loadable XML + media-folder export, or live network apply (atem-connection). Dual-target: Electron app (all platforms) + web/av-launcher tray app (macOS-only). TypeScript, electron-vite, vitest. Tagged v0.2.0, built & verified.

## Commands (npm)
- Electron dev: `npm run dev`
- Web target (build + serve): `npm run web` (server on its own port; `preview:web` for vite dev)
- Server dev only: `npm run server:dev`
- Typecheck: `npm run typecheck` (node + web + server)
- Test: `npm test` (vitest) · `npm run test:watch`
- Build: `npm run build`
- Package: `npm run build:mac` · `:win` · `:linux`

## Layout
- Three tsconfigs: main (`node`), renderer (`web`), server (`server`) — typecheck covers all three.
- `src/server/` — backend for the web/tray target.

## Notes
- Two run modes: Electron (`dev`) and web (`web`). Verify the mode your change affects.
- Model-aware forms → keep the ATEM model catalog authoritative for both XML export and live apply.
- Public repo. Multi-platform release CI; cross-compile macOS x86_64 on macos-14 (never macos-13). "Commit" = commit **and** push.
