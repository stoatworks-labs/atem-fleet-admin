/**
 * IPC message contracts shared between the main and renderer processes.
 * Mirrors the pattern in animATEM/src/shared/protocol.ts.
 */

import type { DeviceConfig, FleetProject } from './config'

export interface ExportResult {
  /** Root directory the fleet folders were written under. */
  outputDir: string
  devices: {
    name: string
    /** Directory written for this device. */
    dir: string
    /** Absolute path to the generated config XML. */
    xmlPath: string
    /** Number of media pool files copied. */
    mediaCopied: number
    /** Media pool items whose source file was missing on disk. */
    mediaMissing: string[]
  }[]
}

export type ApplyStepStatus = 'ok' | 'skipped' | 'error'

export interface ApplyStep {
  /** Human label for the setting group, e.g. "Input names" or "Streaming service". */
  label: string
  status: ApplyStepStatus
  /** Detail on skip/error, or which fields are folder-export only. */
  detail?: string
}

export interface ApplyResult {
  deviceName: string
  connected: boolean
  steps: ApplyStep[]
}

/** Fleet-project persistence result. */
export interface SaveResult {
  filePath: string
}

export interface OpenResult {
  filePath: string
  fleet: FleetProject
}

/**
 * What the backend behind `window.api` can actually do.
 *
 * The same React UI runs on three backends — Electron IPC, the local HTTP
 * server, and the static browser build — and they differ in ways the operator
 * has to see rather than discover by pressing a dead button. The UI reads these
 * instead of sniffing for Electron.
 */
export interface BackendCapabilities {
  /**
   * Live "Connect & apply" over the network. False in the hosted browser build:
   * a web page cannot open a TCP socket to a switcher on the LAN.
   */
  networkApply: boolean
  /**
   * What `export.toFolders` produces — directories written to a chosen location,
   * or a ZIP the browser downloads.
   */
  exportKind: 'folders' | 'zip'
  /**
   * Whether the export copies each media-pool item's source file alongside the
   * XML. False in the browser, which cannot read a typed absolute path.
   */
  bundlesMedia: boolean
}

/** The typed bridge exposed to the renderer as `window.api`. */
export interface FleetAdminApi {
  capabilities: BackendCapabilities

  fleet: {
    open: () => Promise<OpenResult | null>
    save: (fleet: FleetProject) => Promise<SaveResult | null>
  }
  export: {
    /** Prompt for a directory and write per-device folders + media. */
    toFolders: (fleet: FleetProject) => Promise<ExportResult | null>
    /** Generate the XML for one device without writing anything (for preview). */
    previewXml: (device: DeviceConfig) => Promise<string>
  }
  network: {
    /** Connect to a device and apply the settable subset of its config. */
    apply: (device: DeviceConfig) => Promise<ApplyResult>
  }
  /**
   * Support bundle collection. Electron only: both operations write to and
   * reveal a folder on disk. The browser backends omit it and the UI hides the
   * panel rather than offering buttons that cannot work.
   */
  diag?: {
    /** Write one JSON file describing the app's state and return its path. */
    collect: () => Promise<string>
    /** Reveal the log folder in the OS file manager. */
    openLogFolder: () => Promise<string>
  }
}
