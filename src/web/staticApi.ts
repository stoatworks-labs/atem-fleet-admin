/**
 * Browser implementation of {@link FleetAdminApi} with no backend at all.
 *
 * This is the hosted build (Cloudflare Worker serving static assets): the page
 * is the whole application. Every ATEM profile is generated in the tab from the
 * same `generateDeviceXml` the desktop app uses, and nothing is uploaded — the
 * fleet file never leaves the machine.
 *
 * What it cannot do is reach the LAN. "Connect & apply" needs a TCP socket to
 * the switcher, so `capabilities.networkApply` is false here and the UI hides
 * the button rather than offering an action that always fails.
 */

import type { DeviceConfig, FleetProject } from '../shared/config'
import type {
  ApplyResult,
  ExportResult,
  FleetAdminApi,
  OpenResult,
  SaveResult
} from '../shared/protocol'
import { generateDeviceXml } from '../shared/xmlGenerator'
import { download, pickFile } from './browserFiles'
import { planFleetArchive } from './staticExport'

export const staticApi: FleetAdminApi = {
  capabilities: { networkApply: false, exportKind: 'zip', bundlesMedia: false },

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
    toFolders: async (fleet: FleetProject): Promise<ExportResult | null> => {
      const plan = planFleetArchive(fleet)

      // Loaded on demand: an operator who only ever previews XML never pays for
      // the zip encoder.
      const { zipSync, strToU8 } = await import('fflate')
      const tree: Record<string, Uint8Array> = {}
      for (const file of plan.files) tree[file.path] = strToU8(file.text)

      download(zipSync(tree, { level: 6 }) as BlobPart, plan.filename, 'application/zip')
      return plan.result
    },

    // Pure, and already shared with the desktop build — no round trip needed.
    previewXml: async (device: DeviceConfig): Promise<string> => generateDeviceXml(device)
  },

  network: {
    apply: async (): Promise<ApplyResult> => {
      // Unreachable through the UI (the button is hidden), but a backend that
      // silently resolved would be worse than one that says why.
      throw new Error(
        'Live apply needs a network connection to the switcher, which a web page cannot open. ' +
          'Use the desktop app for "Connect & apply".'
      )
    }
  }
}
