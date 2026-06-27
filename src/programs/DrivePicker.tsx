import { JSX, useState } from 'react'
import { DriveFile, fetchFileText, getApiKey, listFolder } from '../lib/GoogleDrive.ts'

// The folder to browse. Hardcodable via env (VITE_GDRIVE_FOLDER_ID) so the
// common case is zero-click; falls back to a prompt if unset so it still works
// without a rebuild.
const DEFAULT_FOLDER_ID = import.meta.env.VITE_GDRIVE_FOLDER_ID || ''

type Props = {
  // Called with the downloaded file text once the user picks a file.
  onLoad: (text: string) => void
}

type Status =
  | { kind: 'idle' }
  | { kind: 'listing' }
  | { kind: 'listed'; files: DriveFile[] }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }

// A small picker that lists a public Drive folder and loads the chosen file's
// text into the editor. Renders as a single 📁 control that expands to a list.
export function DrivePicker({ onLoad }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [folderId, setFolderId] = useState(DEFAULT_FOLDER_ID)

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
            <div className="mt-1 border-t pt-1 text-xs text-gray-500">
              <span className="cursor-pointer select-none" onClick={() => refreshList(folderId)}>🔄 refresh</span>
            </div>
          )}
        </div>
      )}
    </span>
  )
}
