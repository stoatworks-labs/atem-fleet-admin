/**
 * Fleet -> in-memory archive, for the hosted browser build.
 *
 * The desktop app writes `<FleetName>/<DeviceName>/config.xml` into a directory
 * the operator picks. A web page has no such directory, so this builds the same
 * tree as a set of paths and produces a ZIP the browser downloads. Unpacking it
 * gives byte-identical config.xml files in identically named folders — the two
 * exports are interchangeable.
 *
 * One real difference, and it is not fixable in a browser: media-pool source
 * files are NOT bundled. `filePath` is a typed absolute path, and a web page
 * cannot read a path it was not handed as a File. Each device folder instead
 * carries a MEDIA.txt manifest naming what belongs in which slot, so the
 * operator can load the pool by hand. Callers must tell the user this; ExportBar
 * does, off `capabilities.bundlesMedia`.
 */

import type { DeviceConfig, FleetProject } from '../shared/config'
import type { ExportResult } from '../shared/protocol'
import { sanitizeName } from '../shared/names'
import { generateDeviceXml } from '../shared/xmlGenerator'

/** One file destined for the archive. `path` is relative to the ZIP root. */
export interface ArchiveFile {
  path: string
  text: string
}

export interface ArchivePlan {
  /** Suggested download filename, e.g. `Roadshow.zip`. */
  filename: string
  files: ArchiveFile[]
  /** Same shape the desktop export reports, so the UI renders one result list. */
  result: ExportResult
}

/**
 * The per-device media manifest.
 *
 * Deliberately plain text, not JSON: its reader is a person standing at a
 * switcher with the folder open, not a program.
 */
function mediaManifest(device: DeviceConfig): string {
  const lines = [
    `Media pool for ${device.name}`,
    '',
    'This export was generated in a browser, which cannot read files from your',
    'disk, so the media itself is not included here. Load these into the pool',
    'from ATEM Software Control (Media tab) in the slots listed below.',
    ''
  ]
  for (const item of device.mediaPool) {
    const source = item.filePath || '(no source path set)'
    const frames =
      item.kind === 'clip' && item.maxFrameCount ? ` [${item.maxFrameCount} frames]` : ''
    lines.push(`  ${item.kind} ${item.index}  ${item.name}${frames}`)
    lines.push(`      ${source}`)
  }
  lines.push('')
  return lines.join('\n')
}

/**
 * Build every file for `fleet`, plus the result the UI reports.
 *
 * Pure and DOM-free so it can be tested directly; the caller does the zipping
 * and the download.
 */
export function planFleetArchive(fleet: FleetProject): ArchivePlan {
  const fleetDir = sanitizeName(fleet.name)
  const files: ArchiveFile[] = []
  const devices: ExportResult['devices'] = []

  for (const device of fleet.devices) {
    const dir = `${fleetDir}/${sanitizeName(device.name)}`
    const xmlPath = `${dir}/config.xml`
    files.push({ path: xmlPath, text: generateDeviceXml(device) })

    if (device.mediaPool.length > 0) {
      files.push({ path: `${dir}/Media/MEDIA.txt`, text: mediaManifest(device) })
    }

    devices.push({
      name: device.name,
      dir,
      xmlPath,
      // Nothing is ever copied here — see the module comment.
      mediaCopied: 0,
      // Same meaning as the desktop export: pool items with no source to copy.
      mediaMissing: device.mediaPool.filter((m) => !m.filePath).map((m) => m.name)
    })
  }

  return { filename: `${fleetDir}.zip`, files, result: { outputDir: `${fleetDir}.zip`, devices } }
}
