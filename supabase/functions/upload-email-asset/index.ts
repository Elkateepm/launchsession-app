// Stores an email image (base64) at org-logos/<path>, e.g. email-assets/*.png.
//
// Service role only. Until 24 Nov 2026 it had no caller check, so anyone with
// the public anon key could overwrite any organisation's logo or the images in
// every LaunchSession email. Nothing in the app calls it; it is how email
// assets are replaced without the Supabase CLI.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function isServiceRole(req: Request): boolean {
  const given = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!SERVICE_ROLE_KEY || given.length !== SERVICE_ROLE_KEY.length) return false
  let diff = 0
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ SERVICE_ROLE_KEY.charCodeAt(i)
  return diff === 0
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return json({ success: false, error: 'Not allowed' }, 401)
  try {
    const { path, base64, contentType } = await req.json()
    if (!path || !base64) return json({ success: false, error: 'Missing path or base64' }, 400)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const { data, error } = await supabase.storage
      .from('org-logos')
      .upload(path, bytes, { contentType: contentType || 'image/png', upsert: true })
    if (error) return json({ success: false, error: error.message }, 400)
    const { data: pub } = supabase.storage.from('org-logos').getPublicUrl(path)
    return json({ success: true, data, publicUrl: pub.publicUrl })
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500)
  }
})
