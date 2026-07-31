/**
 * Naming rules shared by every export backend.
 *
 * Lives in shared/ rather than next to the filesystem exporter because the
 * browser build produces the same folder layout inside a ZIP and must name the
 * entries identically — a fleet exported from the web app and the same fleet
 * exported from the desktop app have to unpack to the same paths.
 */

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
