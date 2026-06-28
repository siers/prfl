// Keyless image listing for the practice app, backed by a public GitHub repo
// served over GitHub Pages.
//
// Why not Google Drive: Drive's alt=media URLs get rate-limited/blocked for
// image hotlinking. The assets now live in a public repo whose files are served
// by GitHub Pages (a real CDN, CORS `*`), so:
//   * <img src> loads straight from the Pages domain — no key, no CORS issue.
//   * the file *list* comes from the GitHub Trees API in a single keyless call
//     (Access-Control-Allow-Origin: *), filtered to image blobs.
//
// The Trees API is rate-limited to 60 req/hr per IP unauthenticated, but the
// listing only happens on an explicit button click, so we just re-fetch each
// time rather than caching.

// [filename, rawUrl] for an image — same shape the rest of the app already uses
// (glob substring-matches on filename, the image block resolves filename→url).
export type ImageEntry = [string, string]

// Hardcoded defaults for the common case; overridable via env without code edits.
const REPO = import.meta.env.VITE_PRFL_ASSETS_REPO || 'siers/prfl-assets'
const BRANCH = import.meta.env.VITE_PRFL_ASSETS_BRANCH || 'HEAD'
// Pages origin that serves the repo's files. Trailing slash optional.
const BASE_URL = (import.meta.env.VITE_PRFL_ASSETS_URL || 'http://raitis.veinbahs.lv/prfl-assets/').replace(/\/?$/, '/')

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i

const TREES_ENDPOINT = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`

type TreeEntry = { path: string; type: string }
type TreeResponse = { tree?: TreeEntry[]; truncated?: boolean; message?: string }

// Pages URL for a repo-relative path. Each segment is encoded so spaces and
// other special characters in filenames survive (the repo has filenames with
// spaces, e.g. "Screenshot 2025-12-30 at 21.31.46.png").
function assetUrl(path: string): string {
  return BASE_URL + path.split('/').map(encodeURIComponent).join('/')
}

// List the repo's images as [filename, url] tuples. The whole repo tree comes
// back in one Trees API call; we keep the image blobs and map their paths to
// Pages URLs. The path is already the unique, subfolder-prefixed filename, so it
// drops straight into the existing filename-based matching.
export async function listImages(): Promise<ImageEntry[]> {
  const res = await fetch(TREES_ENDPOINT)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub tree request failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as TreeResponse
  if (!data.tree) throw new Error(`GitHub tree response had no tree: ${data.message || 'unknown'}`)
  if (data.truncated) {
    // The repo exceeded the Trees API's size cap — the list is incomplete.
    // Surface it rather than silently showing a partial set.
    console.warn('prfl-assets tree truncated — image list may be incomplete')
  }

  const images: ImageEntry[] = data.tree
    .filter(e => e.type === 'blob' && IMAGE_EXT.test(e.path))
    .map(e => [e.path, assetUrl(e.path)] satisfies ImageEntry)

  return images
}
