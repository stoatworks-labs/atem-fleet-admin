import { describe, expect, it } from 'vitest'
import { planFleetArchive } from './staticExport'
import { createDevice, createFleet } from '../shared/config'
import { generateDeviceXml } from '../shared/xmlGenerator'

describe('planFleetArchive', () => {
  it('lays out one config.xml per device under a sanitized fleet folder', () => {
    const fleet = createFleet('Road / Show')
    fleet.devices.push(createDevice('atem-mini-extreme-iso', 'Flypack 1'))
    fleet.devices.push(createDevice('atem-4me-broadcast-studio-4k', 'Studio A'))

    const plan = planFleetArchive(fleet)

    expect(plan.filename).toBe('Road___Show.zip')
    expect(plan.files.map((f) => f.path)).toEqual([
      'Road___Show/Flypack_1/config.xml',
      'Road___Show/Studio_A/config.xml'
    ])
    expect(plan.result.devices.map((d) => d.name)).toEqual(['Flypack 1', 'Studio A'])
  })

  it('produces the same XML the desktop export writes', () => {
    const fleet = createFleet('Tour')
    const device = createDevice('atem-mini-extreme-iso', 'Flypack 1')
    fleet.devices.push(device)

    const plan = planFleetArchive(fleet)

    expect(plan.files[0].text).toBe(generateDeviceXml(device))
  })

  it('adds a media manifest naming every pool slot, and copies nothing', () => {
    const fleet = createFleet('Tour')
    const device = createDevice('atem-mini-extreme-iso', 'Flypack 1')
    device.mediaPool.push({
      index: 0,
      kind: 'still',
      name: 'Holding slide',
      filePath: '/Users/me/Pictures/holding.png'
    })
    device.mediaPool.push({ index: 1, kind: 'still', name: 'Lower third', filePath: '' })
    fleet.devices.push(device)

    const plan = planFleetArchive(fleet)
    const manifest = plan.files.find((f) => f.path.endsWith('MEDIA.txt'))

    expect(manifest?.path).toBe('Tour/Flypack_1/Media/MEDIA.txt')
    expect(manifest?.text).toContain('still 0  Holding slide')
    expect(manifest?.text).toContain('/Users/me/Pictures/holding.png')
    expect(manifest?.text).toContain('(no source path set)')

    // A browser never copies media; only the item with no source counts as
    // missing, matching what the desktop export reports for the same fleet.
    expect(plan.result.devices[0].mediaCopied).toBe(0)
    expect(plan.result.devices[0].mediaMissing).toEqual(['Lower third'])
  })

  it('omits the manifest when a device has no media pool', () => {
    const fleet = createFleet('Tour')
    fleet.devices.push(createDevice('atem-mini-extreme-iso', 'Flypack 1'))

    expect(planFleetArchive(fleet).files).toHaveLength(1)
  })
})
