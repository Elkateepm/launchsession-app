// Debug tool: lists the 10 most recent emails Resend sent for LaunchSession.
//
// Service role only. Until 24 Nov 2026 it had no caller check, so anyone with
// the public anon key could read the recipient addresses and subject lines of
// LaunchSession's latest emails (parents, staff, volunteers), and by polling
// collect them all. Nothing in the app calls it.
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function isServiceRole(req: Request): boolean {
  const given = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!SERVICE_ROLE_KEY || given.length !== SERVICE_ROLE_KEY.length) return false
  let diff = 0
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ SERVICE_ROLE_KEY.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (!isServiceRole(req)) {
    return new Response(JSON.stringify({ error: 'Not allowed' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  try {
    const res = await fetch('https://api.resend.com/emails?limit=10', {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    })
    const data = await res.json()
    return new Response(JSON.stringify(data, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }
})
