import { useState } from 'react'

/**
 * "Something went wrong, send me the details" — as one button.
 *
 * The bundle is a single JSON file holding the logs, the build identity, the
 * settings (with anything password-shaped removed) and any recent crash
 * report. Collapsed by default: this is a support tool, not something anyone
 * needs during a show.
 *
 * The path is copied to the clipboard as well as shown, because nobody retypes
 * a path out of a dialog, and revealed in the file manager because on macOS it
 * lives under ~/Library/Logs, which is hidden in Finder by default.
 */
export function DiagnosticsPanel(): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Absent on the browser backends: there is no log folder to collect or reveal.
  const diag = window.api.diag
  if (!diag) return null

  const collect = async (): Promise<void> => {
    setBusy(true)
    setStatus(null)
    try {
      const path = await diag.collect()
      try {
        await navigator.clipboard.writeText(path)
        setStatus(`Written to ${path} — path copied to your clipboard.`)
      } catch {
        // Clipboard access can be refused; the path is still on screen.
        setStatus(`Written to ${path}`)
      }
    } catch (err) {
      setStatus(`Could not collect diagnostics: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const openFolder = async (): Promise<void> => {
    try {
      await diag.openLogFolder()
    } catch (err) {
      setStatus(`Could not open the log folder: ${(err as Error).message}`)
    }
  }

  return (
    <div className="diagnostics-panel">
      <button
        className="diagnostics-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        Diagnostics
      </button>
      {expanded && (
        <div className="diagnostics-body">
          <p className="diagnostics-hint">
            If something goes wrong, collect diagnostics and attach the file to your bug report. It
            holds the logs, the app version, your settings with any passwords removed, and details
            of any recent crash.
          </p>
          <div className="diagnostics-actions">
            <button onClick={collect} disabled={busy}>
              {busy ? 'Collecting…' : 'Collect Diagnostics'}
            </button>
            <button onClick={openFolder}>Open Log Folder</button>
          </div>
          {status && <p className="diagnostics-status">{status}</p>}
        </div>
      )}
    </div>
  )
}
