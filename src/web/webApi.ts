/**
 * Browser implementation of {@link FleetAdminApi} backed by the local server.
 *
 * The React UI talks to `window.api` regardless of backend. In Electron that's
 * the preload IPC bridge; here it's HTTP to the local server (src/server), with
 * fleet open/save handled entirely client-side (file upload / download) since a
 * browser has no native save dialog.
 *
 * For the hosted build with no server behind it, see staticApi.ts.
 */

import type { DeviceConfig, FleetProject } from '../shared/config'
import type {
  ApplyResult,
  ExportResult,
  FleetAdminApi,
  OpenResult,
  SaveResult
} from '../shared/protocol'
import { download, pickFile } from './browserFiles'

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error((detail as { error?: string }).error || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export const webApi: FleetAdminApi = {
  // The server runs on the operator's own machine, so it has the same reach as
  // Electron: it writes real directories and opens sockets to the LAN.
  capabilities: { networkApply: true, exportKind: 'folders', bundlesMedia: true },

  fleet: {
    open: async (): Promise<OpenResult | null> => {
      const picked = await pickFile('.json,.afa.json,application/json')
      if (!picked) return null
      return { filePath: picked.name, fleet: JSON.parse(picked.text) as FleetProject }
    },
    save: async (fleet: FleetProject): Promise<SaveResult | null> => {
      const filename = `${fleet.name || 'fleet'}.afa.json`
      download(JSON.stringify(fleet, null, 2), filename, 'application/json')
      return { filePath: filename }
    }
  },
  export: {
    toFolders: (fleet: FleetProject): Promise<ExportResult | null> =>
      postJson<ExportResult>('/api/export/folders', fleet),
    previewXml: async (device: DeviceConfig): Promise<string> => {
      const res = await fetch('/api/export/preview-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(device)
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return res.text()
    }
  },
  network: {
    apply: (device: DeviceConfig): Promise<ApplyResult> =>
      postJson<ApplyResult>('/api/network/apply', device)
  }
}
