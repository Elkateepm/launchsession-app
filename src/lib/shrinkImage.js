// Shrink an image in the browser before it is uploaded.
//
// Phones upload camera originals untouched: a photograph rendered at 40 pixels
// square in a register arrives as several megabytes. That is paid for twice --
// once in storage, and again in egress every single time somebody opens the
// screen it appears on.
//
// Supabase Storage Image Transformations would do this server side, but that is
// a paid feature, so it happens here.
//
// Callers keep their existing object path unchanged and pass the *returned*
// file's `type` as contentType. Rewriting the path's extension to match would
// orphan the previous object at every `upsert` site whose file changed format.

const DEFAULTS = { maxDimension: 1600, quality: 0.82, minBytes: 300 * 1024 }

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')) }
  img.src = url
})

/**
 * Returns a smaller File, or the original when shrinking would not help.
 *
 * Never throws: a failure here must not stop somebody adding a child's photo at
 * the door, so anything unexpected falls back to uploading as-is. Non-images
 * (safeguarding PDFs, video in the gallery) pass straight through untouched.
 */
export async function shrinkImage(file, opts = {}) {
  const { maxDimension, quality, minBytes } = { ...DEFAULTS, ...opts }

  try {
    if (!file || !file.type?.startsWith('image/')) return file
    // Leave these alone: GIFs would lose animation, and SVG is already small.
    if (/gif|svg/i.test(file.type)) return file
    if (file.size <= minBytes) return file

    const img = await loadImage(file)
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}

export default shrinkImage
