// One-off asset tool: fetches sourceUrl and stores it at bucket/path.
//
// Service role only. Until 24 Nov 2026 it had no caller check, so anyone with
// the public anon key could overwrite any file in any bucket (safeguarding and
// HR documents included) using the service role, and make the server fetch any
// URL. Nothing in the app calls it; it is kept for one-off admin uploads.
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
  if (!isServiceRole(req)) return json({ error: 'Not allowed' }, 401)
  try {
    const { bucket, path, sourceUrl, contentType } = await req.json()
    if (!bucket || !path || !sourceUrl) return json({ error: 'Missing bucket, path, or sourceUrl' }, 400)

    const fetchRes = await fetch(sourceUrl)
    if (!fetchRes.ok) return json({ error: `Failed to fetch sourceUrl: ${fetchRes.status}` }, 502)
    const arrayBuffer = await fetchRes.arrayBuffer()

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, new Uint8Array(arrayBuffer), { contentType: contentType || 'image/png', upsert: true })
    if (uploadError) return json({ error: uploadError.message }, 500)

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path)
    return json({ success: true, bytesFetched: arrayBuffer.byteLength, publicUrl: publicUrlData.publicUrl })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
