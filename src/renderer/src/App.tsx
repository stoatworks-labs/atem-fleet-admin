import { DeviceEditor } from './components/DeviceEditor'
import { ExportBar } from './components/ExportBar'
import { FleetSidebar } from './components/FleetSidebar'
import { DiagnosticsPanel } from './components/DiagnosticsPanel'
import { useFleet } from './store'

function App(): React.JSX.Element {
  const fleet = useFleet((s) => s.fleet)
  const selectedId = useFleet((s) => s.selectedId)
  const setFleet = useFleet((s) => s.setFleet)
  const setFleetName = useFleet((s) => s.setFleetName)

  const device = fleet.devices.find((d) => d.id === selectedId) ?? null

  const open = async (): Promise<void> => {
    const result = await window.api.fleet.open()
    if (result) setFleet(result.fleet, result.filePath)
  }

  const save = async (): Promise<void> => {
    await window.api.fleet.save(fleet)
  }

  return (
    <div className="app">
      <header className="app-header sw-bar">
        <span className="sw-brand">
          <span className="sw-mark" aria-hidden="true">
            ☰
          </span>
          <span className="brand-name">ATEM Fleet Admin</span>
        </span>
        <input
          className="fleet-name"
          value={fleet.name}
          onChange={(e) => setFleetName(e.target.value)}
          aria-label="Fleet name"
        />
        <div className="header-actions">
          <button onClick={open}>Open…</button>
          <button onClick={save}>Save…</button>
          <DiagnosticsPanel />
          {/* A new tab in a browser; in the desktop app setWindowOpenHandler
              hands it to the system browser, so the window never navigates. */}
          <a
            className="header-link"
            href="https://stoatworks-labs.com/web-tools/atem-fleet-admin/"
            target="_blank"
            rel="noopener noreferrer"
          >
            On Stoatworks Labs
          </a>
          {/* Opens the shared About dialog — see public/about.js, which delegates
              this attribute from the document, so nothing needs importing here.
              One dialog for all three builds: desktop, local server and hosted.
              Last, at the right-hand end of the navy bar, as on every tool. */}
          <button type="button" data-stoatworks-about>
            About
          </button>
        </div>
      </header>

      <div className="body">
        <FleetSidebar />
        <main className="main">
          {device ? (
            <>
              <DeviceEditor device={device} />
              <ExportBar device={device} />
            </>
          ) : (
            <div className="empty-state">
              <h2>No device selected</h2>
              <p>Add an ATEM from the sidebar, then build its config through the tabs.</p>
              <p className="muted">
                {window.api.capabilities.networkApply
                  ? 'Generate loadable XML + media folders, or connect and apply over the network.'
                  : 'Generate loadable XML folders as a .zip. Everything happens in this tab — nothing is uploaded.'}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
