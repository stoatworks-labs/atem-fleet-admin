# Notes

Working notes for this repo: status, decisions, and the traps that have actually bitten.
Migrated out of Claude Code's memory on 2026-08-24, so they are written in the first
person and dated by when each thing was learned — that date is usually the useful part.

Cross-cutting notes that are not specific to this repo live in
[fleet-notes](https://github.com/stoatworks-labs/fleet-notes).

*ATEM Fleet Admin — Electron tool to provision many Blackmagic ATEMs at once via model-aware forms → XML/folder export or live network apply*

**ATEM Fleet Admin** — provisions a *fleet* of Blackmagic ATEMs at once: build each device's config through model-aware forms, then either **generate loadable `config.xml` + `Media/` folders** for ATEM Software Control, or **connect & apply** the settable subset live over the network. GitHub PUBLIC (github.com/allansargeant/atem-fleet-admin), at `~/Projects/atem-fleet-admin`.

**Dual-target (as of v0.2.0):** (1) the original **Electron** app (electron-vite + React + TS + atem-connection + zustand) — installers for all platforms; (2) a **web target** (`src/server` Express + REST reading ATEM_FLEET_ADMIN_HOST/PORT, `src/web` fetch-backed `window.api` shim reusing the SAME React components) wrapped by the fleet's **av-launcher** Tauri shell in `launcher/` (env-inject mode, embedded Node runtime staged by `launcher/scripts/prepare.sh`). Both targets share `src/shared` + `src/main/services`. The **released tray app is macOS-only** (win/linux av-launcher bundling fails — node.exe resource + AppImage/FUSE — and are covered by the Electron installers); CI = ci.yml + release.yml (Electron, all platforms) + release-desktop.yml (Tauri, macOS only). Tagged v0.1.0 (Electron) and v0.2.0 (dual-target).

**Third target added 2026-07-31: a hosted, backend-less build** (`npm run static:build` → `out-static/`, `wrangler.toml`, per [pages demo hosting](https://github.com/stoatworks-labs/fleet-notes/blob/main/notes/reference_pages_demo_hosting.md)) — **LIVE at atem-fleet-admin.stoatworks-labs.com**. Nothing is uploaded — `generateDeviceXml` runs in the visitor's tab and the folder export becomes an in-browser **ZIP** (fflate, dynamic-imported) laying out the byte-identical tree. Two things it can't do, and the UI hides both rather than offering dead buttons: **live apply** (no TCP from a page) and **copying media-pool files** (no reading a typed path) — each device folder gets a `MEDIA.txt` manifest instead.

The mechanism is `capabilities` on `FleetAdminApi` (`networkApply` / `exportKind` / `bundlesMedia`), set by each of the three backends. **Components must branch on `window.api.capabilities`, never on "is this Electron".** Moving `xmlGenerator.ts` + `names.ts` into `src/shared/` was the enabling step: anything pure enough for a browser tab belongs there, `src/main/` is only for filesystem/socket work. Note `src/web/**` was typechecked by *nothing* until it was added to tsconfig.web.json — which immediately surfaced that the web build's `window.api.diag` never existed (now optional, panel self-hides).

Distinct from [atem overseer](https://github.com/stoatworks-labs/atem-overseer/blob/main/docs/NOTES.md) (`atem-overseer`) (monitoring/control, whose launcher/ + web-monorepo pattern this borrowed) and from [animatem](https://github.com/stoatworks-labs/animATEM/blob/main/docs/NOTES.md) (`animATEM`) (whose Electron stack it mirrors).

Phase 1 built & verified (2026-07-17): 2 model-aware capability profiles (ATEM Mini Extreme ISO = streaming/recording/ISO/UVC; ATEM 4 M/E Broadcast Studio 4K = SuperSource/multi-M/E). Editor tabs + emitted XML sections gate on `src/shared/models.ts` capabilities. `src/shared/config.ts` is the single source-of-truth data model consumed by both `xmlGenerator.ts` and `networkApply.ts`. 20 vitest tests + typecheck + full build green; UI verified in browser via `npm run preview:web`.

XML generator matched byte-for-structure against real autosaves in `~/Documents/ATEM Autosave/*.xml` (root `<Profile>` → MixEffectBlocks / Auxiliaries / VideoMode / Settings(→Inputs/MediaPool) / MediaPlayers / SuperSources). **Caveat:** no ATEM Mini save existed as ground truth, so the Mini `<Streaming>`/`<Recording>` XML is reconstructed from protocol — verify on real hardware; the live network-apply path is authoritative for those. Standard AI disclaimer included (per **disclaimer scope** (working-practice note, kept in Claude memory)).
