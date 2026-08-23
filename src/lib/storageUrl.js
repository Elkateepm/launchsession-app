import { supabase } from './supabase'

// Signed URLs for private storage buckets.
//
// The `gallery` bucket holds photographs and video of children. It used to be
// a public bucket, which meant every object was retrievable by anyone holding
// the URL -- no authentication, no row-level security, and no tenant boundary,
// because a public bucket bypasses the storage RLS policies entirely on read.
// A URL that leaked through browser history, a forwarded link, a referrer
// header or a screenshot granted permanent access to an image of a child.
//
// The bucket is now private, so reads go through RLS (org-scoped) and are
// served via short-lived signed URLs generated here.
//
// Rows written before the change still carry a full public-style URL in their
// `url` column. Those URLs no longer resolve, but they remain a reliable way
// to recover the object path, so `storagePath` accepts either a bare path or
// any stored URL and there is no data migration to run.

// One hour, not ten minutes.
//
// A signed URL carries its token in the query string, so re-signing an object
// produces a *different* URL for the same bytes. The browser cache is keyed on
// the full URL, so every re-sign is a guaranteed cache miss and a full
// re-download of the image. Egress is therefore driven by how often we re-sign,
// not by how many distinct images exist.
//
// At ten minutes, a volunteer with the gallery open re-downloaded every visible
// photograph six times an hour. Raising this to an hour cuts that by 6x. The
// security cost is bounded: a leaked URL stays live for an hour instead of ten
// minutes, and revoking a user's access still leaves them working URLs for the
// remainder of the TTL either way -- an hour is the same class of exposure, not
// a different one.
const DEFAULT_TTL_SECONDS = 60 * 60
const REFRESH_MARGIN_MS = 60 * 1000

// `${bucket}:${path}` -> { url, expiresAt }
const cache = new Map()

const isFresh = (entry) => entry && entry.expiresAt - Date.now() > REFRESH_MARGIN_MS

/**
 * Recover the object path from whatever is stored against a row: a bare path,
 * a legacy public URL, or an already-signed URL. Returns null if it can't.
 */
export function storagePath(bucket, value) {
  if (!value || typeof value !== 'string') return null

  // Protocol-relative (//cdn.example/x.jpg), scheme-qualified non-HTTP, and
  // root-relative values are not our object paths. Treating them as such sent
  // external avatar URLs to the storage API and mangled them.
  if (/^\/\//.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/')) {
    return null
  }

  if (!/^https?:\/\//i.test(value)) {
    return value || null
  }

  for (const kind of ['public', 'sign', 'authenticated']) {
    const marker = `/storage/v1/object/${kind}/${bucket}/`
    const at = value.indexOf(marker)
    if (at !== -1) {
      const tail = value.slice(at + marker.length).split('?')[0]
      try {
        return decodeURIComponent(tail) || null
      } catch (e) {
        return tail || null
      }
    }
  }
  return null
}

/**
 * Sign a single object. Accepts a path or a stored URL.
 * Returns null when the value is unusable or the caller isn't allowed to read
 * it -- callers should fall back to a placeholder rather than a broken image.
 */
export async function signOne(bucket, value, ttl = DEFAULT_TTL_SECONDS) {
  const path = storagePath(bucket, value)
  if (!path) return null

  const key = `${bucket}:${path}`
  const hit = cache.get(key)
  if (isFresh(hit)) return hit.url

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl)
  if (error || !data?.signedUrl) return null

  cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + ttl * 1000 })
  return data.signedUrl
}

/**
 * Sign many objects in one round trip. Order is preserved and entries that
 * cannot be signed come back as null.
 */
export async function signMany(bucket, values, ttl = DEFAULT_TTL_SECONDS) {
  const paths = values.map(v => storagePath(bucket, v))
  const out = new Array(paths.length).fill(null)

  const needed = []
  paths.forEach((path, i) => {
    if (!path) return
    const hit = cache.get(`${bucket}:${path}`)
    if (isFresh(hit)) { out[i] = hit.url; return }
    needed.push(path)
  })

  if (needed.length) {
    const unique = [...new Set(needed)]
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, ttl)
    if (!error && Array.isArray(data)) {
      data.forEach(entry => {
        if (entry?.signedUrl && entry?.path) {
          cache.set(`${bucket}:${entry.path}`, { url: entry.signedUrl, expiresAt: Date.now() + ttl * 1000 })
        }
      })
    }
    paths.forEach((path, i) => {
      if (out[i] || !path) return
      const hit = cache.get(`${bucket}:${path}`)
      if (hit) out[i] = hit.url
    })
  }

  return out
}

/**
 * Replace a URL field on each row with a freshly signed URL, in place of the
 * stored value. Every existing render site keeps reading the same field, so
 * this is the only change needed at the point rows are loaded.
 *
 * `pathField` is preferred when present because it is the object path as
 * written at upload time; `urlField` is the fallback for older rows.
 */
export async function signRows(bucket, rows, { urlField = 'url', pathField = 'path', ttl = DEFAULT_TTL_SECONDS } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || []

  const source = rows.map(r => (pathField && r?.[pathField]) || r?.[urlField] || null)
  const signed = await signMany(bucket, source, ttl)

  return rows.map((row, i) => (signed[i] ? { ...row, [urlField]: signed[i] } : row))
}

/** Drop cached URLs. Call after deleting or replacing an object. */
export function forgetSignedUrl(bucket, value) {
  const path = storagePath(bucket, value)
  if (path) cache.delete(`${bucket}:${path}`)
}

export function clearSignedUrlCache() {
  cache.clear()
}

// Drop every cached URL when the session changes.
//
// The cache is module-scoped and keyed only by bucket and path, so without
// this it outlives a sign-out: on a shared tablet -- the normal way a charity
// runs a register -- the next user inherits the previous user's signed URLs
// until they expire. Cross-tenant reach is limited, because obtaining a path
// at all requires a row that RLS allowed you to read, but a user whose access
// is revoked mid-session would otherwise keep working URLs for the full TTL.
//
// Wired here rather than at the sign-out handlers: there are ten of those and
// the eleventh would forget.
//
// SIGNED_IN is deliberately NOT in this list. Supabase emits SIGNED_IN on every
// tab refocus, not just on an actual login -- it re-validates the session when
// the tab becomes visible again and announces the result. Clearing here meant
// that alt-tabbing away and back re-signed and so re-downloaded every image on
// screen, which is what took the sibling app to 201% of its egress quota.
//
// Handing the tablet to the next user is still safe: signing out emits
// SIGNED_OUT, which clears. The residual gap is a session *replaced* without a
// sign-out first, which in practice means a recovery link -- covered by
// PASSWORD_RECOVERY below.
supabase.auth.onAuthStateChange((event) => {
  // PASSWORD_RECOVERY is distinct: a recovery link opened in an already-running
  // tab replaces the session without emitting SIGNED_OUT, which would otherwise
  // leave the previous user's URLs cached.
  if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
    cache.clear()
  }
})
