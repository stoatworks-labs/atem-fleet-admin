/**
 * File in / file out for the browser backends.
 *
 * A browser has no save dialog and no path-addressable filesystem, so both the
 * server-backed build (webApi) and the static build (staticApi) move projects
 * through a download and an `<input type="file">`.
 */

/** Prompt the browser to download `data` as a file. */
export function download(data: BlobPart, filename: string, type: string): void {
  const blob = new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Open a browser file picker and resolve the chosen file's text (or null). */
export function pickFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = async (): Promise<void> => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      resolve({ name: file.name, text: await file.text() })
    }
    // If the dialog is cancelled no change fires; that simply leaves the promise
    // pending, which is harmless for this one-shot UI action.
    input.click()
  })
}
