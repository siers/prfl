import { JSX, useEffect, useRef, useState } from 'react'
import { DriveFile, fetchFileText, findFileByName, getApiKey, listFolder } from '../lib/GoogleDrive.ts'
import { ImageEntry, listImages } from '../lib/PrflAssets.ts'

// The folder to browse. Hardcodable via env (VITE_GDRIVE_FOLDER_ID) so the
// common case is zero-click; falls back to a prompt if unset so it still works
// without a rebuild.
const DEFAULT_FOLDER_ID = import.meta.env.VITE_GDRIVE_FOLDER_ID || ''

// The URL parameter that names a file to pull in without any clicking:
// /perflab/?load=Napkin  ->  loads (and starts) the first Drive file whose name
// contains "Napkin".
const LOAD_PARAM = 'load'

type Props = {
  // Called with the downloaded file text once the user picks a file.
  onLoad: (text: string) => void
  // Optional: called instead of onLoad when the file came from `?load=`. Lets
  // the host treat an unattended load differently from a deliberate pick (we
  // start the program right away). Falls back to onLoad when absent.
  onAutoLoad?: (text: string) => void
  // Optional: called with the folder's images as [filename, rawUrl] tuples when
  // the user loads images. Omit to hide the image control.
  onImages?: (images: ImageEntry[]) => void
}

// Read `?load=` off the current URL, or '' when it isn't there.
function loadParam(): string {
  try {
    return new URLSearchParams(window.location.search).get(LOAD_PARAM) || ''
  } catch {
    return ''
  }
}

// Drop `?load=` from the address bar once we've acted on it, so a refresh (or a
// bookmark made after the fact) doesn't re-fetch and clobber later edits.
function stripLoadParam(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(LOAD_PARAM)) return
    url.searchParams.delete(LOAD_PARAM)
    window.history.replaceState(null, '', url.toString())
  } catch {
    /* non-browser host, or history blocked — the load itself still happened */
  }
}

type Status =
  | { kind: 'idle' }
  | { kind: 'listing' }
  | { kind: 'listed'; files: DriveFile[] }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }

// A small picker that lists a public Drive folder and loads the chosen file's
// text into the editor. Renders as a single 📁 control that expands to a list.
export function DrivePicker({ onLoad, onAutoLoad, onImages }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [folderId, setFolderId] = useState(DEFAULT_FOLDER_ID)

  // `?load=<name>`: list the folder, take the best name match, load it. Runs at
  // most once per mount (React 18 mounts twice in StrictMode, and the picker
  // re-renders on every keystroke in the editor) — the ref, not the effect deps,
  // is what makes that true.
  const autoLoaded = useRef(false)
  useEffect(() => {
    const query = loadParam()
    if (!query || autoLoaded.current) return
    autoLoaded.current = true

    const id = folderId || DEFAULT_FOLDER_ID
    if (!id) {
      setStatus({ kind: 'error', message: `?load=${query}: no folder configured (VITE_GDRIVE_FOLDER_ID).` })
      setOpen(true)
      return
    }
    if (!getApiKey()) {
      setStatus({ kind: 'error', message: `?load=${query}: no API key — see DrivePicker / GoogleDrive.ts for setup.` })
      setOpen(true)
      return
    }

    // Errors surface in the (opened) panel rather than throwing: a mistyped
    // ?load= shouldn't leave the user staring at an unexplained empty editor.
    ;(async () => {
      setStatus({ kind: 'loading' })
      try {
        const files = await listFolder(id)
        const file = findFileByName(files, query)
        if (!file) {
          setStatus({ kind: 'error', message: `?load=${query}: no matching file in the folder.` })
          setOpen(true)
          return
        }
        const text = await fetchFileText(file.id, file.mimeType)
        ;(onAutoLoad || onLoad)(text)
        stripLoadParam()
        setStatus({ kind: 'idle' })
      } catch (e) {
        setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
        setOpen(true)
      }
    })()
  }, [])

  async function refreshList(id: string) {
    setStatus({ kind: 'listing' })
    try {
      const files = await listFolder(id)
      setStatus({ kind: 'listed', files })
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (!next) return
    if (!getApiKey()) {
      setStatus({ kind: 'error', message: 'No API key — see DrivePicker / GoogleDrive.ts for setup.' })
      return
    }
    const id = folderId || (prompt('Google Drive folder ID') || '')
    if (!id) {
      setOpen(false)
      return
    }
    setFolderId(id)
    refreshList(id)
  }

  async function pick(file: DriveFile) {
    setStatus({ kind: 'loading' })
    try {
      const text = await fetchFileText(file.id, file.mimeType)
      onLoad(text)
      setOpen(false)
      setStatus({ kind: 'idle' })
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  // Images come from the GitHub-backed assets repo, not Drive — keyless. Listing
  // only happens on this explicit click, so it always re-fetches.
  async function loadImages() {
    if (!onImages) return
    setStatus({ kind: 'loading' })
    try {
      const images = await listImages()
      onImages(images)
      setOpen(false)
      setStatus({ kind: 'idle' })
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <span className="relative inline-block">
      <a className="pr-3 select-none" title="load from Google Drive" onClick={toggle}>📁</a>
      {open && (
        <div className="absolute left-0 top-6 z-10 w-72 max-h-80 overflow-auto rounded border bg-white p-2 text-sm shadow-lg">
          {status.kind === 'listing' && <div className="p-1 text-gray-500">listing…</div>}
          {status.kind === 'loading' && <div className="p-1 text-gray-500">loading file…</div>}
          {status.kind === 'error' && <div className="p-1 break-words text-red-600">{status.message}</div>}
          {status.kind === 'listed' && (
            status.files.length === 0
              ? <div className="p-1 text-gray-500">empty folder</div>
              : status.files.map(f => (
                <div
                  key={f.id}
                  className="cursor-pointer truncate rounded px-1 py-0.5 hover:bg-gray-100"
                  title={f.name}
                  onClick={() => pick(f)}
                >
                  {f.name}
                </div>
              ))
          )}
          {(status.kind === 'listed' || status.kind === 'error') && (
            <div className="mt-1 flex gap-3 border-t pt-1 text-xs text-gray-500">
              <span className="cursor-pointer select-none" onClick={() => refreshList(folderId)}>🔄 refresh</span>
              {onImages && <span className="cursor-pointer select-none" onClick={() => loadImages()}>🖼️ load images</span>}
            </div>
          )}
        </div>
      )}
    </span>
  )
}
