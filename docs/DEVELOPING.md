# ATEM Fleet Admin — Developing

TypeScript, electron-vite + React, vitest. Two run targets from one repo, three tsconfigs, and
one invariant that holds the whole thing together.

---

## 1. Where this sits

| Repo | Purpose |
|---|---|
| **atem-fleet-admin** (this) | *Provision/configure* many switchers at once (XML export or live apply) |
| **atem-overseer** | *Monitor and control* a fleet live from one dashboard |
| **animATEM** | *Control one* switcher, with UVC multiview compositing |

Check a feature belongs here before adding it.

---

## 2. The core invariant: one authoritative model catalog

> **`src/shared/models.ts` must stay authoritative for both the XML export *and* the live
> apply.**

This is the heart of the tool. Model-aware forms are what let it generate a valid config for a
specific switcher model — and the same catalog has to drive both output paths, or **the
generated XML and the applied settings diverge for the same declared configuration.**

**If you add a model or a field, add it in the catalog, not in one of the two consumers.**

Three things consume a `ModelProfile`, and all three must keep doing so:

1. the editor UI (which tabs and options to show),
2. `xmlGenerator` (which sections to emit),
3. `buildApplySteps` (which live setters to run).

`product` in a profile is the **exact** string ATEM Software Control writes in
`<Profile product="...">`. Get it wrong and the XML won't load. Same for
`profileMajorVersion`/`profileMinorVersion`.

### The XML path can express more than the live path can apply

Only a *subset* of configuration is settable over the network. **Keep that distinction explicit
rather than pretending the two are equivalent.** It is currently expressed as `skip` strings on
apply steps, which surface to the operator as "folder-export only" rows:

| Not settable live | Reason recorded in the code |
|---|---|
| UVC / USB-C output routing | not settable over the Ethernet protocol |
| Recording bitrate / quality | not exposed as a live protocol setter |
| Media pool items | uploads require frame conversion; folder export stages the `Media/` folder |

If a future protocol version makes one of these settable, convert the `skip` into a `run` — and
update [API.md](API.md) and [USER-GUIDE.md](USER-GUIDE.md), which both carry that table.

---

## 3. Two run targets, and why it's awkward

**An Electron app (all platforms) *and* a web/av-launcher tray app.** A change can easily fix one
and break the other.

> **Verify the mode your change actually affects — and if it touches shared code, verify both.**

```
src/shared/         config model, model catalog, protocol types   ← used by BOTH
src/main/services/  xmlGenerator, folderExporter, networkApply    ← used by BOTH
src/main/           Electron main process
src/preload/        the window.api bridge (Electron)
src/web/webApi.ts   the same window.api shape over HTTP (web)
src/server/         Express backend for the web target
src/renderer/       the React UI                                  ← identical in both
```

The React UI is identical across targets; **only `window.api` differs** — IPC in Electron, HTTP
in the browser. `src/server/api.ts` deliberately mirrors `src/shared/protocol.ts`.

**One genuine behavioural difference**: Electron's `export.toFolders` opens a directory picker
and returns `null` on cancel; the HTTP route has no picker and writes straight into the
server-side `exportDir`. Anything that assumes a dialog will be wrong on the web target.

### Three tsconfigs

main (`node`), renderer (`web`), and server (`server`).

```bash
npm run typecheck    # node + web + server — run THIS, not a bare tsc
```

A single `tsc` checks one project and proves nothing about the other two. This is why
`typecheck` is the check that matters in this repo.

---

## 4. Commands

```bash
npm run dev          # Electron dev
npm run web          # web target: build web + build server + start server
npm run preview:web  # vite dev server for the web target (port 5199)
npm run server:dev   # server only (tsx watch)
npm run typecheck    # all three projects
npm test             # vitest (/ npm run test:watch)
npm run build        # typecheck + electron-vite build
npm run build:mac    # / :win / :linux
```

Note **`build:mac` and `build:linux` skip the typecheck** — they call `electron-vite build`
directly, where `build` and `build:win` go through `npm run build`. Run `npm run typecheck`
yourself before a mac or linux release.

CI: `.github/workflows/ci.yml`, `release.yml`, `release-desktop.yml`.

---

## 5. Tests

`vitest`, three spec files, all pure — **no hardware, no Electron, no server**:

| Spec | Covers |
|---|---|
| `xmlGenerator.spec.ts` | the generated `<Profile>` against real ATEM save-file conventions |
| `folderExporter.spec.ts` | the export layout and name sanitizing |
| `networkApply.spec.ts` | the apply plan, against a mock switcher |

`buildApplySteps()` is **pure by design** — no I/O, no connection, it just describes what would
be sent — specifically so the whole apply plan is testable without touching hardware. `AtemLike`
is a structural subset of `atem-connection`'s `Atem` for the same reason. **Keep both properties
when adding steps**: put the decision-making in `buildApplySteps` and the I/O in the step's `run`.

`xmlGenerator.spec.ts` is validated against a **real autosave XML** for the big-switcher profile.
The Mini's `<Streaming>`/`<Recording>` elements have **no ground-truth save file** and are
reconstructed from the protocol — that limitation is stated in the README and the user guide.
Don't quietly upgrade it.

---

## 6. Error handling and validation as it stands

- **Every HTTP failure is `500 {"error"}`.** There is no `400`.
- **Request bodies are cast, not validated** — `req.body as FleetProject` is a type assertion. A
  malformed fleet reaches the exporter and fails there, or partially succeeds.
- **`exportFleet` never fails on a missing media file.** It records the item in `mediaMissing`
  and continues, so an export can "succeed" with an empty `Media/` folder. That is deliberate —
  one bad path shouldn't lose a whole fleet export — but it means callers **must** surface
  `mediaMissing`.
- **`sanitizeName` does not unique.** Two devices whose names sanitize identically overwrite each
  other's folder.
- **A connection failure in `applyToDevice` returns a result**, with `connected: false` and a
  single `Connect` step in error, rather than throwing.

These are documented in [API.md](API.md) as current behaviour. Update it if you tighten any.

---

## 7. Security posture

> **The web target has no authentication.** The default host is `localhost`, and the listen call
> only omits the host argument when `host === 'localhost'` — so setting `ATEM_FLEET_ADMIN_HOST`
> to anything else binds that interface and exposes two things unauthenticated:
> `POST /api/network/apply`, which **reconfigures real switchers**, and
> `POST /api/export/folders`, which **writes files onto the host**.

If anything is ever added that widens this surface, remember it is being added to an
unauthenticated endpoint.

---

## 8. Conventions

- Multi-platform release CI; **cross-compile macOS x86_64 on `macos-14` — never `macos-13`.**
- Ships an **av-launcher** tray target. Note the macOS Gatekeeper trap common to all av-launcher
  apps: for an unsigned `.app` bundling helper binaries, **approving the app does not
  unquarantine its payload** — helpers are SIGKILLed silently. See
  [`launcher/SIGNING.md`](../launcher/SIGNING.md).
- Public repo. "Commit" means commit **and** push.
- Keep the AI-assistance disclaimer in user-facing text.

---

## See also

- [API.md](API.md) — HTTP/IPC surfaces, model catalog, apply-step table, export layout
- [USER-GUIDE.md](USER-GUIDE.md) — the operator view
- [`AGENTS.md`](../AGENTS.md) — LLM onboarding
