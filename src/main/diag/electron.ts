import { app, ipcMain, shell, type App } from 'electron'

import { collectDiagnostics, log, logDirectory, writeCrashReport } from './index.js'

/**
 * Electron-specific crash capture.
 *
 * An Electron app is several processes. `uncaughtException` in the main
 * process — which is what the base module hooks — covers exactly one of them.
 * A renderer that dies takes the window with it and leaves the main process
 * running and cheerful, and a GPU process that dies degrades rendering
 * silently. Neither raises anything the base hooks can see, so both are
 * recorded here instead.
 */
export function installElectronDiagnostics(electronApp: App = app): void {
  electronApp.on('render-process-gone', (_event, contents, details) => {
    // `clean-exit` is a normal teardown; anything else is a fault.
    const fatal = details.reason !== 'clean-exit'
    log[fatal ? 'error' : 'info'](
      { reason: details.reason, exitCode: details.exitCode, url: safeUrl(contents) },
      'renderer process gone'
    )
    if (fatal) {
      writeProcessCrash('render-process-gone', details.reason, {
        exitCode: details.exitCode,
        url: safeUrl(contents)
      })
    }
  })

  electronApp.on('child-process-gone', (_event, details) => {
    const fatal = details.reason !== 'clean-exit'
    log[fatal ? 'error' : 'info'](
      { type: details.type, reason: details.reason, exitCode: details.exitCode },
      'child process gone'
    )
    if (fatal) {
      writeProcessCrash('child-process-gone', details.reason, {
        type: details.type,
        exitCode: details.exitCode
      })
    }
  })

  // Available to the renderer so a UI can offer "collect diagnostics" without
  // the renderer needing filesystem access of its own.
  ipcMain.handle('diag:collect', () => {
    const path = collectDiagnostics()
    log.info({ path }, 'diagnostics bundle written')
    return path
  })

  ipcMain.handle('diag:openLogFolder', async () => {
    const dir = logDirectory()
    await shell.openPath(dir)
    return dir
  })
}

/** Reading a URL off a dead WebContents can itself throw. */
function safeUrl(contents: Electron.WebContents): string {
  try {
    return contents.getURL()
  } catch {
    return '<unavailable>'
  }
}

function writeProcessCrash(
  trigger: string,
  reason: string,
  detail: Record<string, unknown>
): void {
  writeCrashReport(trigger, Object.assign(new Error(`${trigger}: ${reason}`), detail))
}
