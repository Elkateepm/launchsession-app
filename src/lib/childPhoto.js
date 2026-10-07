// A child's photograph: uploaded to the private `gallery` bucket under the
// organisation's own folder, which is what its storage policies require, and
// recorded as an object path on the child.
//
// Each upload gets a new file name rather than overwriting photo.<ext>. Signed
// URLs are cached per path, in this app and by the browser, so replacing an
// object at the same path left every screen that had already shown the old
// photo still showing it. A new path is a new URL everywhere. The previous file
// is removed afterwards so replacements do not pile up.
import { supabase } from './supabase'
import { shrinkImage } from './shrinkImage'
import { storagePath, forgetSignedUrl } from './storageUrl'

const MAX_BYTES = 10 * 1024 * 1024

/** Why a file cannot be used as a photo, or null when it can. */
export function childPhotoProblem(file) {
  if (!file) return 'Choose a photo to upload.'
  if (!file.type?.startsWith('image/')) return 'That file is not an image. Choose a JPG, PNG or WebP photo.'
  return null
}

export async function uploadChildPhoto({ orgId, childId, file, previous }) {
  const problem = childPhotoProblem(file)
  if (problem) throw new Error(problem)
  if (!orgId || !childId) throw new Error('This child could not be identified. Close the profile and try again.')

  const up = await shrinkImage(file, { maxDimension: 900 })
  // Safari converts an iPhone HEIC while shrinking; other browsers cannot read
  // one at all, and neither could the colleagues who would be shown it.
  if (/heic|heif/i.test(up.type)) throw new Error('That is an iPhone HEIC photo, which most browsers cannot show. Share it as a JPG, or set Camera → Formats to “Most Compatible”.')
  if (up.size > MAX_BYTES) throw new Error('That photo is too large. Choose one under 10 MB.')
  const ext = (up.name?.match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase()
  const path = `${orgId}/children/${childId}/photo-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('gallery').upload(path, up, { contentType: up.type || 'image/jpeg' })
  if (uploadError) throw new Error('The photo could not be uploaded. Check your connection and try again.')

  const { error: saveError } = await supabase.from('children').update({ photo_url: path }).eq('id', childId).eq('org_id', orgId)
  if (saveError) {
    await supabase.storage.from('gallery').remove([path])
    throw new Error('The photo uploaded but could not be saved to their profile. Please try again.')
  }

  // Best effort: a leftover file is untidy, not harmful. Only ever a file in
  // this organisation's folder for this child.
  const old = storagePath('gallery', previous)
  if (old && old !== path && old.startsWith(`${orgId}/children/${childId}/`)) {
    forgetSignedUrl('gallery', old)
    await supabase.storage.from('gallery').remove([old]).catch(() => {})
  }

  return path
}
