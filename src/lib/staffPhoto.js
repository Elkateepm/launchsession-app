// A staff member's or volunteer's own headshot, in the private `staff-photos`
// bucket. Its storage policy only lets someone write `<their user id>.<ext>`,
// so unlike a child's photo the file name cannot change between uploads.
//
// That made replacing a photo look broken: every screen already showing the
// old one held a signed URL for the same path and kept showing it. The stored
// reference therefore carries a version (`<id>.jpg?v=<time>`), which changes
// on every upload, while storagePath() drops it before anything reaches the
// storage API.
import { supabase } from './supabase'
import { shrinkImage } from './shrinkImage'
import { storagePath, forgetSignedUrl } from './storageUrl'

export async function uploadStaffPhoto({ userId, file, previous }) {
  if (!userId) throw new Error('Sign in again before changing your photo.')
  if (!file?.type?.startsWith('image/')) throw new Error('That file is not an image. Choose a JPG, PNG or WebP photo.')
  const up = await shrinkImage(file, { maxDimension: 900 })
  if (/heic|heif/i.test(up.type)) throw new Error('That is an iPhone HEIC photo, which most browsers cannot show. Share it as a JPG, or set Camera → Formats to “Most Compatible”.')
  const ext = (up.name?.match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase()
  const path = `${userId}.${ext}`

  const { error } = await supabase.storage.from('staff-photos').upload(path, up, { upsert: true, contentType: up.type || 'image/jpeg' })
  if (error) throw new Error('Your photo could not be uploaded. Check your connection and try again.')
  forgetSignedUrl('staff-photos', path)

  // A photo in a different format leaves the old file behind; tidy it away.
  const old = storagePath('staff-photos', previous)
  if (old && old !== path && old.startsWith(`${userId}.`)) {
    forgetSignedUrl('staff-photos', old)
    await supabase.storage.from('staff-photos').remove([old]).catch(() => {})
  }

  return `${path}?v=${Date.now()}`
}
