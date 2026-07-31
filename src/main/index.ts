import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { DeviceConfig, FleetProject } from '../shared/config'
import { generateDeviceXml } from '../shared/xmlGenerator'
import { exportFleet } from './services/folderExporter'
import { applyToDevice } from './services/networkApply'
import { openFleet, pickExportDir, saveFleet } from './services/fleetStore'
import { collectDiagnostics, init as initDiag, say } from './diag/index.js'
import { installElectronDiagnostics } from './diag/electron.js'

// Before anything that can fail, so a failure during startup is logged and
// captured like any other. An Electron app is several processes, so the
// renderer and GPU hooks go in too - neither raises anything the main
// process's uncaughtException handler can see.
initDiag({
  app: 'atem-fleet-admin',
  envPrefix: 'ATEM_FLEET_ADMIN',
  version: '0.2.0',
  cwd: app_diag_cwd()
})
installElectronDiagnostics()

if (process.argv.includes('--collect-diagnostics')) {
  // stdout, so it can be used in a script; logging went to stderr.
  say.info(collectDiagnostics())
  app.exit(0)
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1013',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.allansargeant.atemfleetadmin')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  ipcMain.handle('fleet:open', () => openFleet())
  ipcMain.handle('fleet:save', (_e, fleet: FleetProject) => saveFleet(fleet))

  ipcMain.handle('export:folders', async (_e, fleet: FleetProject) => {
    const dir = await pickExportDir()
    if (!dir) return null
    return exportFleet(fleet, dir)
  })
  ipcMain.handle('export:preview-xml', (_e, device: DeviceConfig) => generateDeviceXml(device))

  ipcMain.handle('network:apply', (_e, device: DeviceConfig) => applyToDevice(device))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})


/** Repo root when running from source; irrelevant once packaged, where
 *  there is no .git and the git revision reads as 'unknown'. */
function app_diag_cwd(): string {
  return join(__dirname, '../../..')
}
