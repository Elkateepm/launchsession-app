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

  const { email, name, org_id, org_slug, redirect_to, role } = req.body
  if (!email || !org_id) return res.status(400).json({ error: 'Missing email or org_id' })
  const inviteRole = ['admin', 'staff', 'volunteer'].includes(role) ? role : 'volunteer'

  // Use service role to invite
  const adminClient = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_SERVICE_KEY
  )

  const redirectUrl = redirect_to || (inviteRole === 'volunteer'
    ? `https://app.launchsession.co.uk/volunteer/${org_slug || ''}`
    : `https://app.launchsession.co.uk/create-password`)

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectUrl,
    data: { org_id, role: inviteRole, full_name: name || email.split('@')[0] }
  })

  if (error) return res.status(400).json({ error: error.message })

  // Create or update user profile
  await adminClient.from('user_profiles').upsert({
    id: data.user.id,
    email: email.trim().toLowerCase(),
    full_name: name || email.split('@')[0],
    org_id,
    role: inviteRole,
    status: 'pending_invite',
  }, { onConflict: 'id' })

  // Get org details for the email
  const { data: orgData } = await adminClient
    .from('organisations')
    .select('name, slug, primary_color, logo_url')
    .eq('id', org_id)
    .single()

  // Send branded invite email via the send-invite-email Edge Function
  try {
    await adminClient.functions.invoke('send-invite-email', {
      body: {
        email: email.trim().toLowerCase(),
        full_name: name || email.split('@')[0],
        org_name: orgData?.name || 'your organisation',
        org_slug: orgData?.slug || org_slug,
        org_color: orgData?.primary_color || '#3B82F6',
        org_logo: orgData?.logo_url || null,
        role: inviteRole,
        redirect_to: redirectUrl,
      }
    })
  } catch (emailErr) {
    // Non-fatal — invite was created, email just didn't send
    console.error('send-invite-email failed:', emailErr)
  }

  return res.status(200).json({ success: true, user_id: data.user.id })
}
