# ATEM Fleet Admin — Interfaces

Two backends serve the same React UI: Electron IPC, and an HTTP API for the web/tray target.
They mirror each other deliberately.

| § | Interface | Source |
|---|---|---|
| [1](#1-http-api-web--tray-target) | HTTP API (web/tray target) | `src/server/api.ts`, `src/server/config.ts` |
| [2](#2-ipc-surface-electron-target) | IPC surface (Electron target) | `src/shared/protocol.ts`, `src/preload/index.ts` |
| [3](#3-the-model-catalog) | The model catalog | `src/shared/models.ts` |
| [4](#4-what-live-apply-can-and-cannot-set) | What live apply can and cannot set | `src/main/services/networkApply.ts` |
| [5](#5-export-layout-and-generated-xml) | Export layout and generated XML | `src/main/services/folderExporter.ts`, `xmlGenerator.ts` |

> **⚠ `POST /api/network/apply` writes to real switchers.** It connects over the network and
> applies settings. There is **no authentication on the HTTP API** — see §1.

---

## 1. HTTP API (web / tray target)

The endpoints **mirror the Electron IPC surface** so the same React UI works against either
backend. Fleet open/save are deliberately absent: in the browser they're a download and an
upload, handled client-side.

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/api/health` | — | `{ ok: true, exportDir }` |
| `POST` | `/api/export/folders` | `FleetProject` | `ExportResult` (§5) |
| `POST` | `/api/export/preview-xml` | `DeviceConfig` | the XML, as `application/xml` |
| `POST` | `/api/network/apply` | `DeviceConfig` | `ApplyResult` (§4) |
| `GET` | anything not under `/api/` | — | the SPA, if a web build exists |

Every failure is **`500 {"error": "..."}`**. There is no `400`, and no validation of the posted
body before it's cast — `req.body as FleetProject` is a type assertion, not a check. A malformed
fleet reaches the exporter and fails there, or partially succeeds.

JSON body limit is **25 MB** (fleets embed media *paths*, not media, so that's headroom).

### Configuration

Environment variables, injected by the av-launcher (`env` mode in `launcher.toml`):

| Variable | Default |
|---|---|
| `ATEM_FLEET_ADMIN_HOST` | `localhost` |
| `ATEM_FLEET_ADMIN_PORT` | `4720` |
| `ATEM_FLEET_ADMIN_EXPORT_DIR` | `./exports` (resolved absolute) |

> **⚠ No authentication of any kind.** The default `host` is `localhost`, and the listen call
> passes `undefined` for the host **only when `host === 'localhost'`** — so setting
> `ATEM_FLEET_ADMIN_HOST` to anything else binds that interface and exposes, unauthenticated:
>
> - **`/api/network/apply`**, which reconfigures real switchers on your network;
> - **`/api/export/folders`**, which **writes files to the server's filesystem** under
>   `exportDir`.
>
> There is no token, no session and no TLS. Leave it on localhost.

**The export directory is server-side.** In the web target, "Generate folders" writes on the
machine running the server, not the machine running the browser — there is no download. The
`GET /api/health` response returns `exportDir` so the UI can tell the operator where files
landed.

---

## 2. IPC surface (Electron target)

Exposed to the renderer as `window.api` (`FleetAdminApi` in `src/shared/protocol.ts`):

```ts
api.fleet.open()                  → OpenResult | null      // file dialog; null if cancelled
api.fleet.save(fleet)             → SaveResult | null      // file dialog; null if cancelled
api.export.toFolders(fleet)       → ExportResult | null    // directory dialog; null if cancelled
api.export.previewXml(device)     → string                 // generates nothing on disk
api.network.apply(device)         → ApplyResult
```

**`null` means the user cancelled a dialog**, not that anything failed. The HTTP equivalents have
no cancel concept — `POST /api/export/folders` writes straight into the configured `exportDir`
with no picker at all. That is the one real behavioural difference between the two backends.

---

## 3. The model catalog

`src/shared/models.ts` is the heart of the tool and **must stay authoritative for both output
paths**.

Each `ModelProfile` declares what a model can do. The editor shows only the tabs and options a
model supports; the XML generator emits only the sections a model has; the live-apply step list
is built from the same flags.

```ts
{ id, label,
  product,                       // EXACT string ATEM Software Control writes in <Profile product="...">
  profileMajorVersion, profileMinorVersion,
  inputCount, mixEffects, auxOutputs, mediaPlayers,
  mediaPoolStills, mediaPoolClips,
  capabilities: { superSource, streaming, recording, recordingIso,
                  uvcOutput, hyperDeck, dve, fadeToBlack },
  transitionStyles: ('Mix'|'Dip'|'Wipe'|'DVE'|'Stinger')[] }
```

> **If you add a model or a field, add it in the catalog — not in one of the two consumers.**
> The XML export and the live apply must agree for the same declared configuration, and a
> catalog entry is the only thing that guarantees it.

`product` must be the **exact** string ATEM Software Control writes, or the generated XML won't
load.

### Shipped profiles

Two, spanning the two hardware classes:

| | ATEM Mini Extreme ISO | ATEM 4 M/E Broadcast Studio 4K |
|---|---|---|
| Inputs | 8 | 20 |
| M/E | 1 | 4 |
| AUX | 2 | 24 |
| Media players | 2 | 4 |
| Stills / clips | 20 / 0 | 240 / 2 |
| SuperSource | — | ✅ |
| Streaming | ✅ | — |
| Recording (+ISO) | ✅ / ✅ | — |
| UVC output | ✅ | — |
| HyperDeck | — | ✅ |
| Stinger transition | — | ✅ |

The big-switcher profile matches **the real autosave XML the generator is validated against**.
`getModelProfile()` throws `unknown ATEM model: <id>` for anything else.

---

## 4. What live apply can and cannot set

> **This is the distinction that matters most in this tool: the XML path can express more than
> the live path can apply.** Keep it explicit rather than pretending the two are equivalent.

`applyToDevice()` builds an ordered step list from the device config and the model profile, then
runs it. `buildApplySteps()` is **pure — no I/O, no connection** — so the whole plan is
unit-testable against a mock switcher without hardware.

Each step returns `ok`, `skipped` or `error`, with a `detail` string.

| Step | Live? | Notes |
|---|---|---|
| Input names | ✅ | **`shortName` is truncated to 4 characters**, silently |
| Output routing (AUX) | ✅ | non-UVC outputs, applied in list order to bus 0..n |
| **UVC / USB-C output routing** | ⏭ **skipped** | *"not settable over the Ethernet protocol — use folder export"* |
| SuperSource boxes | ✅ | SuperSource-capable models only; ssrcId 0 |
| Media player assignments | ✅ | assignment only, not the content |
| Default transition rate | ✅ | applied to **every** M/E on the model |
| Fade to black rate | ✅ | every M/E; capability-gated |
| Streaming service | ✅ | streaming-capable models only |
| Recording ISO mode | ✅ | ISO-capable models only |
| **Recording bitrate / quality** | ⏭ **skipped** | *"not exposed as a live protocol setter — use folder export"* |
| **Media pool items** | ⏭ **skipped** | *"media uploads require frame conversion; use folder export to stage the Media folder"* |

So after a successful live apply, **three things are still unset on the switcher**: the USB
webcam routing, the recording quality, and the media pool contents. The result's `skipped` steps
say exactly that — they are not failures and should not be presented as such.

A connection failure produces a single `Connect` step with `status: 'error'` and
`connected: false`, rather than a thrown exception.

`bandwidthKbps` is multiplied by 1000 and sent as **both** bitrate values
(`bitrates: [n, n]`).

---

## 5. Export layout and generated XML

```
<outputDir>/<FleetName>/<DeviceName>/config.xml   the generated <Profile>
<outputDir>/<FleetName>/<DeviceName>/Media/...    copied media-pool files
```

The operator drags the `Media` files into the switcher's media pool and uses ATEM Software
Control's **Load** to apply `config.xml`.

**Folder names are sanitized**: `< > : " / \ | ? *` become `_`, whitespace becomes `_`, trailing
dots are stripped, and an empty result becomes `Untitled`. **Two devices whose names sanitize to
the same string will overwrite each other's folder** — there is no uniquing.

`ExportResult` reports per device:

```ts
{ name, dir, xmlPath, mediaCopied, mediaMissing: string[] }
```

**`mediaMissing` is how a missing source file surfaces.** A media item with no `filePath`, or one
whose copy throws, is added to `mediaMissing` and the export **continues** — it is not an error
and the exit is still a success. **Check `mediaMissing` after every export**; an empty `Media/`
folder with a "success" result is exactly what a mistyped path looks like.

`generateDeviceXml()` is also reachable without writing anything, via `export.previewXml` /
`POST /api/export/preview-xml`.

---

## See also

- [USER-GUIDE.md](USER-GUIDE.md) — provisioning a fleet
- [DEVELOPING.md](DEVELOPING.md) — the two run targets, three tsconfigs, and the catalog rule
- [`AGENTS.md`](../AGENTS.md) — LLM onboarding
