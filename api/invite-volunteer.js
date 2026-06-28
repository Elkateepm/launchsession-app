import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

  // Verify the calling user is authenticated
  const anonClient = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
  )
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userErr } = await anonClient.auth.getUser(token)
  if (userErr || !user) return res.status(401).json({ error: 'Invalid session' })

  const { email, name, org_id, org_slug, redirect_to } = req.body
  if (!email || !org_id) return res.status(400).json({ error: 'Missing email or org_id' })

  // Use service role to invite
  const adminClient = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_SERVICE_KEY
  )

  const redirectUrl = redirect_to || `https://app.launchsession.co.uk/volunteer/${org_slug || ''}`

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectUrl,
    data: { org_id, role: 'volunteer', full_name: name || email.split('@')[0] }
  })

  if (error) return res.status(400).json({ error: error.message })

  // Create or update user profile
  await adminClient.from('user_profiles').upsert({
    id: data.user.id,
    email: email.trim().toLowerCase(),
    full_name: name || email.split('@')[0],
    org_id,
    role: 'volunteer',
    status: 'pending_invite',
  }, { onConflict: 'id' })

  return res.status(200).json({ success: true, user_id: data.user.id })
}
