/**
 * Write per-device folders for manual loading into ATEM Software Control.
 *
 * Layout:
 *   <outputDir>/<FleetName>/<DeviceName>/config.xml   (the generated Profile)
 *   <outputDir>/<FleetName>/<DeviceName>/Media/...     (copied media-pool files)
 *
 * The operator drags the Media files into the switcher's media pool and uses
 * ATEM Software Control's "Load" to apply config.xml.
 */

import { promises as fs } from 'fs'
import { basename, join } from 'path'
import type { DeviceConfig, FleetProject } from '../../shared/config'
import type { ExportResult } from '../../shared/protocol'
import { generateDeviceXml } from './xmlGenerator'

/**
 * Make a string safe to use as a folder name across platforms.
 *
 * Does NOT unique the result: two device (or fleet) names that sanitize to the
 * same string get the same folder, and the second export overwrites the first
 * with no warning. "Studio 1" and "Studio/1" both become "Studio_1". If that
 * ever needs fixing, do it here rather than at the call sites.
 */
export function sanitizeName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s/g, '_')
    .replace(/\.+$/, '')
  return cleaned || 'Untitled'
}

/**
 * Write one device's folder: config.xml plus a Media/ directory of copied
 * media-pool files.
 *
 * A media item with no path, or whose copy throws, is recorded in
 * `mediaMissing` and the export CONTINUES — it is not an error and the run
 * still succeeds. That is right (one bad path shouldn't lose a whole fleet
 * export) and it means a device can report success with an empty Media/
 * folder, which is exactly what a mistyped or moved source path looks like.
 * Callers must surface mediaMissing; the UI and docs both do.
 */
async function exportDevice(
  device: DeviceConfig,
  fleetDir: string
): Promise<ExportResult['devices'][number]> {
  const dir = join(fleetDir, sanitizeName(device.name))
  await fs.mkdir(dir, { recursive: true })

  const xmlPath = join(dir, 'config.xml')
  await fs.writeFile(xmlPath, generateDeviceXml(device), 'utf8')

  let mediaCopied = 0
  const mediaMissing: string[] = []
  if (device.mediaPool.length > 0) {
    const mediaDir = join(dir, 'Media')
    await fs.mkdir(mediaDir, { recursive: true })
    for (const item of device.mediaPool) {
      if (!item.filePath) {
        mediaMissing.push(item.name)
        continue
      }
      try {
        await fs.copyFile(item.filePath, join(mediaDir, basename(item.filePath)))
        mediaCopied += 1
      } catch {
        mediaMissing.push(item.name)
      }
    }
  }

  return { name: device.name, dir, xmlPath, mediaCopied, mediaMissing }
}

/**
 * Write every device in the fleet under `outputDir`.
 *
 * Sequential rather than parallel, deliberately: these are user-visible writes
 * to a chosen directory, and a predictable order makes a partial run easier to
 * reason about than a faster one. Per-device results (including mediaMissing)
 * come back in fleet order.
 */
export async function exportFleet(fleet: FleetProject, outputDir: string): Promise<ExportResult> {
  const fleetDir = join(outputDir, sanitizeName(fleet.name))
  await fs.mkdir(fleetDir, { recursive: true })

  const devices: ExportResult['devices'] = []
  for (const device of fleet.devices) {
    devices.push(await exportDevice(device, fleetDir))
  }

  return { outputDir: fleetDir, devices }
}
