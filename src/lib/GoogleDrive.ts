// Minimal Google Drive REST client for *public* ("anyone with the link") files.
//
// A browser API key can only read public files — that's the whole reason this
// stays a key + fetch instead of an OAuth flow. Two calls cover the need:
//   * files.list  — enumerate a folder so the user can pick a file
//   * files.get?alt=media — download a file's raw text into the editor
//
// The key is never committed. It comes from VITE_GDRIVE_API_KEY at build time,
// or a localStorage override ('gdriveApiKey') so it can be set at runtime on the
// deployed static site without a rebuild.

const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files'

export type DriveFile = {
  id: string
  name: string
  mimeType: string
}

export function getApiKey(): string {
  const fromStorage = (() => {
    try {
      return localStorage.getItem('gdriveApiKey') || ''
    } catch {
      return ''
    }
  })()
  return fromStorage || import.meta.env.VITE_GDRIVE_API_KEY || ''
}

// Accept either a bare folder ID or a pasted Drive URL
// (https://drive.google.com/drive/folders/<ID>?usp=...) and return the ID.
export function normalizeFolderId(input: string): string {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/\/folders\/([^/?#]+)/)
  if (fromUrl) return fromUrl[1]
  // Some URLs use ?id=<ID> instead of a /folders/ path segment.
  const fromQuery = trimmed.match(/[?&]id=([^&]+)/)
  if (fromQuery) return fromQuery[1]
  return trimmed
}

function requireKey(): string {
  const key = getApiKey()
  if (!key) {
    throw new Error(
      'No Google Drive API key. Set VITE_GDRIVE_API_KEY at build time, or run ' +
      "localStorage.setItem('gdriveApiKey', '<key>') in the console.",
    )
  }
  return key
}

async function driveFetch(url: string): Promise<Response> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Drive request failed (${res.status}): ${body.slice(0, 300)}`)
  }
  return res
}

// List the (non-folder) files in a public folder, newest first. Folders are
// filtered out so the picker only shows loadable content.
export async function listFolder(folderIdOrUrl: string): Promise<DriveFile[]> {
  const folderId = normalizeFolderId(folderIdOrUrl)
  const params = new URLSearchParams({
    key: requireKey(),
    q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: 'files(id,name,mimeType)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
  })
  const res = await driveFetch(`${FILES_ENDPOINT}?${params}`)
  const data = (await res.json()) as { files?: DriveFile[] }
  return data.files || []
}

// Native Google Editors files (Docs/Sheets/Slides) have no binary content, so
// alt=media 403s on them — they must go through the export endpoint instead.
const GOOGLE_DOC = 'application/vnd.google-apps.document'

// Images no longer come from Drive — they live in a public GitHub repo served
// over Pages (keyless, CDN-backed). See lib/PrflAssets.ts for that listing.

// Download a file as text. Plain-text files (our .rngl / .rndl sources) download
// their raw bytes; a Google Doc is exported flattened to text/plain (newlines,
// no formatting). Pass the mimeType from the listing to pick the right path.
export async function fetchFileText(fileId: string, mimeType?: string): Promise<string> {
  const key = requireKey()
  const url = mimeType === GOOGLE_DOC
    ? `${FILES_ENDPOINT}/${fileId}/export?${new URLSearchParams({ key, mimeType: 'text/plain' })}`
    : `${FILES_ENDPOINT}/${fileId}?${new URLSearchParams({ key, alt: 'media' })}`
  const res = await driveFetch(url)
  const text = await res.text()
  // Google Docs export text/plain with CRLF (\r\n) line endings; normalize to
  // plain \n so downstream line-based parsing matches the raw .rngl/.rndl files.
  return mimeType === GOOGLE_DOC ? text.replace(/\r\n/g, '\n') : text
}
