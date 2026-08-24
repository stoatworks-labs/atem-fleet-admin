# AGENTS.md — bringing an LLM up to speed on ATEM Fleet Admin

Orientation for an AI assistant (or a new human) picking this project up cold. `CLAUDE.md`
holds the short command reference; this file explains the model and the traps.

---

## 1. What this is

A tool to **provision a fleet of Blackmagic ATEM switchers at once**. Define any number of
ATEMs in one place, build each device's configuration through model-aware forms, then either:

1. **Generate folders** — write a loadable `config.xml` + `Media/` folder per device, for
   manual loading into ATEM Software Control; or
2. **Connect & apply** — push the *settable subset* of the config to a switcher over the
   network via `atem-connection`.

TypeScript, electron-vite + React, vitest. Public repo. Tagged v0.2.1, built and verified.

## 2. Where this sits among the ATEM projects

| Repo | Purpose |
|---|---|
| **atem-fleet-admin** (this) | *Provision/configure* many switchers at once |
| **atem-overseer** | *Monitor and control* a fleet live from one dashboard |
| **animATEM** | *Control one* switcher, with UVC multiview compositing |

## 3. Two things make this repo awkward, and both are deliberate

**It has three run targets.** An Electron app (all platforms), a web/av-launcher tray app
(macOS-only), *and* a hosted build with no backend at all. A change can easily fix one and
break the others. **Verify the mode your change actually affects** — and if it touches
shared code, verify all three.

The three differ only in what backs `window.api`, and each one declares what it can do
through `capabilities` (see `src/shared/protocol.ts`). **Never sniff for Electron in the
React components — read `window.api.capabilities`.** The hosted build has no LAN and no
filesystem, so `networkApply` is false there and the UI hides live apply instead of
offering a button that always fails.

**It has three tsconfigs**: main (`node`), renderer (`web` — which also covers `src/web`),
and server (`server`). `npm run typecheck` covers all three, which is why it's the check
that matters here rather than a single `tsc`.

```
src/server/    Backend for the web/tray target
src/web/       Both browser backends: webApi.ts (HTTP) and staticApi.ts (none)
```

Anything pure enough to run in a browser tab belongs in `src/shared/` — that is why
`xmlGenerator.ts` and `names.ts` live there rather than under `src/main/`. `src/main/`
is for the parts that genuinely need a filesystem or a socket.

## 4. Commands

```bash
npm run dev             # Electron dev
npm run web             # web target: build + serve
npm run preview:web     # vite dev for the web target
npm run server:dev      # server only
npm run preview:static  # vite dev for the hosted (backend-less) target
npm run static:build    # hosted target production build -> out-static/
npm run typecheck       # node + web + server - run this
npm test                # vitest
npm run build
npm run build:mac       # / :win / :linux
```

## 5. The core invariant: one authoritative model catalog

**The ATEM model catalog must stay authoritative for both the XML export *and* the live
apply.**

This is the heart of the tool. Model-aware forms are what let it generate a valid config for
a specific switcher model — and the same catalog has to drive both output paths, or the
generated XML and the applied settings diverge for the same declared configuration. If you
add a model or a field, add it in the catalog, not in one of the two consumers.

Note that only a *subset* of configuration is settable over the network; the XML path can
express more than the live path can apply. Keep that distinction explicit rather than
pretending the two are equivalent.

## 6. Conventions

- Multi-platform release CI; cross-compile macOS x86_64 on `macos-14` — never `macos-13`.
- Ships an av-launcher tray target: note the macOS Gatekeeper trap where an unsigned `.app`
  bundling helper binaries doesn't unquarantine its payload, and helpers are SIGKILLed
  silently.
- Public repo. "Commit" means commit **and** push.

## Diagnostics

Log via `say`/`log` from `src/main/diag/`, never `console`. `installElectronDiagnostics()`
hooks `render-process-gone` and `child-process-gone` — a dead renderer raises nothing the
main process's `uncaughtException` handler can see. `diag:collect` and `diag:openLogFolder`
are registered over IPC but **no UI calls them yet**; wiring a button is outstanding.
See [docs/diagnostics.md](docs/diagnostics.md).

## Notes

`docs/NOTES.md` carries this repo's working notes — current status, decisions
already made, and the traps that have actually bitten. Read it before changing
anything non-obvious. Cross-cutting fleet knowledge lives in
[fleet-notes](https://github.com/stoatworks-labs/fleet-notes).
