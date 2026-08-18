import React, { useEffect, useState } from 'react'
import { signOne, storagePath } from '../../lib/storageUrl'

/**
 * Drop-in replacement for <img> where the source is an object in a private
 * storage bucket.
 *
 * Both `gallery` (children's photographs) and `staff-photos` (staff and
 * volunteer headshots) are private, so a stored reference cannot be rendered
 * directly -- it has to be exchanged for a short-lived signed URL first.
 *
 * Accepts whatever is stored against the row: a bare object path, a legacy
 * public URL from before the buckets were made private, or an already-signed
 * URL. Every other prop is forwarded to the underlying <img> untouched, so
 * swapping <img ... /> for <SignedImg ... /> is behaviour-preserving apart
 * from the signing.
 *
 * While the URL is being minted, and if signing fails (for example the object
 * belongs to another organisation), nothing is rendered -- callers already
 * wrap these in a container that shows initials as a fallback.
 */
export default function SignedImg({ src, bucket = null, ...rest }) {
  const [href, setHref] = useState(null)

  useEffect(() => {
    let cancelled = false

    if (!src) { setHref(null); return undefined }
    if (/^(data|blob):/i.test(src)) { setHref(src); return undefined }

    // A legacy stored URL names its own bucket, which beats anything the call
    // site guessed. Failing that, use an explicit prop. Failing that, infer
    // from the shape of the path: gallery objects are always foldered by org
    // id, staff photos are flat files named for the user id.
    let resolved = bucket
    const match = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\//.exec(src)
    if (match) {
      resolved = match[1]
    } else if (!resolved) {
      resolved = src.includes('/') ? 'gallery' : 'staff-photos'
    }

    // Anything that isn't ours (an external avatar URL) passes through rather
    // than being sent to the storage API.
    if (!match && !storagePath(resolved, src)) { setHref(src); return undefined }

    signOne(resolved, src).then(url => { if (!cancelled) setHref(url) })

    return () => { cancelled = true }
  }, [src, bucket])

  if (!href) return null
  return <img {...rest} src={href} alt={rest.alt || ''} />
}
