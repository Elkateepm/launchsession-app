// Preparing an uploaded brand image before it goes to storage.
//
// The Branding Centre used to save a zoom and position alongside each logo,
// and nothing outside that page ever read them: the sidebar, sign-in screen,
// emails and public pages all drew the raw file. Most logo exports carry a
// wide margin, so the mark looked small everywhere. Trimming the margin off
// the file itself means every place a logo appears gets the fitted version,
// including emails and pages rendered by other systems.
//
// It also keeps files small. A 4MB phone photo as a sign-in background was
// downloaded by everyone signing in.

export const BRAND_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
// Mirrors file_size_limit on the org-logos bucket.
export const BRAND_IMAGE_MAX_BYTES = 10 * 1024 * 1024

const ALPHA_THRESHOLD = 12
const COLOUR_THRESHOLD = 24

// The smallest rectangle holding the visible content of an RGBA pixel buffer.
// Transparent images are trimmed by alpha. Opaque ones are trimmed against the
// top-left corner colour, which is the background of a logo flattened onto
// white or any other solid colour. Returns null when nothing stands out.
export function contentBounds(data, w, h) {
  const px = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]] }
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)]
  const hasAlpha = corners.some(c => c[3] < 250)
  const bg = corners[0]
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])

  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = px(x, y)
      const content = hasAlpha ? p[3] > ALPHA_THRESHOLD : dist(p, bg) > COLOUR_THRESHOLD
      if (content) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, hasAlpha }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')) }
    img.src = url
  })
}

const toBlob = (canvas, type, quality) =>
  new Promise(resolve => canvas.toBlob(resolve, type, quality))

/**
 * Check and prepare a brand image. Throws an Error with a message fit to show
 * the admin when the file cannot be used.
 *
 *   trim     remove the empty margin around a logo or icon
 *   maxDim   longest side in pixels after preparation
 *   photo    encode as JPEG (backgrounds) rather than PNG (logos)
 */
export async function prepareBrandImage(file, { trim = false, maxDim = 1024, photo = false } = {}) {
  if (!file) throw new Error('No file was chosen.')
  if (!BRAND_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Use a PNG, JPEG, WebP or GIF image.')
  }

  const img = await loadImage(file)

  try {
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight

    if (trim) {
      // Finding the bounds does not need full resolution.
      const scale = Math.min(1, 300 / Math.max(sw, sh))
      const aw = Math.max(1, Math.round(sw * scale)), ah = Math.max(1, Math.round(sh * scale))
      const probe = document.createElement('canvas')
      probe.width = aw; probe.height = ah
      const pctx = probe.getContext('2d')
      pctx.drawImage(img, 0, 0, aw, ah)
      const b = contentBounds(pctx.getImageData(0, 0, aw, ah).data, aw, ah)
      if (b) {
        // A little breathing room so the mark does not touch the frame, kept
        // inside the original image.
        const pad = Math.round(Math.max(b.w, b.h) * 0.06)
        const x0 = Math.max(0, b.x - pad), y0 = Math.max(0, b.y - pad)
        const x1 = Math.min(aw, b.x + b.w + pad), y1 = Math.min(ah, b.y + b.h + pad)
        sx = Math.floor(x0 / scale); sy = Math.floor(y0 / scale)
        sw = Math.min(img.naturalWidth - sx, Math.ceil((x1 - x0) / scale))
        sh = Math.min(img.naturalHeight - sy, Math.ceil((y1 - y0) / scale))
      }
    }

    const out = Math.min(1, maxDim / Math.max(sw, sh))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw * out))
    canvas.height = Math.max(1, Math.round(sh * out))
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

    const type = photo ? 'image/jpeg' : 'image/png'
    const blob = await toBlob(canvas, type, photo ? 0.85 : undefined)
    if (!blob) throw new Error('prepare failed')
    if (blob.size > BRAND_IMAGE_MAX_BYTES) throw new Error('too big')
    return new File([blob], `brand.${photo ? 'jpg' : 'png'}`, { type })
  } catch (e) {
    // Preparation is an improvement, never a gate: fall back to the original
    // when a canvas is unavailable, as long as it is within the size limit.
    if (file.size > BRAND_IMAGE_MAX_BYTES) {
      throw new Error('That image is over 10MB. Use a smaller file.')
    }
    return file
  }
}

export const extensionFor = (file) =>
  ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[file?.type] || 'png'
